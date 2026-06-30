# FSD Three Rules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Разбить единое правило `boundaries` на три независимых ESLint-правила (`public-api`, `layer-imports`, `relative-path`) с автофиксами и тестами.

**Architecture:** Вся логика парсинга FSD-путей выносится в `src/lib/fsd.ts` (чистые функции, тестируются юнит-тестами). Каждое правило — отдельный файл в `src/rules/`, использует хелперы из `lib`. Тесты на `vitest` + `@typescript-eslint/rule-tester`. Пути считаются символически через `path.posix` без обращения к ФС.

**Tech Stack:** TypeScript, `@typescript-eslint/utils` (RuleCreator), `@typescript-eslint/rule-tester`, `@typescript-eslint/parser`, vitest, tsup (сборка).

## Global Constraints

- Алиас конфигурируется опцией `alias`, дефолт `"@"`, может быть пустой строкой `""`.
- Нормализация алиаса: срезать хвостовые `/` (`@/` → `@`).
- FSD-импорт слоя = (непустой алиас → начинается с `<alias>/`; пустой → как есть) И первый сегмент входит в `LAYERS_ORDER`. Иначе все правила делают early return.
- `LAYERS_ORDER = ['shared', 'entities', 'features', 'widgets', 'pages', 'app']` (индекс = высота слоя).
- `SLICELESS_LAYERS = ['shared', 'app']`.
- «Модуль» (для `relative-path` и для skip-логики `public-api`): слайс-слои → 2 сегмента (`layer/slice`); слои без слайсов → 3 сегмента (`layer/segment/unit`), с ограничением доступной глубиной (barrel прямо в сегменте → `layer/segment`).
- Все пути нормализуются в forward-slash; вычисления через `path.posix.*`. `path.toNamespacedPath` НЕ использовать.
- При автофиксе сохранять исходные кавычки (`node.source.raw[0]`).
- `type`-импорты пропускаются в `layer-imports`: «типовой» = `importKind === 'type'` ИЛИ все спецификаторы помечены `type`.
- ESLint flat-config, ESM (`"type": "module"`).

---

## File Structure

- `src/lib/fsd.ts` — **Create.** Все хелперы: константы, `normalizeAlias`, `isRelative`, `isLayer`, `isSlicelessLayer`, `isTypeOnlyImport`, `parseImportTarget`, `getModuleKey`, `getCurrentModule`, `resolveRelativeImport`.
- `src/rules/public-api.ts` — **Create.** Правило `public-api`.
- `src/rules/layer-imports.ts` — **Create.** Правило `layer-imports`.
- `src/rules/relative-path.ts` — **Create.** Правило `relative-path`.
- `src/rules/boundaries.ts` — **Delete.** Старое объединённое правило.
- `src/index.ts` — **Modify.** Регистрация трёх правил + `configs.recommended`.
- `tests/setup.ts` — **Create.** Привязка `RuleTester` к vitest.
- `tests/fsd.test.ts` — **Create.** Юнит-тесты хелперов.
- `tests/public-api.test.ts`, `tests/layer-imports.test.ts`, `tests/relative-path.test.ts` — **Create.**
- `vitest.config.ts` — **Create.**
- `package.json` — **Modify.** devDeps + scripts + версия.

---

## Task 1: Тестовая инфраструктура (vitest + rule-tester)

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `tests/setup.ts`
- Create: `tests/smoke.test.ts`

**Interfaces:**
- Consumes: ничего.
- Produces: рабочая команда `yarn test` (vitest), глобально настроенный `RuleTester` через `tests/setup.ts`.

- [ ] **Step 1: Установить dev-зависимости**

Run:
```bash
yarn add -D vitest @typescript-eslint/rule-tester@^8.62.1 @typescript-eslint/parser@^8.62.1
```
Expected: пакеты добавлены в `devDependencies`, обновлён `yarn.lock`.

- [ ] **Step 2: Добавить скрипты и выровнять версию в `package.json`**

В блок `scripts` добавить (рядом с `build`):
```json
"test": "vitest run",
"test:watch": "vitest"
```
И поднять поле `version` с `"0.0.0"` до `"1.0.0"` (источник истины для `meta.version` плагина).

- [ ] **Step 3: Создать `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts"],
  },
});
```

- [ ] **Step 4: Создать `tests/setup.ts` (привязка RuleTester к vitest)**

```ts
import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;
```

- [ ] **Step 5: Создать смоук-тест `tests/smoke.test.ts`**

```ts
import { describe, it, expect } from "vitest";

describe("smoke", () => {
  it("vitest works", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 6: Запустить тесты — убедиться, что раннер работает**

Run: `yarn test`
Expected: PASS, 1 тест пройден (`smoke > vitest works`).

- [ ] **Step 7: Commit**

```bash
git add package.json yarn.lock vitest.config.ts tests/setup.ts tests/smoke.test.ts
git commit -m "chore: set up vitest and typescript-eslint rule-tester"
```

---

## Task 2: Хелперы `src/lib/fsd.ts`

**Files:**
- Create: `src/lib/fsd.ts`
- Test: `tests/fsd.test.ts`

**Interfaces:**
- Consumes: `path` (`posix`), типы из `@typescript-eslint/utils`.
- Produces:
  - `LAYERS_ORDER: readonly string[]`, `SLICELESS_LAYERS: readonly string[]`
  - `type Layer = (typeof LAYERS_ORDER)[number]`
  - `normalizeAlias(alias: string): string`
  - `isRelative(path: string): boolean`
  - `isLayer(segment: string | undefined): segment is Layer`
  - `isSlicelessLayer(layer: string): boolean`
  - `isTypeOnlyImport(node: TSESTree.ImportDeclaration): boolean`
  - `parseImportTarget(importPath: string, alias: string): { layer: Layer; slice: string | undefined; segments: string[]; cleanPath: string } | null`
  - `getModuleKey(layer: string, segments: string[]): string`
  - `getCurrentModule(filePath: string): { layer: Layer; slice: string | undefined; moduleKey: string; dirSegments: string[] } | null`
  - `resolveRelativeImport(currentFilePath: string, importPath: string): { layer: Layer; slice: string | undefined; segments: string[] } | null`

- [ ] **Step 1: Написать падающие тесты `tests/fsd.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import {
  normalizeAlias,
  isRelative,
  isLayer,
  isTypeOnlyImport,
  parseImportTarget,
  getModuleKey,
  getCurrentModule,
  resolveRelativeImport,
} from "../src/lib/fsd";

describe("normalizeAlias", () => {
  it("срезает хвостовые слеши", () => {
    expect(normalizeAlias("@/")).toBe("@");
    expect(normalizeAlias("@")).toBe("@");
    expect(normalizeAlias("")).toBe("");
  });
});

describe("isRelative", () => {
  it("распознаёт относительные пути", () => {
    expect(isRelative("./x")).toBe(true);
    expect(isRelative("../x")).toBe(true);
    expect(isRelative(".")).toBe(true);
    expect(isRelative("@/entities/x")).toBe(false);
    expect(isRelative("react")).toBe(false);
  });
});

describe("isLayer", () => {
  it("распознаёт слои FSD", () => {
    expect(isLayer("entities")).toBe(true);
    expect(isLayer("some-package")).toBe(false);
    expect(isLayer(undefined)).toBe(false);
  });
});

describe("parseImportTarget", () => {
  it("парсит абсолютный FSD-импорт с алиасом @", () => {
    expect(parseImportTarget("@/entities/users/model/x", "@")).toEqual({
      layer: "entities",
      slice: "users",
      segments: ["entities", "users", "model", "x"],
      cleanPath: "entities/users/model/x",
    });
  });

  it("пропускает библиотеки", () => {
    expect(parseImportTarget("@some-package", "@")).toBeNull();
    expect(parseImportTarget("@/some-package", "@")).toBeNull();
    expect(parseImportTarget("react", "@")).toBeNull();
  });

  it("пропускает относительные", () => {
    expect(parseImportTarget("./x", "@")).toBeNull();
  });

  it("работает с пустым алиасом (bare-импорты)", () => {
    expect(parseImportTarget("entities/users", "")).toEqual({
      layer: "entities",
      slice: "users",
      segments: ["entities", "users"],
      cleanPath: "entities/users",
    });
    expect(parseImportTarget("react", "")).toBeNull();
  });
});

describe("getModuleKey", () => {
  it("слайс-слой → 2 сегмента", () => {
    expect(getModuleKey("entities", ["entities", "users", "ui", "Card"])).toBe(
      "entities/users",
    );
  });
  it("слой без слайсов → 3 сегмента", () => {
    expect(getModuleKey("shared", ["shared", "ui", "Card", "Card.tsx"])).toBe(
      "shared/ui/Card",
    );
  });
  it("ограничивается доступной глубиной", () => {
    expect(getModuleKey("shared", ["shared", "ui"])).toBe("shared/ui");
  });
});

describe("getCurrentModule", () => {
  it("слайс-слой: модуль = layer/slice (без имени файла)", () => {
    expect(getCurrentModule("/proj/src/features/foo/ui/Foo.tsx")?.moduleKey).toBe(
      "features/foo",
    );
  });
  it("shared: модуль = layer/segment/unit", () => {
    expect(
      getCurrentModule("/proj/src/shared/ui/Card/Card.tsx")?.moduleKey,
    ).toBe("shared/ui/Card");
  });
  it("barrel в сегменте shared → layer/segment", () => {
    expect(getCurrentModule("/proj/src/shared/ui/index.ts")?.moduleKey).toBe(
      "shared/ui",
    );
  });
  it("нормализует backslashes (Windows)", () => {
    expect(
      getCurrentModule("C:\\proj\\src\\features\\foo\\ui\\Foo.tsx")?.moduleKey,
    ).toBe("features/foo");
  });
  it("файл вне слоёв → null", () => {
    expect(getCurrentModule("/proj/src/utils/helper.ts")).toBeNull();
  });
});

describe("resolveRelativeImport", () => {
  it("резолвит относительный импорт в layer-rooted сегменты", () => {
    expect(
      resolveRelativeImport(
        "/proj/src/features/foo/ui/Foo.tsx",
        "../../bar/ui/Button",
      ),
    ).toEqual({
      layer: "features",
      slice: "bar",
      segments: ["features", "bar", "ui", "Button"],
    });
  });
  it("резолвит относительный импорт в свой модуль", () => {
    expect(
      resolveRelativeImport("/proj/src/features/foo/ui/Foo.tsx", "../model/x"),
    ).toEqual({
      layer: "features",
      slice: "foo",
      segments: ["features", "foo", "model", "x"],
    });
  });
  it("кросс-слойный относительный импорт", () => {
    expect(
      resolveRelativeImport(
        "/proj/src/features/foo/ui/Foo.tsx",
        "../../../shared/lib/x",
      ),
    ).toEqual({
      layer: "shared",
      slice: "lib",
      segments: ["shared", "lib", "x"],
    });
  });
});

describe("isTypeOnlyImport", () => {
  it("true для importKind=type", () => {
    expect(isTypeOnlyImport({ importKind: "type", specifiers: [] } as never)).toBe(
      true,
    );
  });
  it("true когда все спецификаторы type", () => {
    expect(
      isTypeOnlyImport({
        importKind: "value",
        specifiers: [
          { type: "ImportSpecifier", importKind: "type" },
          { type: "ImportSpecifier", importKind: "type" },
        ],
      } as never),
    ).toBe(true);
  });
  it("false для смешанного импорта", () => {
    expect(
      isTypeOnlyImport({
        importKind: "value",
        specifiers: [
          { type: "ImportSpecifier", importKind: "type" },
          { type: "ImportSpecifier", importKind: "value" },
        ],
      } as never),
    ).toBe(false);
  });
  it("false для дефолтного импорта значения", () => {
    expect(
      isTypeOnlyImport({
        importKind: "value",
        specifiers: [{ type: "ImportDefaultSpecifier" }],
      } as never),
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Запустить тесты — убедиться, что падают**

Run: `yarn test tests/fsd.test.ts`
Expected: FAIL — `Failed to resolve import "../src/lib/fsd"` (файл ещё не создан).

- [ ] **Step 3: Реализовать `src/lib/fsd.ts`**

```ts
import { posix } from "path";
import type { TSESTree } from "@typescript-eslint/utils";

export const LAYERS_ORDER = [
  "shared",
  "entities",
  "features",
  "widgets",
  "pages",
  "app",
] as const;

export const SLICELESS_LAYERS = ["shared", "app"] as const;

export type Layer = (typeof LAYERS_ORDER)[number];

export const normalizeAlias = (alias: string): string =>
  alias.replace(/\/+$/, "");

export const isRelative = (path: string): boolean =>
  path === "." || path.startsWith("./") || path.startsWith("../");

export const isLayer = (segment: string | undefined): segment is Layer =>
  segment !== undefined && (LAYERS_ORDER as readonly string[]).includes(segment);

export const isSlicelessLayer = (layer: string): boolean =>
  (SLICELESS_LAYERS as readonly string[]).includes(layer);

export const isTypeOnlyImport = (
  node: TSESTree.ImportDeclaration,
): boolean => {
  if (node.importKind === "type") {
    return true;
  }
  if (node.specifiers.length === 0) {
    return false;
  }
  return node.specifiers.every(
    (s) => s.type === "ImportSpecifier" && s.importKind === "type",
  );
};

export interface ImportTarget {
  layer: Layer;
  slice: string | undefined;
  segments: string[];
  cleanPath: string;
}

export const parseImportTarget = (
  importPath: string,
  alias: string,
): ImportTarget | null => {
  if (isRelative(importPath)) {
    return null;
  }
  const normalizedAlias = normalizeAlias(alias);
  let cleanPath: string;
  if (normalizedAlias) {
    const prefix = `${normalizedAlias}/`;
    if (!importPath.startsWith(prefix)) {
      return null;
    }
    cleanPath = importPath.slice(prefix.length);
  } else {
    cleanPath = importPath;
  }
  const segments = cleanPath.split("/").filter(Boolean);
  const layer = segments[0];
  if (!isLayer(layer)) {
    return null;
  }
  return { layer, slice: segments[1], segments, cleanPath };
};

export const getModuleKey = (layer: string, segments: string[]): string => {
  const depth = isSlicelessLayer(layer) ? 3 : 2;
  return segments.slice(0, depth).join("/");
};

export interface CurrentModule {
  layer: Layer;
  slice: string | undefined;
  moduleKey: string;
  dirSegments: string[];
}

export const getCurrentModule = (filePath: string): CurrentModule | null => {
  const normalized = filePath.replace(/\\/g, "/");
  const allSegments = normalized.split("/").filter(Boolean);
  const layerIndex = allSegments.findIndex((s) => isLayer(s));
  if (layerIndex === -1) {
    return null;
  }
  const layer = allSegments[layerIndex] as Layer;
  const fileSegments = allSegments.slice(layerIndex); // от слоя, включая имя файла
  const dirSegments = fileSegments.slice(0, -1); // без имени файла
  return {
    layer,
    slice: dirSegments[1],
    moduleKey: getModuleKey(layer, dirSegments),
    dirSegments,
  };
};

export interface ResolvedTarget {
  layer: Layer;
  slice: string | undefined;
  segments: string[];
}

export const resolveRelativeImport = (
  currentFilePath: string,
  importPath: string,
): ResolvedTarget | null => {
  const normalized = currentFilePath.replace(/\\/g, "/");
  const allSegments = normalized.split("/").filter(Boolean);
  const layerIndex = allSegments.findIndex((s) => isLayer(s));
  if (layerIndex === -1) {
    return null;
  }
  const fileSegments = allSegments.slice(layerIndex);
  const dirSegments = fileSegments.slice(0, -1);
  // Резолвим символически от фейкового root, чтобы не зависеть от cwd/ОС.
  const targetAbs = posix.resolve(`/${dirSegments.join("/")}`, importPath);
  const segments = targetAbs.split("/").filter(Boolean);
  const layer = segments[0];
  if (!isLayer(layer)) {
    return null;
  }
  return { layer, slice: segments[1], segments };
};
```

- [ ] **Step 4: Запустить тесты — убедиться, что проходят**

Run: `yarn test tests/fsd.test.ts`
Expected: PASS, все тесты зелёные.

- [ ] **Step 5: Commit**

```bash
git add src/lib/fsd.ts tests/fsd.test.ts
git commit -m "feat: add fsd path-parsing helpers"
```

---

## Task 3: Правило `public-api`

**Files:**
- Create: `src/rules/public-api.ts`
- Test: `tests/public-api.test.ts`

**Interfaces:**
- Consumes: `parseImportTarget`, `getCurrentModule`, `getModuleKey`, `isSlicelessLayer` из `../lib/fsd`.
- Produces: `export const publicApi` (ESLint rule), `messageIds`: `publicApiViolation`, `sharedSegmentRequired`.

- [ ] **Step 1: Написать падающие тесты `tests/public-api.test.ts`**

```ts
import { RuleTester } from "@typescript-eslint/rule-tester";
import { publicApi } from "../src/rules/public-api";

const ruleTester = new RuleTester();

ruleTester.run("public-api", publicApi, {
  valid: [
    // импорт через Public API слайса
    {
      code: "import { User } from '@/entities/users';",
      filename: "/proj/src/pages/home/ui/Home.tsx",
    },
    // shared с сегментом
    {
      code: "import { Button } from '@/shared/ui';",
      filename: "/proj/src/pages/home/ui/Home.tsx",
    },
    // shared глубже сегмента — разрешено
    {
      code: "import { Button } from '@/shared/ui/Button/Button';",
      filename: "/proj/src/pages/home/ui/Home.tsx",
    },
    // библиотека — пропуск
    {
      code: "import React from 'react';",
      filename: "/proj/src/pages/home/ui/Home.tsx",
    },
    // deep-импорт внутри своего же модуля — зона relative-path, тут молчим
    {
      code: "import { x } from '@/entities/users/model/x';",
      filename: "/proj/src/entities/users/ui/Card.tsx",
    },
    // исключение через опцию
    {
      code: "import { store } from '@/entities/users/testing';",
      filename: "/proj/src/pages/home/ui/Home.tsx",
      options: [{ alias: "@", exceptions: ["entities/users/testing"] }],
    },
  ],
  invalid: [
    // deep-импорт в чужой слайс → автофикс до Public API
    {
      code: "import { User } from '@/entities/users/model/user';",
      filename: "/proj/src/pages/home/ui/Home.tsx",
      output: "import { User } from '@/entities/users';",
      errors: [{ messageId: "publicApiViolation" }],
    },
    // сохранение двойных кавычек
    {
      code: 'import { User } from "@/entities/users/model/user";',
      filename: "/proj/src/pages/home/ui/Home.tsx",
      output: 'import { User } from "@/entities/users";',
      errors: [{ messageId: "publicApiViolation" }],
    },
    // голый shared без сегмента
    {
      code: "import x from '@/shared';",
      filename: "/proj/src/pages/home/ui/Home.tsx",
      errors: [{ messageId: "sharedSegmentRequired" }],
    },
    // голый app без сегмента
    {
      code: "import x from '@/app';",
      filename: "/proj/src/pages/home/ui/Home.tsx",
      errors: [{ messageId: "sharedSegmentRequired" }],
    },
  ],
});
```

- [ ] **Step 2: Запустить тесты — убедиться, что падают**

Run: `yarn test tests/public-api.test.ts`
Expected: FAIL — `Failed to resolve import "../src/rules/public-api"`.

- [ ] **Step 3: Реализовать `src/rules/public-api.ts`**

```ts
import { ESLintUtils, type TSESTree } from "@typescript-eslint/utils";
import {
  parseImportTarget,
  getCurrentModule,
  getModuleKey,
  isSlicelessLayer,
} from "../lib/fsd.js";

type Options = [{ alias?: string; exceptions?: string[] }];
type MessageIds = "publicApiViolation" | "sharedSegmentRequired";

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/f1eeman/eslint-plugin-fsd-boundaries/blob/main/docs/rules/${name}.md`,
);

export const publicApi = createRule<Options, MessageIds>({
  name: "public-api",
  meta: {
    type: "problem",
    docs: {
      description:
        "Запрет импортов мимо Public API слайса (для shared/app — минимум сегмент)",
    },
    fixable: "code",
    schema: [
      {
        type: "object",
        properties: {
          alias: { type: "string" },
          exceptions: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      publicApiViolation:
        "Абсолютные импорты из слайса '{{ slice }}' должны идти только через Public API. Deep-импорты запрещены.",
      sharedSegmentRequired:
        "Импорт из слоя '{{ layer }}' должен указывать сегмент (например '{{ layer }}/ui'). Импорт голого слоя запрещён.",
    },
  },
  defaultOptions: [{ alias: "@", exceptions: [] }],
  create: (context) => {
    const [{ alias = "@", exceptions = [] }] = context.options;
    const currentFilePath = context.filename.replace(/\\/g, "/");
    const currentModule = getCurrentModule(currentFilePath);

    return {
      ImportDeclaration: (node: TSESTree.ImportDeclaration) => {
        const importPath = node.source.value;
        const target = parseImportTarget(importPath, alias);
        if (!target) {
          return;
        }

        // Внутримодульный импорт — зона relative-path, не трогаем.
        const targetModuleKey = getModuleKey(target.layer, target.segments);
        if (currentModule && currentModule.moduleKey === targetModuleKey) {
          return;
        }

        // Исключения.
        if (exceptions.some((exc) => target.cleanPath.startsWith(exc))) {
          return;
        }

        // Слои без слайсов: обязателен минимум один сегмент.
        if (isSlicelessLayer(target.layer)) {
          if (target.segments.length < 2) {
            context.report({
              node: node.source,
              messageId: "sharedSegmentRequired",
              data: { layer: target.layer },
            });
          }
          return;
        }

        // Слайс-слои: deep-импорт (> 2 сегментов) запрещён, автофикс до Public API.
        if (target.segments.length > 2) {
          const quote = node.source.raw[0];
          const normalizedAlias = alias.replace(/\/+$/, "");
          const publicApiPath = normalizedAlias
            ? `${normalizedAlias}/${target.layer}/${target.slice}`
            : `${target.layer}/${target.slice}`;
          context.report({
            node: node.source,
            messageId: "publicApiViolation",
            data: { slice: target.slice },
            fix: (fixer) =>
              fixer.replaceText(
                node.source,
                `${quote}${publicApiPath}${quote}`,
              ),
          });
        }
      },
    };
  },
});
```

- [ ] **Step 4: Запустить тесты — убедиться, что проходят**

Run: `yarn test tests/public-api.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/rules/public-api.ts tests/public-api.test.ts
git commit -m "feat: add public-api rule with autofix"
```

---

## Task 4: Правило `layer-imports`

**Files:**
- Create: `src/rules/layer-imports.ts`
- Test: `tests/layer-imports.test.ts`

**Interfaces:**
- Consumes: `parseImportTarget`, `resolveRelativeImport`, `getCurrentModule`, `isRelative`, `isSlicelessLayer`, `isTypeOnlyImport`, `LAYERS_ORDER` из `../lib/fsd`.
- Produces: `export const layerImports`, `messageIds`: `layerViolation`, `crossSliceViolation`.

- [ ] **Step 1: Написать падающие тесты `tests/layer-imports.test.ts`**

```ts
import { RuleTester } from "@typescript-eslint/rule-tester";
import { layerImports } from "../src/rules/layer-imports";

const ruleTester = new RuleTester();

ruleTester.run("layer-imports", layerImports, {
  valid: [
    // нижележащий импортирует ещё ниже — ок
    {
      code: "import { Button } from '@/shared/ui';",
      filename: "/proj/src/features/foo/ui/Foo.tsx",
    },
    // вышележащий импортирует нижележащий — ок
    {
      code: "import { User } from '@/entities/users';",
      filename: "/proj/src/pages/home/ui/Home.tsx",
    },
    // импорт вышележащего слоя, но type — ок
    {
      code: "import type { Page } from '@/pages/home';",
      filename: "/proj/src/features/foo/ui/Foo.tsx",
    },
    // cross-slice, но type — ок
    {
      code: "import type { Bar } from '@/features/bar';",
      filename: "/proj/src/features/foo/ui/Foo.tsx",
    },
    // импорт в тот же слайс — зона relative-path, тут молчим
    {
      code: "import { x } from '@/features/foo/model/x';",
      filename: "/proj/src/features/foo/ui/Foo.tsx",
    },
    // кросс-сегмент внутри shared — норма
    {
      code: "import { cn } from '@/shared/lib';",
      filename: "/proj/src/shared/ui/Button/Button.tsx",
    },
    // библиотека — пропуск
    {
      code: "import React from 'react';",
      filename: "/proj/src/shared/ui/Button/Button.tsx",
    },
  ],
  invalid: [
    // нижележащий импортирует вышележащий
    {
      code: "import { Foo } from '@/features/foo';",
      filename: "/proj/src/entities/users/ui/Card.tsx",
      errors: [{ messageId: "layerViolation" }],
    },
    // cross-slice в том же слое (значение)
    {
      code: "import { Bar } from '@/features/bar';",
      filename: "/proj/src/features/foo/ui/Foo.tsx",
      errors: [{ messageId: "crossSliceViolation" }],
    },
    // смешанный импорт (type + value) — не пропускается
    {
      code: "import { type Bar, makeBar } from '@/features/bar';",
      filename: "/proj/src/features/foo/ui/Foo.tsx",
      errors: [{ messageId: "crossSliceViolation" }],
    },
    // относительный cross-slice тоже ловится
    {
      code: "import { Bar } from '../../bar/ui/Bar';",
      filename: "/proj/src/features/foo/ui/Foo.tsx",
      errors: [{ messageId: "crossSliceViolation" }],
    },
  ],
});
```

- [ ] **Step 2: Запустить тесты — убедиться, что падают**

Run: `yarn test tests/layer-imports.test.ts`
Expected: FAIL — `Failed to resolve import "../src/rules/layer-imports"`.

- [ ] **Step 3: Реализовать `src/rules/layer-imports.ts`**

```ts
import { ESLintUtils, type TSESTree } from "@typescript-eslint/utils";
import {
  LAYERS_ORDER,
  parseImportTarget,
  resolveRelativeImport,
  getCurrentModule,
  isRelative,
  isSlicelessLayer,
  isTypeOnlyImport,
  type Layer,
} from "../lib/fsd.js";

type Options = [{ alias?: string }];
type MessageIds = "layerViolation" | "crossSliceViolation";

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/f1eeman/eslint-plugin-fsd-boundaries/blob/main/docs/rules/${name}.md`,
);

export const layerImports = createRule<Options, MessageIds>({
  name: "layer-imports",
  meta: {
    type: "problem",
    docs: {
      description:
        "Запрет импорта вышележащих слоёв в нижележащие и импорта между слайсами одного слоя",
    },
    schema: [
      {
        type: "object",
        properties: { alias: { type: "string" } },
        additionalProperties: false,
      },
    ],
    messages: {
      layerViolation:
        "Нарушение слоёв FSD: нельзя импортировать вышележащий слой '{{ targetLayer }}' в нижележащий '{{ currentLayer }}'.",
      crossSliceViolation:
        "Слайс '{{ currentSlice }}' не может импортировать другой слайс '{{ targetSlice }}' того же слоя '{{ layer }}' (кроме type-импортов).",
    },
  },
  defaultOptions: [{ alias: "@" }],
  create: (context) => {
    const [{ alias = "@" }] = context.options;
    const currentFilePath = context.filename.replace(/\\/g, "/");
    const currentModule = getCurrentModule(currentFilePath);

    return {
      ImportDeclaration: (node: TSESTree.ImportDeclaration) => {
        if (!currentModule) {
          return;
        }
        if (isTypeOnlyImport(node)) {
          return;
        }

        const importPath = node.source.value;
        const target = isRelative(importPath)
          ? resolveRelativeImport(currentFilePath, importPath)
          : parseImportTarget(importPath, alias);
        if (!target) {
          return;
        }

        const currentLayer = currentModule.layer;
        const targetLayer: Layer = target.layer;

        // 1. Направление слоёв: нижележащий не может тянуть вышележащий.
        const currentOrder = LAYERS_ORDER.indexOf(currentLayer);
        const targetOrder = LAYERS_ORDER.indexOf(targetLayer);
        if (targetOrder > currentOrder) {
          context.report({
            node,
            messageId: "layerViolation",
            data: { targetLayer, currentLayer },
          });
          return;
        }

        // 2. Cross-slice внутри одного слайс-слоя.
        if (
          currentLayer === targetLayer &&
          !isSlicelessLayer(currentLayer) &&
          currentModule.slice !== undefined &&
          target.slice !== undefined &&
          currentModule.slice !== target.slice
        ) {
          context.report({
            node,
            messageId: "crossSliceViolation",
            data: {
              currentSlice: currentModule.slice,
              targetSlice: target.slice,
              layer: currentLayer,
            },
          });
        }
      },
    };
  },
});
```

- [ ] **Step 4: Запустить тесты — убедиться, что проходят**

Run: `yarn test tests/layer-imports.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/rules/layer-imports.ts tests/layer-imports.test.ts
git commit -m "feat: add layer-imports rule (layer direction + cross-slice)"
```

---

## Task 5: Правило `relative-path`

**Files:**
- Create: `src/rules/relative-path.ts`
- Test: `tests/relative-path.test.ts`

**Interfaces:**
- Consumes: `parseImportTarget`, `resolveRelativeImport`, `getCurrentModule`, `getModuleKey`, `isRelative`, `normalizeAlias` из `../lib/fsd`; `posix` из `path`.
- Produces: `export const relativePath`, `messageIds`: `shouldBeRelative`, `shouldBeAbsolute`.

- [ ] **Step 1: Написать падающие тесты `tests/relative-path.test.ts`**

```ts
import { RuleTester } from "@typescript-eslint/rule-tester";
import { relativePath } from "../src/rules/relative-path";

const ruleTester = new RuleTester();

ruleTester.run("relative-path", relativePath, {
  valid: [
    // относительный импорт внутри своего модуля — ок
    {
      code: "import { x } from '../model/x';",
      filename: "/proj/src/features/foo/ui/Foo.tsx",
    },
    // абсолютный импорт в чужой модуль — ок
    {
      code: "import { Bar } from '@/features/bar';",
      filename: "/proj/src/features/foo/ui/Foo.tsx",
    },
    // shared: относительный внутри своего unit — ок
    {
      code: "import { helper } from './helpers';",
      filename: "/proj/src/shared/ui/Card/Card.tsx",
    },
    // shared: абсолютный в другой unit того же сегмента — ок
    {
      code: "import { Button } from '@/shared/ui/Button';",
      filename: "/proj/src/shared/ui/Card/Card.tsx",
    },
  ],
  invalid: [
    // абсолютный импорт в свой модуль → должен быть относительным
    {
      code: "import { x } from '@/features/foo/model/x';",
      filename: "/proj/src/features/foo/ui/Foo.tsx",
      output: "import { x } from '../model/x';",
      errors: [{ messageId: "shouldBeRelative" }],
    },
    // shared: абсолютный в свой unit → относительный
    {
      code: "import { helper } from '@/shared/ui/Card/helpers';",
      filename: "/proj/src/shared/ui/Card/Card.tsx",
      output: "import { helper } from './helpers';",
      errors: [{ messageId: "shouldBeRelative" }],
    },
    // относительный импорт в чужой модуль → должен быть абсолютным
    {
      code: "import { Bar } from '../../bar/ui/Bar';",
      filename: "/proj/src/features/foo/ui/Foo.tsx",
      output: "import { Bar } from '@/features/bar/ui/Bar';",
      errors: [{ messageId: "shouldBeAbsolute" }],
    },
    // относительный кросс-слой → абсолютный
    {
      code: "import { cn } from '../../../shared/lib/cn';",
      filename: "/proj/src/features/foo/ui/Foo.tsx",
      output: "import { cn } from '@/shared/lib/cn';",
      errors: [{ messageId: "shouldBeAbsolute" }],
    },
  ],
});
```

- [ ] **Step 2: Запустить тесты — убедиться, что падают**

Run: `yarn test tests/relative-path.test.ts`
Expected: FAIL — `Failed to resolve import "../src/rules/relative-path"`.

- [ ] **Step 3: Реализовать `src/rules/relative-path.ts`**

```ts
import { posix } from "path";
import { ESLintUtils, type TSESTree } from "@typescript-eslint/utils";
import {
  parseImportTarget,
  resolveRelativeImport,
  getCurrentModule,
  getModuleKey,
  isRelative,
  normalizeAlias,
} from "../lib/fsd.js";

type Options = [{ alias?: string }];
type MessageIds = "shouldBeRelative" | "shouldBeAbsolute";

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/f1eeman/eslint-plugin-fsd-boundaries/blob/main/docs/rules/${name}.md`,
);

export const relativePath = createRule<Options, MessageIds>({
  name: "relative-path",
  meta: {
    type: "problem",
    docs: {
      description:
        "Импорты внутри своего модуля должны быть относительными, в чужой — абсолютными",
    },
    fixable: "code",
    schema: [
      {
        type: "object",
        properties: { alias: { type: "string" } },
        additionalProperties: false,
      },
    ],
    messages: {
      shouldBeRelative:
        "Импорт внутри своего модуля должен быть относительным.",
      shouldBeAbsolute:
        "Импорт в чужой модуль должен быть абсолютным (через алиас).",
    },
  },
  defaultOptions: [{ alias: "@" }],
  create: (context) => {
    const [{ alias = "@" }] = context.options;
    const currentFilePath = context.filename.replace(/\\/g, "/");
    const currentModule = getCurrentModule(currentFilePath);

    return {
      ImportDeclaration: (node: TSESTree.ImportDeclaration) => {
        if (!currentModule) {
          return;
        }
        const importPath = node.source.value;
        const quote = node.source.raw[0];

        if (isRelative(importPath)) {
          // Направление B: относительный импорт, ведущий в ЧУЖОЙ модуль.
          const target = resolveRelativeImport(currentFilePath, importPath);
          if (!target) {
            return;
          }
          const targetModuleKey = getModuleKey(target.layer, target.segments);
          if (targetModuleKey === currentModule.moduleKey) {
            return; // свой модуль — относительный путь корректен
          }
          const normalizedAlias = normalizeAlias(alias);
          const absolute = normalizedAlias
            ? `${normalizedAlias}/${target.segments.join("/")}`
            : target.segments.join("/");
          context.report({
            node: node.source,
            messageId: "shouldBeAbsolute",
            fix: (fixer) =>
              fixer.replaceText(node.source, `${quote}${absolute}${quote}`),
          });
          return;
        }

        // Направление A: абсолютный FSD-импорт в СВОЙ модуль.
        const target = parseImportTarget(importPath, alias);
        if (!target) {
          return;
        }
        const targetModuleKey = getModuleKey(target.layer, target.segments);
        if (targetModuleKey !== currentModule.moduleKey) {
          return; // чужой модуль — абсолютный путь корректен
        }

        // Считаем относительный путь символически (layer-rooted).
        const fromDir = currentModule.dirSegments.join("/");
        const toPath = target.segments.join("/");
        let relative = posix.relative(fromDir, toPath);
        if (!relative.startsWith(".")) {
          relative = `./${relative}`;
        }
        context.report({
          node: node.source,
          messageId: "shouldBeRelative",
          fix: (fixer) =>
            fixer.replaceText(node.source, `${quote}${relative}${quote}`),
        });
      },
    };
  },
});
```

- [ ] **Step 4: Запустить тесты — убедиться, что проходят**

Run: `yarn test tests/relative-path.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/rules/relative-path.ts tests/relative-path.test.ts
git commit -m "feat: add relative-path rule with bidirectional autofix"
```

---

## Task 6: Сборка плагина, удаление старого правила

**Files:**
- Modify: `src/index.ts`
- Delete: `src/rules/boundaries.ts`
- Test: `tests/index.test.ts`

**Interfaces:**
- Consumes: `publicApi`, `layerImports`, `relativePath` из `./rules/*`.
- Produces: `default export` — объект плагина с `rules` (3 ключа) и `configs.recommended`.

- [ ] **Step 1: Написать падающий тест `tests/index.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import plugin from "../src/index";

describe("plugin", () => {
  it("регистрирует три правила", () => {
    expect(Object.keys(plugin.rules).sort()).toEqual([
      "layer-imports",
      "public-api",
      "relative-path",
    ]);
  });

  it("не содержит старого правила boundaries", () => {
    expect(plugin.rules).not.toHaveProperty("boundaries");
  });

  it("recommended включает все три правила на error", () => {
    const rules = (plugin.configs.recommended as { rules: Record<string, unknown> })
      .rules;
    expect(rules["fsd-boundaries/public-api"]).toBe("error");
    expect(rules["fsd-boundaries/layer-imports"]).toBe("error");
    expect(rules["fsd-boundaries/relative-path"]).toBe("error");
  });
});
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run: `yarn test tests/index.test.ts`
Expected: FAIL — тест на отсутствие `boundaries` или набор ключей не сходится (старый `index.ts` регистрирует `boundaries`).

- [ ] **Step 3: Удалить старое правило**

Run: `git rm src/rules/boundaries.ts`
Expected: файл удалён.

- [ ] **Step 4: Переписать `src/index.ts`**

```ts
import { publicApi } from "./rules/public-api.js";
import { layerImports } from "./rules/layer-imports.js";
import { relativePath } from "./rules/relative-path.js";

interface EslintPlugin {
  meta: { name: string; version: string };
  rules: Record<string, unknown>;
  configs: Record<string, unknown>;
}

const plugin: EslintPlugin = {
  meta: {
    name: "eslint-plugin-fsd-boundaries",
    version: "1.0.0",
  },
  rules: {
    "public-api": publicApi,
    "layer-imports": layerImports,
    "relative-path": relativePath,
  },
  configs: {},
};

plugin.configs.recommended = {
  plugins: {
    "fsd-boundaries": plugin,
  },
  rules: {
    "fsd-boundaries/public-api": "error",
    "fsd-boundaries/layer-imports": "error",
    "fsd-boundaries/relative-path": "error",
  },
};

export default plugin;
```

- [ ] **Step 5: Запустить весь набор тестов**

Run: `yarn test`
Expected: PASS — все тесты (fsd, public-api, layer-imports, relative-path, index, smoke) зелёные.

- [ ] **Step 6: Проверить сборку**

Run: `yarn build`
Expected: успешная сборка в `dist/` без ошибок типов.

- [ ] **Step 7: Commit**

```bash
git add src/index.ts tests/index.test.ts
git commit -m "feat: register three rules, remove legacy boundaries rule"
```

---

## Self-Review (выполнено при написании плана)

- **Покрытие спеки:** алиас/пустой алиас/отделение библиотек → Task 2 (`parseImportTarget`) + тесты; кросс-платформенные пути → Task 2 (`posix`, нормализация) + тест с backslashes; `public-api` (слайс-слои + shared/app + skip внутримодульный) → Task 3; `layer-imports` (направление + cross-slice + type) → Task 4; `relative-path` (обе стороны + автофикс) → Task 5; index/удаление boundaries/версия → Task 1 (версия) + Task 6.
- **Плейсхолдеры:** отсутствуют — весь код приведён целиком.
- **Согласованность типов:** имена `parseImportTarget`/`getModuleKey`/`getCurrentModule`/`resolveRelativeImport` и их сигнатуры совпадают между Task 2 и потребителями (Task 3–5).

## Известные риски при исполнении

- `RuleTester` из `@typescript-eslint/rule-tester` требует привязки к раннеру (сделано в `tests/setup.ts`) и по умолчанию использует `@typescript-eslint/parser` — он добавлен в Task 1.
- Если `yarn build` (tsup) ругается на отсутствие dev-only типов в рантайме — это не влияет на тесты (vitest читает исходники напрямую).

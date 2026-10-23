import { RuleTester } from "@typescript-eslint/rule-tester";
import { layerImports } from "../src/rules/layer-imports.js";

const ruleTester = new RuleTester();

ruleTester.run("layer-imports", layerImports, {
  valid: [
    {
      code: "export * from '@/features/bar';",
      filename: "/proj/src/widgets/sidebar/index.ts",
    },
    {
      code: "export { Sidebar } from './ui/Sidebar';",
      filename: "/proj/src/widgets/sidebar/index.ts",
      options: [{ forbidForeignReexports: true }],
    },
    {
      code: "export * from './button';",
      filename: "/proj/src/shared/ui/index.ts",
      options: [{ forbidForeignReexports: true }],
    },
    {
      code: "export { clsx } from 'clsx';",
      filename: "/proj/src/shared/lib/index.ts",
      options: [{ forbidForeignReexports: true }],
    },
    {
      code: "export type { Bar } from '@/features/bar';",
      filename: "/proj/src/widgets/sidebar/index.ts",
      options: [{ forbidForeignReexports: true }],
    },
    {
      code: "import { Bar } from '@/features/bar'; export { Bar };",
      filename: "/proj/src/widgets/sidebar/index.ts",
      options: [{ forbidForeignReexports: true }],
    },
    {
      code: "export * from '@/entities/bar';",
      filename: "/proj/src/features/bar/index.ts",
      options: [
        { forbidForeignReexports: true, exceptions: ["entities/bar"] },
      ],
    },
    {
      code: "export type { Bar } from '@/features/bar';",
      filename: "/proj/src/features/foo/index.ts",
    },
    {
      code: "export { type Bar } from '@/features/bar';",
      filename: "/proj/src/features/foo/index.ts",
    },
    {
      code: "export type * from '@/features/bar';",
      filename: "/proj/src/features/foo/index.ts",
    },
    {
      code: "const m = import('@/entities/users');",
      filename: "/proj/src/features/foo/ui/Foo.tsx",
    },
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
    // exceptions: разрешённый импорт вышележащего слоя (классический StateSchema)
    {
      code: "import { StateSchema } from '@/app/providers/StoreProvider';",
      filename: "/proj/src/entities/article/model/slice/articleDetailsSlice.ts",
      options: [{ exceptions: ["app/providers/StoreProvider"] }],
    },
    // exceptions: разрешённый cross-slice импорт
    {
      code: "import { Bar } from '@/features/bar';",
      filename: "/proj/src/features/foo/ui/Foo.tsx",
      options: [{ exceptions: ["features/bar"] }],
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
    // пустой алиас — нижний слой импортирует верхний
    {
      code: "import { Foo } from 'features/foo';",
      filename: "/proj/src/entities/users/ui/Card.tsx",
      settings: { "fsd-boundaries": { alias: "" } },
      errors: [{ messageId: "layerViolation" }],
    },
    // кастомный алиас ~ — cross-slice в том же слое
    {
      code: "import { Bar } from '~/features/bar';",
      filename: "/proj/src/features/foo/ui/Foo.tsx",
      settings: { "fsd-boundaries": { alias: "~" } },
      errors: [{ messageId: "crossSliceViolation" }],
    },
    {
      code: "export { Foo } from '@/features/foo';",
      filename: "/proj/src/entities/users/index.ts",
      errors: [{ messageId: "layerViolation" }],
    },
    {
      code: "export * from '@/features/bar';",
      filename: "/proj/src/features/foo/index.ts",
      errors: [{ messageId: "crossSliceViolation" }],
    },
    {
      code: "export { type Bar, makeBar } from '@/features/bar';",
      filename: "/proj/src/features/foo/index.ts",
      errors: [{ messageId: "crossSliceViolation" }],
    },
    {
      code: "const m = import('@/features/foo');",
      filename: "/proj/src/entities/users/ui/Card.tsx",
      errors: [{ messageId: "layerViolation" }],
    },
    {
      code: "export * from '@/features/bar';",
      filename: "/proj/src/widgets/sidebar/index.ts",
      options: [{ forbidForeignReexports: true }],
      errors: [{ messageId: "foreignReexport" }],
    },
    {
      code: "export { Bar } from '@/features/bar';",
      filename: "/proj/src/widgets/sidebar/index.ts",
      options: [{ forbidForeignReexports: true }],
      errors: [{ messageId: "foreignReexport" }],
    },
    {
      code: "export { Button } from '@/shared/ui';",
      filename: "/proj/src/features/foo/index.ts",
      options: [{ forbidForeignReexports: true }],
      errors: [{ messageId: "foreignReexport" }],
    },
    {
      code: "export * from '../../../entities/users';",
      filename: "/proj/src/features/foo/model/index.ts",
      options: [{ forbidForeignReexports: true }],
      errors: [{ messageId: "foreignReexport" }],
    },
    {
      code: "export * from '@/features/bar';",
      filename: "/proj/src/features/foo/index.ts",
      options: [{ forbidForeignReexports: true }],
      errors: [{ messageId: "crossSliceViolation" }],
    },
  ],
});

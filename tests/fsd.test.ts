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

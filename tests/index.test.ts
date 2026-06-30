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

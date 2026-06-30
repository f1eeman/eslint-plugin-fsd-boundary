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

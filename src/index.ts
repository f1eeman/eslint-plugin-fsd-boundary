import { boundaries } from "./rules/boundaries.js";

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
        "boundaries": boundaries,
    },
    configs: {},
};

plugin.configs.recommended = {
    plugins: {
        "fsd-boundaries": plugin,
    },
    rules: {
        "fsd-boundaries/boundaries": ["error", {
            alias: "@/",
            exceptions: []
        }],
    },
};

export default plugin;
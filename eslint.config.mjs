import { defineConfig } from "eslint/config";
import pluginJs from "@eslint/js";
import pluginNode from "eslint-plugin-n";
import eslintPlugin from "eslint-plugin-eslint-plugin";
import tsParser from "@typescript-eslint/parser";

export default defineConfig([
    {
        name: "ignores",
        ignores: ["dist/**"],
    },
    {
        name: "typescript",
        files: ["**/*.ts"],
        languageOptions: {
            parser: tsParser,
        },
    },
    {
        name: "eslint/js",
        plugins: {
            js: pluginJs,
        },
        extends: ["js/recommended"],
    },
    {
        name: "eslint/node",
        plugins: {
            n: pluginNode,
        },
        extends: ["n/flat/mixed-esm-and-cjs"],
    },
    {
        name: "eslint/eslint-plugin",
        plugins: {
            "eslint-plugin": eslintPlugin,
        },
        extends: ["eslint-plugin/recommended"],
    }
]);

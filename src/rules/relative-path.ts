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
    `https://github.com/f1eeman/eslint-plugin-fsd-boundary/blob/main/docs/rules/${name}.md`,
);

export const relativePath = createRule<Options, MessageIds>({
  name: "relative-path",
  meta: {
    type: "problem",
    docs: {
      description:
        "Imports within a module must be relative; imports into another module must be absolute",
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
      shouldBeRelative: "Imports within the same module must be relative.",
      shouldBeAbsolute:
        "Imports into another module must be absolute (use the alias).",
    },
  },
  defaultOptions: [{ alias: "@" }],
  create: (context) => {
    const [{ alias = "@" } = {}] = context.options;
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

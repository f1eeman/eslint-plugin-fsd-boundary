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
    `https://github.com/f1eeman/eslint-plugin-fsd-boundary/blob/main/docs/rules/${name}.md`,
);

export const publicApi = createRule<Options, MessageIds>({
  name: "public-api",
  meta: {
    type: "problem",
    docs: {
      description:
        "Forbid imports bypassing a slice's Public API (for shared/app, require at least a segment)",
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
        "Absolute imports from slice '{{ slice }}' must go through its Public API. Deep imports are forbidden.",
      sharedSegmentRequired:
        "Imports from the '{{ layer }}' layer must target a segment (e.g. '{{ layer }}/ui'). Importing the bare layer is forbidden.",
    },
  },
  defaultOptions: [{ alias: "@", exceptions: [] }],
  create: (context) => {
    const [{ alias = "@", exceptions = [] } = {}] = context.options;
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

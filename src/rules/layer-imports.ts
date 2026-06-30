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
    const [{ alias = "@" } = {}] = context.options;
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

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

type Options = [{ alias?: string; exceptions?: string[] }];
type MessageIds = "layerViolation" | "crossSliceViolation";

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/f1eeman/eslint-plugin-fsd-boundary/blob/main/docs/rules/${name}.md`,
);

export const layerImports = createRule<Options, MessageIds>({
  name: "layer-imports",
  meta: {
    type: "problem",
    docs: {
      description:
        "Forbid importing higher layers into lower layers, and importing one slice into another slice of the same layer",
    },
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
      layerViolation:
        "FSD layer violation: a lower layer '{{ currentLayer }}' cannot import a higher layer '{{ targetLayer }}'.",
      crossSliceViolation:
        "Cross-slice import is forbidden: slice '{{ currentSlice }}' cannot import another slice '{{ targetSlice }}' of the same layer '{{ layer }}' (type-only imports are allowed).",
    },
  },
  defaultOptions: [{ alias: "@", exceptions: [] }],
  create: (context) => {
    const [{ alias = "@", exceptions = [] } = {}] = context.options;
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

        // Exceptions: skip imports whose layer-rooted path matches a prefix
        // (e.g. "app/providers/StoreProvider").
        const targetPath = target.segments.join("/");
        if (exceptions.some((exc) => targetPath.startsWith(exc))) {
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

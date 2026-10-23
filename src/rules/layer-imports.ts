import { AST_NODE_TYPES, ESLintUtils } from "@typescript-eslint/utils";
import {
  LAYERS_ORDER,
  parseImportTarget,
  resolveRelativeImport,
  getCurrentModule,
  getModuleKey,
  isInCurrentModule,
  isRelative,
  isSlicelessLayer,
  createModuleSourceVisitor,
  type Layer,
  getAlias,
} from "../lib/fsd.js";

type Options = [{ exceptions?: string[]; forbidForeignReexports?: boolean }];
type MessageIds =
  | "layerViolation"
  | "crossSliceViolation"
  | "foreignReexport";

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
    defaultOptions: [{ exceptions: [], forbidForeignReexports: false }],
    schema: [
      {
        type: "object",
        properties: {
          exceptions: {
            type: "array",
            items: { type: "string" },
            description:
              "Path prefixes (layer-rooted, without the alias) allowed to bypass layer and cross-slice checks.",
          },
          forbidForeignReexports: {
            type: "boolean",
            description:
              "Forbid re-exporting values from another FSD module (`export … from`, `export * from`).",
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      layerViolation:
        "FSD layer violation: a lower layer '{{ currentLayer }}' cannot import a higher layer '{{ targetLayer }}'.",
      crossSliceViolation:
        "Cross-slice import is forbidden: slice '{{ currentSlice }}' cannot import another slice '{{ targetSlice }}' of the same layer '{{ layer }}' (type-only imports are allowed).",
      foreignReexport:
        "Re-exporting another module '{{ module }}' is forbidden: import it directly from its Public API (type-only re-exports are allowed).",
    },
  },
  defaultOptions: [{ exceptions: [], forbidForeignReexports: false }],
  create: (context) => {
    const [{ exceptions = [], forbidForeignReexports = false } = {}] =
      context.options;
    const alias = getAlias(context.settings);
    const currentFilePath = context.filename.replace(/\\/g, "/");
    const currentModule = getCurrentModule(currentFilePath);

    return createModuleSourceVisitor(({ node, source, typeOnly }) => {
      if (!currentModule) {
        return;
      }
      if (typeOnly) {
        return;
      }

      const importPath = source.value;
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
        return;
      }

      const isReexport =
        node.type === AST_NODE_TYPES.ExportNamedDeclaration ||
        node.type === AST_NODE_TYPES.ExportAllDeclaration;
      if (
        forbidForeignReexports &&
        isReexport &&
        !isInCurrentModule(currentModule, target.segments)
      ) {
        context.report({
          node,
          messageId: "foreignReexport",
          data: { module: getModuleKey(target.layer, target.segments) },
        });
      }
    });
  },
});

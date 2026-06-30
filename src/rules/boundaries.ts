import { ESLintUtils, TSESTree } from "@typescript-eslint/utils";

type Options = [{
  alias?: string;
  exceptions?: string[];
}];

type MessageIds = "publicApiViolation" | "layerViolation";

const LAYERS_ORDER = ['shared', 'entities', 'features', 'widgets', 'pages', 'app'];

const parseFsdPath = (importPath: string, currentFilePath: string, alias: string) => {
  const cleanPath = importPath.startsWith(alias)
      ? importPath.replace(alias, '')
      : importPath;

  const segments = cleanPath.split('/').filter(Boolean);
  const targetLayer = segments[0];
  const targetSlice = segments[1];

  const currentLayer = LAYERS_ORDER.find((layer) => currentFilePath.includes(`/${layer}/`));

  return {
    targetLayer,
    targetSlice,
    isDeepImport: segments.length > 2,
    currentLayer,
    cleanPath
  };
};

const createRule = ESLintUtils.RuleCreator(
    (name) => `https://github.com/f1eeman/eslint-plugin-fsd-boundaries/blob/main/docs/rules/${name}.md`
);

export const boundaries = createRule<Options, MessageIds>({
  name: "boundaries",
  meta: {
    type: "problem",
    docs: {
      description: "Enforce FSD boundaries: validate layers and public API imports with exceptions support",
    },
    fixable: "code",
    defaultOptions: [{ alias: "@/", exceptions: [] }],
    schema: [
      {
        type: "object",
        properties: {
          alias: { type: "string" },
          exceptions: {
            type: "array",
            items: { type: "string" }
          }
        },
        additionalProperties: false,
      }
    ],
    messages: {
      publicApiViolation: "Absolute imports from slice '{{ slice }}' must be done only via Public API. Deep imports are forbidden.",
      layerViolation: "FSD layer violation: Cannot import upper layer '{{ targetLayer }}' into lower layer '{{ currentLayer }}'.",
    }
  },

  create: (context) => {
    const [{ alias = "@/", exceptions = [] }] = context.options;
    const currentFilePath = context.filename.replace(/\\/g, '/');

    return {
      ImportDeclaration: (node: TSESTree.ImportDeclaration) => {
        const importPath = node.source.value;

        if (!importPath.startsWith(alias) && !importPath.startsWith('.')) {
          return;
        }

        const { targetLayer, targetSlice, isDeepImport, currentLayer, cleanPath } = parseFsdPath(
            importPath,
            currentFilePath,
            alias
        );

        if (!LAYERS_ORDER.includes(targetLayer)) {
          return;
        }

        const isException = exceptions.some((exc) => cleanPath.startsWith(exc));
        if (isException) {
          return;
        }

        // 1. Проверка направления слоев
        if (currentLayer && targetLayer) {
          const currentOrder = LAYERS_ORDER.indexOf(currentLayer);
          const targetOrder = LAYERS_ORDER.indexOf(targetLayer);

          const isTypeImport = node.importKind === 'type';

          if (targetOrder > currentOrder && !isTypeImport) {
            context.report({
              node,
              messageId: "layerViolation",
              data: { targetLayer, currentLayer },
            });
            return;
          }
        }

        // 2. Проверка Public API (пропускаем shared)
        if (targetLayer !== 'shared' && isDeepImport) {
          // Вычисляем правильный путь до Public API слайса (например, "@/entities/user")
          const publicApi = `${alias}${targetLayer}/${targetSlice}`;

          context.report({
            node: node.source, // Подсвечиваем саму строку с путем импорта
            messageId: "publicApiViolation",
            data: { slice: targetSlice, publicApi },
            // ✅ Функция автофикса
            fix: (fixer) => {
              // Заменяем старый deep import на чистый путь Public API в тех же кавычках
              return fixer.replaceText(node.source, `'${publicApi}'`);
            },
          });
        }
      },
    };
  },
});
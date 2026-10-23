import { RuleTester } from "@typescript-eslint/rule-tester";
import { relativePath } from "../src/rules/relative-path.js";

const ruleTester = new RuleTester();

ruleTester.run("relative-path", relativePath, {
  valid: [
    {
      code: "export { StoreProvider } from './Provider';",
      filename: "/proj/src/app/store/index.ts",
    },
    {
      code: "export * from './button';",
      filename: "/proj/src/shared/ui/index.ts",
    },
    {
      code: "export { x } from './model/x';",
      filename: "/proj/src/features/foo/index.ts",
    },
    {
      code: "export * from './model/x';",
      filename: "/proj/src/features/foo/index.ts",
    },
    {
      code: "export const a = 1; export { a as b };",
      filename: "/proj/src/features/foo/index.ts",
    },
    {
      code: "const m = import('./Foo');",
      filename: "/proj/src/features/foo/ui/Foo.async.tsx",
    },
    {
      code: "const m = import(path);",
      filename: "/proj/src/features/foo/ui/Foo.async.tsx",
    },
    // относительный импорт внутри своего модуля — ок
    {
      code: "import { x } from '../model/x';",
      filename: "/proj/src/features/foo/ui/Foo.tsx",
    },
    // абсолютный импорт в чужой модуль — ок
    {
      code: "import { Bar } from '@/features/bar';",
      filename: "/proj/src/features/foo/ui/Foo.tsx",
    },
    // shared: относительный внутри своего unit — ок
    {
      code: "import { helper } from './helpers';",
      filename: "/proj/src/shared/ui/Card/Card.tsx",
    },
    // shared: абсолютный в другой unit того же сегмента — ок
    {
      code: "import { Button } from '@/shared/ui/Button';",
      filename: "/proj/src/shared/ui/Card/Card.tsx",
    },
  ],
  invalid: [
    // абсолютный импорт в свой модуль → должен быть относительным
    {
      code: "import { x } from '@/features/foo/model/x';",
      filename: "/proj/src/features/foo/ui/Foo.tsx",
      output: "import { x } from '../model/x';",
      errors: [{ messageId: "shouldBeRelative" }],
    },
    // shared: абсолютный в свой unit → относительный
    {
      code: "import { helper } from '@/shared/ui/Card/helpers';",
      filename: "/proj/src/shared/ui/Card/Card.tsx",
      output: "import { helper } from './helpers';",
      errors: [{ messageId: "shouldBeRelative" }],
    },
    // относительный импорт в чужой модуль → должен быть абсолютным
    {
      code: "import { Bar } from '../../bar/ui/Bar';",
      filename: "/proj/src/features/foo/ui/Foo.tsx",
      output: "import { Bar } from '@/features/bar/ui/Bar';",
      errors: [{ messageId: "shouldBeAbsolute" }],
    },
    // относительный кросс-слой → абсолютный
    {
      code: "import { cn } from '../../../shared/lib/cn';",
      filename: "/proj/src/features/foo/ui/Foo.tsx",
      output: "import { cn } from '@/shared/lib/cn';",
      errors: [{ messageId: "shouldBeAbsolute" }],
    },
    // пустой алиас Direction A: абсолютный в свой модуль → относительный
    {
      code: "import { x } from 'features/foo/model/x';",
      filename: "/proj/src/features/foo/ui/Foo.tsx",
      settings: { "fsd-boundaries": { alias: "" } },
      output: "import { x } from '../model/x';",
      errors: [{ messageId: "shouldBeRelative" }],
    },
    // пустой алиас Direction B: относительный cross-module → абсолютный без префикса
    {
      code: "import { Bar } from '../../bar/ui/Bar';",
      filename: "/proj/src/features/foo/ui/Foo.tsx",
      settings: { "fsd-boundaries": { alias: "" } },
      output: "import { Bar } from 'features/bar/ui/Bar';",
      errors: [{ messageId: "shouldBeAbsolute" }],
    },
    // кастомный алиас ~ Direction B: относительный cross-module → абсолютный с префиксом
    {
      code: "import { Bar } from '../../bar/ui/Bar';",
      filename: "/proj/src/features/foo/ui/Foo.tsx",
      settings: { "fsd-boundaries": { alias: "~" } },
      output: "import { Bar } from '~/features/bar/ui/Bar';",
      errors: [{ messageId: "shouldBeAbsolute" }],
    },
    {
      code: "export { x } from '@/features/foo/model/x';",
      filename: "/proj/src/features/foo/index.ts",
      output: "export { x } from './model/x';",
      errors: [{ messageId: "shouldBeRelative" }],
    },
    {
      code: "export * from '@/features/foo/model/x';",
      filename: "/proj/src/features/foo/index.ts",
      output: "export * from './model/x';",
      errors: [{ messageId: "shouldBeRelative" }],
    },
    {
      code: "export * from '../../bar/ui/Bar';",
      filename: "/proj/src/features/foo/ui/Foo.tsx",
      output: "export * from '@/features/bar/ui/Bar';",
      errors: [{ messageId: "shouldBeAbsolute" }],
    },
    {
      code: "const m = import('@/features/foo/ui/Foo');",
      filename: "/proj/src/features/foo/ui/Foo.async.tsx",
      output: "const m = import('./Foo');",
      errors: [{ messageId: "shouldBeRelative" }],
    },
    {
      code: "import { setupStore } from '@/app/store/store';",
      filename: "/proj/src/app/store/Provider.tsx",
      output: "import { setupStore } from './store';",
      errors: [{ messageId: "shouldBeRelative" }],
    },
    {
      code: "export { cn } from '../lib/cn';",
      filename: "/proj/src/shared/ui/index.ts",
      output: "export { cn } from '@/shared/lib/cn';",
      errors: [{ messageId: "shouldBeAbsolute" }],
    },
  ],
});

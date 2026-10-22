import { RuleTester } from "@typescript-eslint/rule-tester";
import { relativePath } from "../src/rules/relative-path";

const ruleTester = new RuleTester();

ruleTester.run("relative-path", relativePath, {
  valid: [
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
  ],
});

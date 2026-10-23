import { RuleTester } from "@typescript-eslint/rule-tester";
import { publicApi } from "../src/rules/public-api";

const ruleTester = new RuleTester();

ruleTester.run("public-api", publicApi, {
  valid: [
    {
      code: "export { User } from '@/entities/users';",
      filename: "/proj/src/pages/home/index.ts",
    },
    {
      code: "const m = import('@/entities/users');",
      filename: "/proj/src/pages/home/ui/Home.tsx",
    },
    // импорт через Public API слайса
    {
      code: "import { User } from '@/entities/users';",
      filename: "/proj/src/pages/home/ui/Home.tsx",
    },
    // shared с сегментом
    {
      code: "import { Button } from '@/shared/ui';",
      filename: "/proj/src/pages/home/ui/Home.tsx",
    },
    // shared глубже сегмента — разрешено
    {
      code: "import { Button } from '@/shared/ui/Button/Button';",
      filename: "/proj/src/pages/home/ui/Home.tsx",
    },
    // библиотека — пропуск
    {
      code: "import React from 'react';",
      filename: "/proj/src/pages/home/ui/Home.tsx",
    },
    // deep-импорт внутри своего же модуля — зона relative-path, тут молчим
    {
      code: "import { x } from '@/entities/users/model/x';",
      filename: "/proj/src/entities/users/ui/Card.tsx",
    },
    // исключение через опцию
    {
      code: "import { store } from '@/entities/users/testing';",
      filename: "/proj/src/pages/home/ui/Home.tsx",
      options: [{ exceptions: ["entities/users/testing"] }],
    },
    // пустой алиас — публичный API импорт
    {
      code: "import { User } from 'entities/users';",
      filename: "/proj/src/pages/home/ui/Home.tsx",
      settings: { "fsd-boundaries": { alias: "" } },
    },
  ],
  invalid: [
    // deep-импорт в чужой слайс → автофикс до Public API
    {
      code: "import { User } from '@/entities/users/model/user';",
      filename: "/proj/src/pages/home/ui/Home.tsx",
      output: "import { User } from '@/entities/users';",
      errors: [{ messageId: "publicApiViolation" }],
    },
    // сохранение двойных кавычек
    {
      code: 'import { User } from "@/entities/users/model/user";',
      filename: "/proj/src/pages/home/ui/Home.tsx",
      output: 'import { User } from "@/entities/users";',
      errors: [{ messageId: "publicApiViolation" }],
    },
    // голый shared без сегмента
    {
      code: "import x from '@/shared';",
      filename: "/proj/src/pages/home/ui/Home.tsx",
      errors: [{ messageId: "sharedSegmentRequired" }],
    },
    // голый app без сегмента
    {
      code: "import x from '@/app';",
      filename: "/proj/src/pages/home/ui/Home.tsx",
      errors: [{ messageId: "sharedSegmentRequired" }],
    },
    // пустой алиас — deep-импорт → автофикс до Public API
    {
      code: "import { User } from 'entities/users/model/user';",
      filename: "/proj/src/pages/home/ui/Home.tsx",
      settings: { "fsd-boundaries": { alias: "" } },
      output: "import { User } from 'entities/users';",
      errors: [{ messageId: "publicApiViolation" }],
    },
    // кастомный алиас ~ — deep-импорт → автофикс до Public API
    {
      code: "import { User } from '~/entities/users/model/user';",
      filename: "/proj/src/pages/home/ui/Home.tsx",
      settings: { "fsd-boundaries": { alias: "~" } },
      output: "import { User } from '~/entities/users';",
      errors: [{ messageId: "publicApiViolation" }],
    },
    // негативный тест exceptions: префикс не совпадает — исключение не применяется
    {
      code: "import { x } from '@/entities/users/model/x';",
      filename: "/proj/src/pages/home/ui/Home.tsx",
      options: [{ exceptions: ["entities/users/testing"] }],
      output: "import { x } from '@/entities/users';",
      errors: [{ messageId: "publicApiViolation" }],
    },
    {
      code: "export { User } from '@/entities/users/model/user';",
      filename: "/proj/src/pages/home/index.ts",
      output: "export { User } from '@/entities/users';",
      errors: [{ messageId: "publicApiViolation" }],
    },
    {
      code: "export * from '@/entities/users/model/user';",
      filename: "/proj/src/pages/home/index.ts",
      output: "export * from '@/entities/users';",
      errors: [{ messageId: "publicApiViolation" }],
    },
    {
      code: "const m = import('@/entities/users/model/user');",
      filename: "/proj/src/pages/home/ui/Home.tsx",
      output: null,
      errors: [{ messageId: "publicApiViolation" }],
    },
    {
      code: "export * from '@/shared';",
      filename: "/proj/src/pages/home/index.ts",
      errors: [{ messageId: "sharedSegmentRequired" }],
    },
  ],
});

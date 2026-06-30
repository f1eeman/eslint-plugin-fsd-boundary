import { RuleTester } from "@typescript-eslint/rule-tester";
import { layerImports } from "../src/rules/layer-imports";

const ruleTester = new RuleTester();

ruleTester.run("layer-imports", layerImports, {
  valid: [
    // нижележащий импортирует ещё ниже — ок
    {
      code: "import { Button } from '@/shared/ui';",
      filename: "/proj/src/features/foo/ui/Foo.tsx",
    },
    // вышележащий импортирует нижележащий — ок
    {
      code: "import { User } from '@/entities/users';",
      filename: "/proj/src/pages/home/ui/Home.tsx",
    },
    // импорт вышележащего слоя, но type — ок
    {
      code: "import type { Page } from '@/pages/home';",
      filename: "/proj/src/features/foo/ui/Foo.tsx",
    },
    // cross-slice, но type — ок
    {
      code: "import type { Bar } from '@/features/bar';",
      filename: "/proj/src/features/foo/ui/Foo.tsx",
    },
    // импорт в тот же слайс — зона relative-path, тут молчим
    {
      code: "import { x } from '@/features/foo/model/x';",
      filename: "/proj/src/features/foo/ui/Foo.tsx",
    },
    // кросс-сегмент внутри shared — норма
    {
      code: "import { cn } from '@/shared/lib';",
      filename: "/proj/src/shared/ui/Button/Button.tsx",
    },
    // библиотека — пропуск
    {
      code: "import React from 'react';",
      filename: "/proj/src/shared/ui/Button/Button.tsx",
    },
  ],
  invalid: [
    // нижележащий импортирует вышележащий
    {
      code: "import { Foo } from '@/features/foo';",
      filename: "/proj/src/entities/users/ui/Card.tsx",
      errors: [{ messageId: "layerViolation" }],
    },
    // cross-slice в том же слое (значение)
    {
      code: "import { Bar } from '@/features/bar';",
      filename: "/proj/src/features/foo/ui/Foo.tsx",
      errors: [{ messageId: "crossSliceViolation" }],
    },
    // смешанный импорт (type + value) — не пропускается
    {
      code: "import { type Bar, makeBar } from '@/features/bar';",
      filename: "/proj/src/features/foo/ui/Foo.tsx",
      errors: [{ messageId: "crossSliceViolation" }],
    },
    // относительный cross-slice тоже ловится
    {
      code: "import { Bar } from '../../bar/ui/Bar';",
      filename: "/proj/src/features/foo/ui/Foo.tsx",
      errors: [{ messageId: "crossSliceViolation" }],
    },
  ],
});

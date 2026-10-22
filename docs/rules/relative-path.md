# Enforce relative imports within a module, absolute across modules (`relative-path`)

🔧 This rule is automatically fixable by the [`--fix` CLI option](https://eslint.org/docs/latest/use/command-line-interface#--fix), in both directions.

## Rule Details

This rule keeps import style consistent with module boundaries:

- Imports **within the current module** must be **relative** (`../model/x`).
- Imports **into another module** must be **absolute** (`@/features/bar`).

A "module" is:

- `layer/slice` for sliced layers (`entities`, `features`, `widgets`, `pages`) — e.g. `features/foo`;
- `layer/segment/unit` for sliceless layers (`shared`, `app`) — e.g. `shared/ui/Card`.

Path math is computed **symbolically** (no filesystem access, no dependency on the alias-to-disk mapping) and normalized to forward slashes, so results are identical on Windows and POSIX.

Examples of **incorrect** code for this rule:

```js
// In src/features/foo/ui/Foo.tsx (module = features/foo)

// absolute import into your own module → should be relative
import { x } from "@/features/foo/model/x";

// relative import into another module → should be absolute
import { Bar } from "../../bar/ui/Bar";
```

Examples of **correct** code for this rule:

```js
// In src/features/foo/ui/Foo.tsx
import { x } from "../model/x";              // same module → relative
import { Bar } from "@/features/bar/ui/Bar"; // other module → absolute

// In src/shared/ui/Card/Card.tsx (module = shared/ui/Card)
import { helper } from "./helpers";          // same module → relative
import { Button } from "@/shared/ui/Button"; // other module → absolute
```

Autofix rewrites each violation to the correct form:

```js
import { x } from "@/features/foo/model/x"; // → "../model/x"
import { Bar } from "../../bar/ui/Bar";      // → "@/features/bar/ui/Bar"
```

The original quote style (`'` or `"`) is preserved.

## Options

This rule has no options.

The alias used both to recognize and to build absolute paths is shared by all rules and set once in `settings["fsd-boundaries"].alias` (default `"@"`). With an empty string `""`, absolute imports are bare layer-rooted paths (`features/bar/ui/Bar`). See [Alias configuration](../../README.md#alias-configuration).

```js
"fsd-boundaries/relative-path": "error"
```

## When Not To Use It

If you do not care whether intra-module imports are relative or absolute, or you use a different convention for module-local imports.

## Further Reading

- [Feature-Sliced Design — Public API](https://feature-sliced.design/docs/reference/public-api)

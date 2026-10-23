# eslint-plugin-fsd-boundaries

> ESLint plugin that enforces [Feature-Sliced Design](https://feature-sliced.design/) import boundaries — with autofixes.

It ships three focused rules that keep imports honest in an FSD codebase:

| Rule | What it enforces | Autofix |
| --- | --- | --- |
| [`public-api`](./docs/rules/public-api.md) | Slices may only be imported through their Public API; `shared`/`app` imports must target a segment | ✅ |
| [`layer-imports`](./docs/rules/layer-imports.md) | A layer may only import lower layers; one slice may not import a sibling slice of the same layer | — |
| [`relative-path`](./docs/rules/relative-path.md) | Imports inside a module must be relative; imports into another module must be absolute | ✅ (both directions) |

## The FSD layers

Imports are validated against the standard layer hierarchy (low → high):

```
shared → entities → features → widgets → pages → app
```

A layer may import from the layers **below** it, never above. `shared` and `app` have no slices — they are organized by segment (`shared/ui`, `shared/lib`, `app/providers`, …).

## Installation

```sh
npm install --save-dev eslint-plugin-fsd-boundaries
# or
yarn add -D eslint-plugin-fsd-boundaries
```

Requires ESLint `>=9.15` (flat config).

## Usage

### Recommended config

```js
// eslint.config.js
import fsdBoundaries from "eslint-plugin-fsd-boundaries";

export default [
  fsdBoundaries.configs.recommended,
];
```

This enables all three rules as errors with the default alias `@`.

### Manual config

```js
// eslint.config.js
import fsdBoundaries from "eslint-plugin-fsd-boundaries";

export default [
  {
    plugins: { "fsd-boundaries": fsdBoundaries },
    rules: {
      "fsd-boundaries/public-api": "error",
      "fsd-boundaries/layer-imports": "error",
      "fsd-boundaries/relative-path": "error",
    },
  },
];
```

## Alias configuration

The alias used to recognize and build absolute FSD imports is shared by all rules and set once in `settings` (default `"@"`):

```js
export default [
  fsdBoundaries.configs.recommended,
  {
    settings: {
      "fsd-boundaries": { alias: "~" }, // matches "~/entities/users"
    },
  },
];
```

Set `alias` to an **empty string** if your project uses bare layer-rooted imports:

```js
settings: {
  "fsd-boundaries": { alias: "" }, // matches "entities/users"
},
```

Imports whose first segment is not an FSD layer (e.g. `react`, `@scope/pkg`) are treated as library imports and ignored.

## What is checked

All rules inspect every statement that points at another module, not only `import`:

```ts
import { Foo } from "@/features/foo";       // static import
export { Foo } from "@/features/foo";       // named re-export
export * from "@/features/foo";             // re-export all
const m = await import("@/features/foo");   // dynamic import (string literal only)
```

So a barrel such as `features/foo/index.ts` cannot hide a deep or cross-slice dependency behind `export … from`.

`type`-only statements are treated the same way for imports and re-exports: `import type …`, `export type … from`, `export type * from`, and specifier lists where every item is inline `type` (`export { type Foo } from …`).

## Rules

### `public-api`

📖 [Full documentation](./docs/rules/public-api.md)

Forbids reaching past a slice's Public API.

```ts
// ❌ deep import bypasses the slice barrel
import { mapUser } from "@/entities/users/model/mapUser";
// ✅ autofixed to
import { mapUser } from "@/entities/users";

// shared / app are segment-based: a segment is required
import x from "@/shared";          // ❌ bare layer — error (no autofix)
import { Button } from "@/shared/ui"; // ✅
import { Button } from "@/shared/ui/Button/Button"; // ✅ deeper is allowed
```

Deep dynamic imports (`import("@/entities/users/model/user")`) are reported **without** an autofix: the Public API module exports a different shape, so rewriting the path could break code such as `.then((m) => m.default)`.

Imports that point inside the **current** file's own module are left to `relative-path` (no conflict).

**Options:** `{ exceptions?: string[] }`. Paths whose clean form starts with any `exceptions` prefix are skipped (e.g. `exceptions: ["entities/users/testing"]`).

### `layer-imports`

📖 [Full documentation](./docs/rules/layer-imports.md)

Two checks, both skipping `type`-only imports (`import type …` and inline `import { type Foo }`):

```ts
// In src/entities/users/ui/Card.tsx:
import { Foo } from "@/features/foo"; // ❌ entities cannot import the higher layer features

// In src/features/foo/ui/Foo.tsx:
import { Bar } from "@/features/bar"; // ❌ a feature cannot import a sibling feature (cross-slice)
import type { Bar } from "@/features/bar"; // ✅ type-only is allowed
```

Cross-slice is only checked for sliced layers; cross-segment imports inside `shared`/`app` are fine.

**Options:** `{ exceptions?: string[]; forbidForeignReexports?: boolean }`.

`exceptions` is a list of layer-rooted path prefixes allowed to bypass both checks — handy for the classic "type the store in a lower layer" case:

```js
"fsd-boundaries/layer-imports": ["error", {
  exceptions: ["app/providers/StoreProvider"],
}]
```

(If the import is type-only — `import type { StateSchema } from "@/app/providers/StoreProvider"` — it is already allowed without an exception.)

`forbidForeignReexports: true` additionally forbids re-exporting values from another FSD module (`export * from "@/features/bar"` in `widgets/sidebar/index.ts`). Own-module, npm-package, `type`-only and `exceptions` re-exports stay allowed.

### `relative-path`

📖 [Full documentation](./docs/rules/relative-path.md)

Keeps import style consistent with module boundaries.

```ts
// In src/features/foo/ui/Foo.tsx (module = features/foo):
import { x } from "@/features/foo/model/x"; // ❌ same module → must be relative
import { x } from "../model/x";             // ✅ (autofix target)

import { Bar } from "../../bar/ui/Bar";     // ❌ different module → must be absolute
import { Bar } from "@/features/bar/ui/Bar"; // ✅ (autofix target)
```

A "module" is `layer/slice` for sliced layers, and `layer/segment/unit` (e.g. `shared/ui/Card`) for `shared`/`app`. Files that sit directly in a `shared`/`app` segment folder (e.g. `app/store/index.ts`, `app/store/Provider.tsx`) belong to the whole segment, so they import its units relatively:

```ts
// In src/app/store/index.ts:
export { StoreProvider } from "./Provider"; // ✅ same segment
// In src/app/store/Provider.tsx:
import { setupStore } from "@/app/store/store"; // ❌ → "./store"
```

Path math is computed symbolically, so it works identically on Windows and POSIX.

**Options:** none.

## Development

```sh
yarn test        # run rule tests (vitest)
yarn typecheck   # type-check src and tests
yarn build       # build dist with tsup
```

`prepublishOnly` runs `typecheck`, `test` and `build` in that order, so a release cannot be published with failing types or tests.

## License

MIT

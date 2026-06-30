# Enforce FSD layer boundaries (`layer-imports`)

## Rule Details

Feature-Sliced Design arranges code into layers with a strict direction. From lowest to highest:

```
shared → entities → features → widgets → pages → app
```

This rule enforces two boundaries:

1. **Layer direction** — a layer may only import from layers **below** it. A lower layer importing a higher one (e.g. `entities` importing `features`) is forbidden.
2. **Cross-slice isolation** — within a sliced layer, one slice may not import a **sibling slice** of the same layer (e.g. `features/foo` importing `features/bar`). This keeps slices independent. Sliceless layers (`shared`, `app`) are exempt — cross-segment imports such as `shared/ui` → `shared/lib` are normal.

`type`-only imports are exempt from **both** checks. An import counts as type-only when it is `import type … ` (`importKind === "type"`) **or** every specifier is an inline `type` (`import { type Foo }`). A mixed import (some type, some value) is treated as a value import.

Both absolute (`@/features/bar`) and relative (`../../bar`) imports are resolved to their layer/slice and checked. This rule has **no autofix** — the right fix depends on intent (extract to a lower layer, go through a barrel, etc.).

Examples of **incorrect** code for this rule:

```js
// In src/entities/users/ui/Card.tsx
import { Foo } from "@/features/foo"; // entities (lower) importing features (higher)

// In src/features/foo/ui/Foo.tsx
import { Bar } from "@/features/bar";        // sibling slice of the same layer
import { Bar } from "../../bar/ui/Bar";      // same violation via a relative path
import { type Bar, makeBar } from "@/features/bar"; // mixed import — still a value import
```

Examples of **correct** code for this rule:

```js
// In src/features/foo/ui/Foo.tsx
import { User } from "@/entities/users"; // importing a lower layer — OK
import { Button } from "@/shared/ui";    // importing shared — OK
import type { Bar } from "@/features/bar"; // type-only — allowed

// In src/shared/ui/Button/Button.tsx
import { cn } from "@/shared/lib"; // cross-segment inside shared — allowed
```

## Options

```ts
type Options = {
  alias?: string; // default: "@"
};
```

- **`alias`** — the absolute-import alias. Defaults to `"@"`. Set to your own alias, or to `""` for bare layer-rooted imports.

```js
"fsd-boundaries/layer-imports": ["error", { alias: "@" }]
```

## When Not To Use It

If your project does not enforce a strict layer hierarchy, or you allow cross-imports between slices of the same layer (for example, via an explicit cross-import convention you manage differently).

## Further Reading

- [Feature-Sliced Design — Layers](https://feature-sliced.design/docs/reference/layers)
- [Feature-Sliced Design — Import rules on layers](https://feature-sliced.design/docs/reference/layers#import-rule-on-layers)

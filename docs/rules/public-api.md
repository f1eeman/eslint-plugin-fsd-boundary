# Enforce imports through the Public API (`public-api`)

🔧 This rule is automatically fixable by the [`--fix` CLI option](https://eslint.org/docs/latest/use/command-line-interface#--fix).

## Rule Details

In Feature-Sliced Design every slice exposes a **Public API** (its `index` barrel). Other slices must import from that barrel, not reach into the slice's internals. This rule forbids such deep imports.

The sliceless layers `shared` and `app` are organized by segment (`shared/ui`, `app/providers`, …) rather than by slice. For them the rule requires that an import targets **at least a segment** — a bare `@/shared` / `@/app` import is not allowed — but imports deeper than the segment are fine.

Imports that point inside the **current file's own module** are ignored here; converting those to relative paths is the job of [`relative-path`](./relative-path.md), so the two rules never fight over the same line.

Imports whose first segment is not an FSD layer (`react`, `@scope/pkg`, …) are treated as library imports and ignored.

Examples of **incorrect** code for this rule:

```js
// deep import bypasses the slice's Public API
import { mapUser } from "@/entities/users/model/mapUser";

// sliceless layer without a segment
import something from "@/shared";
import something from "@/app";
```

Examples of **correct** code for this rule:

```js
// through the Public API
import { mapUser } from "@/entities/users";

// shared/app with a segment (and deeper) are allowed
import { Button } from "@/shared/ui";
import { Button } from "@/shared/ui/Button/Button";

// library imports are ignored
import React from "react";

// an import into the current file's own module is handled by `relative-path`
// (see that rule), not reported here
```

With autofix, the deep import above becomes:

```js
import { mapUser } from "@/entities/users";
```

(The `shared`/`app` "segment required" violation is not autofixable — the rule cannot guess which segment you meant.)

## Options

```ts
type Options = {
  alias?: string;        // default: "@"
  exceptions?: string[]; // default: []
};
```

- **`alias`** — the absolute-import alias. Defaults to `"@"` (matching `@/entities/users`). Set it to your own alias (e.g. `"~"`), or to an empty string `""` if your project uses bare layer-rooted imports (`entities/users`).
- **`exceptions`** — a list of path prefixes (in clean form, without the alias) that are exempt from the check, e.g. `["entities/users/testing"]`. Matching is prefix-based (`startsWith`).

```js
"fsd-boundaries/public-api": ["error", {
  alias: "@",
  exceptions: ["entities/users/testing"],
}]
```

## When Not To Use It

If your project does not follow the Public API convention, or you intentionally allow deep imports into slices.

## Further Reading

- [Feature-Sliced Design — Public API](https://feature-sliced.design/docs/reference/public-api)

# Enforce imports through the Public API (`public-api`)

🔧 This rule is automatically fixable by the [`--fix` CLI option](https://eslint.org/docs/latest/use/command-line-interface#--fix).

## Rule Details

In Feature-Sliced Design every slice exposes a **Public API** (its `index` barrel). Other slices must import from that barrel, not reach into the slice's internals. This rule forbids such deep imports.

The sliceless layers `shared` and `app` are organized by segment (`shared/ui`, `app/providers`, …) rather than by slice. For them the rule requires that an import targets **at least a segment** — a bare `@/shared` / `@/app` import is not allowed — but imports deeper than the segment are fine.

Imports that point inside the **current file's own module** are ignored here; converting those to relative paths is the job of [`relative-path`](./relative-path.md), so the two rules never fight over the same line.

Imports whose first segment is not an FSD layer (`react`, `@scope/pkg`, …) are treated as library imports and ignored.

The rule checks every statement that points at another module: `import … from`, `export … from`, `export * from` and dynamic `import("…")` with a string literal. A barrel therefore cannot re-export a slice's internals either.

Examples of **incorrect** code for this rule:

```js
// deep import bypasses the slice's Public API
import { mapUser } from "@/entities/users/model/mapUser";

// the same through a re-export (e.g. in src/pages/home/index.ts)
export { mapUser } from "@/entities/users/model/mapUser";
export * from "@/entities/users/model/mapUser";

// deep dynamic import
const UserCard = lazy(() => import("@/entities/users/ui/UserCard"));

// sliceless layer without a segment
import something from "@/shared";
import something from "@/app";
export * from "@/shared";
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

With autofix, the deep import and re-exports above become:

```js
import { mapUser } from "@/entities/users";
export { mapUser } from "@/entities/users";
export * from "@/entities/users";
```

Not autofixable:

- the `shared`/`app` "segment required" violation — the rule cannot guess which segment you meant;
- a deep dynamic `import("…")` — the Public API module has a different shape than the deep file. For example, `lazy()` needs a `default` export that `UserCard.tsx` has and `entities/users/index.ts` does not, so rewriting the path would compile but break at runtime. Fix the path by hand.

## Options

The absolute-import alias is not a rule option — it is shared by all rules and set once in `settings["fsd-boundaries"].alias` (default `"@"`). See [Alias configuration](../../README.md#alias-configuration).

```ts
type Options = {
  exceptions?: string[]; // default: []
};
```

- **`exceptions`** — a list of path prefixes (in clean form, without the alias) that are exempt from the check, e.g. `["entities/users/testing"]`. Matching is prefix-based (`startsWith`).

```js
"fsd-boundaries/public-api": ["error", {
  exceptions: ["entities/users/testing"],
}]
```

## When Not To Use It

If your project does not follow the Public API convention, or you intentionally allow deep imports into slices.

## Further Reading

- [Feature-Sliced Design — Public API](https://feature-sliced.design/docs/reference/public-api)

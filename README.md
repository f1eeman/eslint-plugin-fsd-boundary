# eslint-plugin-fsd-boundaries

ESLint plugin for FSD architecture compliance (layers and public API check)

## Installation

You'll first need to install [ESLint](https://eslint.org/):

```sh
npm i eslint --save-dev
```

Next, install `eslint-plugin-fsd-boundaries`:

```sh
npm install eslint-plugin-fsd-boundaries --save-dev
```

## Usage

In your [configuration file](https://eslint.org/docs/latest/use/configure/configuration-files#configuration-file), import the plugin `eslint-plugin-fsd-boundaries` and add `fsd-boundaries` to the `plugins` key:

```js
import { defineConfig } from "eslint/config";
import fsd-boundaries from "eslint-plugin-fsd-boundaries";

export default defineConfig([
    {
        plugins: {
            fsd-boundaries
        }
    }
]);
```


Then configure the rules you want to use under the `rules` key.

```js
import { defineConfig } from "eslint/config";
import fsd-boundaries from "eslint-plugin-fsd-boundaries";

export default defineConfig([
    {
        plugins: {
            fsd-boundaries
        },
        rules: {
            "fsd-boundaries/rule-name": "warn"
        }
    }
]);
```



## Configurations

<!-- begin auto-generated configs list -->
TODO: Run eslint-doc-generator to generate the configs list (or delete this section if no configs are offered).
<!-- end auto-generated configs list -->



## Rules

<!-- begin auto-generated rules list -->
TODO: Run eslint-doc-generator to generate the rules list.
<!-- end auto-generated rules list -->



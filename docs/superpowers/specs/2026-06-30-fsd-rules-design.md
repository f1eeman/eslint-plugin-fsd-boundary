# Дизайн: разбиение FSD-плагина на три правила

Дата: 2026-06-30

## Цель

Переработать `eslint-plugin-fsd-boundaries`: вместо одного объединённого правила
`boundaries` сделать три независимых правила, как принято в FSD-плагинах:

1. `public-api` — запрет импортов мимо Public API слайса (+ автофикс).
2. `layer-imports` — запрет импорта вышележащих слоёв в нижележащие.
3. `relative-path` — импорты внутри своего слайса должны быть относительными,
   а импорты в чужой модуль — абсолютными (+ автофикс в обе стороны).

Старое правило `boundaries` удаляется полностью (плагин ещё не опубликован,
обратная совместимость не требуется).

## Структура файлов

```
src/
  rules/
    public-api.ts       # запрет deep-импортов мимо Public API (+автофикс)
    layer-imports.ts    # запрет импорта вышележащих слоёв в нижележащие
    relative-path.ts    # относительность импортов внутри слайса (+автофикс)
    boundaries.ts       # УДАЛЯЕТСЯ (старое объединённое правило)
  lib/
    fsd.ts              # общие хелперы парсинга путей
  index.ts              # регистрация 3 правил + configs.recommended
tests/
  public-api.test.ts
  layer-imports.test.ts
  relative-path.test.ts
```

## Алиас и отделение библиотек от слоёв

- Алиас общий для всех правил и задаётся один раз в `settings` конфига ESLint:
  `settings: { "fsd-boundaries": { alias: "~" } }`. **Дефолт — `'@'`.**
  Опции `alias` у правил нет (удалена в 2.0.0).
- Чтение: `getAlias(context.settings)` — берёт `settings["fsd-boundaries"].alias`,
  если это строка, иначе возвращает `'@'`.
- Алиас **может быть пустой строкой** (`""`) — тогда пользователь пишет
  bare-импорты вида `entities/users/ui/Card`.
- Нормализация: `normalizedAlias = alias.replace(/\/+$/, '')` (срезаем хвостовые
  слеши). Для `@` → `@`, для `""` → `""`.

Определение «это FSD-импорт слоя» (в `parseImportTarget`):
1. Если импорт относительный (`isRelative`) → не альяс-импорт (обрабатывается
   отдельно в `relative-path`).
2. Вычисляем `cleanPath`:
   - `normalizedAlias` непустой → импорт обязан начинаться с
     `normalizedAlias + '/'`, иначе `null`; `cleanPath` = остаток после префикса.
   - `normalizedAlias` пустой → `cleanPath` = сам импорт (как есть).
3. Первый сегмент `cleanPath` обязан входить в `LAYERS_ORDER`, иначе `null`
   (библиотека / не-FSD путь).

Примеры (alias = `@`):
- `@/entities/users` → префикс `@/` есть, `entities` — слой → проверяем.
- `@some-package` → не начинается с `@/` → библиотека → пропуск.
- `@/some-package` → префикс `@/` есть, но `some-package` не слой → пропуск.
- `react`, `lodash`, `@scope/pkg` → не FSD → пропуск.

Примеры (alias = `""`):
- `entities/users/ui/Card` → первый сегмент `entities` — слой → проверяем.
- `react`, `lodash` → первый сегмент не слой → библиотека → пропуск.
- `@scope/pkg` → первый сегмент `@scope` не слой → пропуск.

**Known limitation:** при пустом алиасе библиотеку с именем слоя
(`import x from 'shared'`) не отличить от FSD-импорта — это осознанная плата за
bare-импорты.

## Кросс-платформенная работа с путями

ОС учитываем, но **без** `path.toNamespacedPath()` (он не нормализует слеши для
наших целей — на POSIX no-op, на Windows лишь добавляет префикс `\\?\`).

Принцип:
- `context.filename` нормализуем в forward-slash: `.replace(/\\/g, '/')`.
- Все вычисления путей делаем через **`path.posix.*`** (не нативный `path.*`),
  чтобы на выходе всегда были `/` — именно это нужно в `import`-строке вне
  зависимости от ОС.
- При сборке путей не конкатенируем строки вручную (иначе `//`), а используем
  `path.posix.relative` / split с `filter(Boolean)`.
- **Реальные ФС-абсолютные пути и маппинг алиаса на диск не нужны** — относительный
  путь считается символически:
  - Направление A: `path.posix.relative(dirname(хвост_файла_после_layer/slice),
    хвост_цели_после_layer/slice)`, затем `./` если не начинается с `.`.
  - Направление B: резолв относительного импорта от forward-slash пути файла,
    поиск сегмента-слоя, сборка `<alias>/<layer>/<...>`.

## Общие хелперы (`src/lib/fsd.ts`)

- `LAYERS_ORDER = ['shared', 'entities', 'features', 'widgets', 'pages', 'app']`
  — индекс = «высота» слоя (0 = самый нижний `shared`).
- `SLICELESS_LAYERS = ['shared', 'app']` — слои без слайсов (Public API на
  уровне сегмента).
- `normalizeAlias(alias)` — срезает хвостовые `/`.
- `isRelative(path)` — `path === '.'` или начинается с `./` / `../`.
- `isTypeOnlyImport(node)` — `node.importKind === 'type'` или все
  `node.specifiers` помечены `importKind === 'type'` (инлайновый `type`).
- `parseImportTarget(importPath, alias)` — по логике из раздела «Алиас и
  отделение библиотек» (учитывает пустой алиас): возвращает
  `{ layer, slice, segments, cleanPath }`, если это FSD-импорт слоя, иначе `null`.
- `getModuleKey(layer, segments)` — ключ «модуля» для `relative-path`. Глубина
  зависит от слоя: слайс-слои → 2 сегмента (`layer/slice`); слои без слайсов
  (`SLICELESS_LAYERS`) → 3 сегмента (`layer/segment/unit`, например
  `shared/ui/Card`). Возвращает `segments.slice(0, depth).join('/')`. В `shared`
  сегмент есть всегда, поэтому минимум `layer/segment` гарантирован.
- `getCurrentModule(filePath)` — по абсолютному пути файла (слеши нормализованы
  на `/`) находит `layer` (первый сегмент из `LAYERS_ORDER`) и вычисляет ключ
  модуля через `getModuleKey` **по сегментам директории (без имени файла)**, с
  ограничением доступной глубиной. Так barrel-файл прямо в сегменте
  (`shared/ui/index.ts`) относится к модулю `shared/ui`, а не `shared/ui/index.ts`.
  Возвращает `null`, если файл вне слоёв.

Назначение — убрать дублирование логики между тремя правилами.

## Правило `public-api`

- Тип: `problem`, `fixable: "code"`.
- Срабатывает на FSD-импортах слоя (`parseImportTarget` ≠ null). Не-FSD —
  пропуск.
- **Пропуск внутримодульных импортов**: если ключ модуля цели совпадает с ключом
  модуля текущего файла (`getCurrentModule`), правило молчит — это зона
  `relative-path` (иначе автофиксы двух правил конфликтуют на одной строке).
- Исключения: опция `exceptions: string[]` — если `cleanPath` начинается с
  одного из значений, пропуск.

Слои со слайсами (`entities`, `features`, `widgets`, `pages`):
- Public API находится на уровне `layer/slice`.
- Если глубина импорта > 2 сегментов (deep import) → ошибка
  `publicApiViolation`.
- **Автофикс**: заменяет источник импорта на `<alias>/<layer>/<slice>`
  (в одинарных кавычках).

Слои без слайсов (`SLICELESS_LAYERS = ['shared', 'app']`, структура
`<layer>/<segment>/...`):
- Обязателен **минимум один сегмент** после слоя: `@/shared/ui`, `@/app/providers`.
- `@/shared` / `@/app` (только слой, без сегмента) → ошибка
  `sharedSegmentRequired` (без автофикса — неизвестно, какой сегмент имелся
  в виду).
- Глубже сегмента — **разрешено** (`@/shared/ui/Button/Button.tsx` ок),
  ограничения на глубину для этих слоёв нет.

- Опции: `{ exceptions: [] }`.

## Правило `layer-imports`

- Тип: `problem`, без автофикса.
- Определяет `currentLayer` (по пути файла) и `targetLayer` (по импорту).
- Работает и для абсолютных, и для относительных импортов (для относительных
  целевой слой определяется через резолв пути — см. `relative-path`; если слой
  не определяется, пропуск).
- **Проверка направления слоёв.** Если
  `LAYERS_ORDER.indexOf(targetLayer) > LAYERS_ORDER.indexOf(currentLayer)`
  → ошибка `layerViolation` (нижележащий слой не может импортировать
  вышележащий).
- **Проверка cross-slice внутри слоя.** Если `currentLayer === targetLayer`,
  слой — слайс-слой (НЕ из `SLICELESS_LAYERS`) и `currentSlice !== targetSlice`
  → ошибка `crossSliceViolation` (слайс не может импортировать другой слайс того
  же слоя, например `features/foo` → `features/bar`). Импорт в тот же слайс
  (`currentSlice === targetSlice`) тут не проверяется — это зона `relative-path`.
- `type`-импорты пропускаются для **обеих** проверок. «Типовым» считается импорт,
  у которого `node.importKind === 'type'` **или** все спецификаторы помечены
  `type` (инлайновый `import { type Foo }`). Хелпер `isTypeOnlyImport(node)`.
- Опции: `{ exceptions: [] }`.

## Правило `relative-path`

Двунаправленное. «Модуль» (`getModuleKey`):
- слайс-слои (`entities`, `features`, `widgets`, `pages`) → `layer/slice`
  (2 сегмента);
- слои без слайсов (`shared`, `app`) → `layer/segment/unit` (3 сегмента,
  например `shared/ui/Card`).

- Тип: `problem`, `fixable: "code"`.
- Определяет ключ модуля текущего файла (`getCurrentModule`). Если файл вне
  FSD-слоёв — пропуск.

Направление A — **абсолютный импорт в свой модуль**:
- Импорт распознан как FSD-импорт слоя (`parseImportTarget` ≠ null), его ключ
  модуля совпадает с ключом модуля текущего файла.
- → ошибка `shouldBeRelative`.
- **Автофикс** (символьно, см. раздел про пути): берём «хвост» текущего файла и
  цели после ключа модуля, считаем
  `path.posix.relative(posix.dirname(хвост_файла), хвост_цели)`, добавляем `./`
  если результат не начинается с `.`.

Направление B — **относительный импорт в чужой модуль**:
- Импорт относительный (`isRelative`), но после резолва от директории текущего
  файла попадает в другой модуль (другой ключ `getModuleKey`).
- → ошибка `shouldBeAbsolute`.
- **Автофикс**: резолвим относительный путь, находим в нём сегмент-слой из
  `LAYERS_ORDER`, собираем `<normalizedAlias>/<layer>/<...остаток>`.

- Опций нет.

## `src/index.ts`

```ts
rules: {
  "public-api": publicApi,
  "layer-imports": layerImports,
  "relative-path": relativePath,
}
configs.recommended.rules: {
  "fsd-boundaries/public-api": "error",
  "fsd-boundaries/layer-imports": "error",
  "fsd-boundaries/relative-path": "error",
}
```

`meta.version` берётся из `package.json` (выровнять версии — см. ниже).

## Сообщения

- `public-api` → `publicApiViolation`: deep-импорты запрещены, используйте Public API.
- `public-api` → `sharedSegmentRequired`: импорт из слоя без слайсов
  (`{{ layer }}`) должен указывать сегмент (например `shared/ui`), импорт голого
  слоя запрещён.
- `layer-imports` → `layerViolation`: нельзя импортировать вышележащий слой
  `{{ targetLayer }}` в нижележащий `{{ currentLayer }}`.
- `layer-imports` → `crossSliceViolation`: слайс `{{ currentSlice }}` не может
  импортировать другой слайс `{{ targetSlice }}` того же слоя `{{ layer }}`
  (кроме `type`-импортов).
- `relative-path` → `shouldBeRelative`: импорт внутри своего модуля должен быть
  относительным.
- `relative-path` → `shouldBeAbsolute`: импорт в чужой модуль должен быть
  абсолютным (через алиас).

## Тесты

- Раннер: **vitest**.
- `@typescript-eslint/rule-tester` `RuleTester` для каждого правила.
- На каждое правило: набор `valid` и `invalid` кейсов, для fixable-правил —
  проверка `output` (результат автофикса).
- Скрипт `test` в `package.json`: `vitest run`.

## Сопутствующие правки

- `defaultOptions` сейчас лежит внутри `meta` (неверно для
  `ESLintUtils.RuleCreator`) — вынести на верхний уровень объекта правила.
- Рассинхрон версии: `package.json` `0.0.0` против `index.ts` `1.0.0` —
  выровнять (источник истины — `package.json`).
- Опции `recommended` упростить: сейчас передаётся `{ alias, exceptions }`,
  оставить дефолты на уровне правил.

## Вне зоны (YAGNI)

- Конфигурируемый список слоёв — пока фиксированный `LAYERS_ORDER`.
- Смешанные импорты (часть спецификаторов — `type`, часть — значения):
  считаются обычными значениями (не пропускаются), т.к. в них есть рантайм-импорт.

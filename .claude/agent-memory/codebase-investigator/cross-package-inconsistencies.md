# Cross-Package Inconsistencies (Investigated 2026-03-08)

## 1. Incomplete tsconfig.editor.json References

TypeScript project references are used for incremental type-checking. Multiple packages import from other packages but do not declare the corresponding reference in their `tsconfig.editor.json`.

### builder (packages/builder/tsconfig.editor.json)
- References: `common`, `core`
- Missing: `config`
- Evidence: `packages/builder/src/session/builder-session.ts`, `packages/builder/src/plugin/session.ts`, `packages/builder/src/service.ts`, `packages/builder/src/internal/graphql-system.ts` all import from `@soda-gql/config`

### codegen (packages/codegen/tsconfig.editor.json)
- References: `core`
- Missing: `config`
- Evidence: `packages/codegen/src/runner.ts:3`, `packages/codegen/src/types.ts:1`, `packages/codegen/src/type-filter.ts:1`, `packages/codegen/src/generator.ts:1` all import from `@soda-gql/config`

### cli (packages/cli/tsconfig.editor.json)
- References: `codegen`, `builder`
- Missing: `config`, `typegen`, `common`
- Evidence: `packages/cli/src/commands/typegen.ts` imports from `@soda-gql/config` and `@soda-gql/typegen`; `packages/cli/src/commands/codegen/graphql.ts:10` imports from `@soda-gql/common`

### formatter (packages/formatter/tsconfig.editor.json)
- References: `[]` (empty)
- Missing: `common`
- Evidence: `packages/formatter/src/format.ts:7-8` imports from `@soda-gql/common/template-extraction` and `@soda-gql/common/utils`

### sdk (packages/sdk/tsconfig.editor.json)
- References: `builder`, `config`, `core`
- Missing: `codegen`, `common` (for `@soda-gql/core/_internal` subpath)
- Evidence: `packages/sdk/src/codegen.ts:7-8` imports from `@soda-gql/codegen`; `packages/sdk/src/prebuild.ts:8` imports from `@soda-gql/core/_internal`

## 2. Duplicated normalizePath in @soda-gql/swc

File: `packages/swc/src/index.ts:110`

```typescript
const normalizePath = (value: string): string => value.replace(/\\/g, "/");
```

The `@soda-gql/common` version at `packages/common/src/utils/path.ts:64`:

```typescript
export const normalizePath = (value: string): string => normalize(value).replace(/\\/g, "/");
```

The difference is the missing `normalize()` call from Node's `path` module. This means double-backslash sequences or other non-canonical path forms would be handled differently. `@soda-gql/swc` doesn't depend on `@soda-gql/common` in its `dependencies` (only `@soda-gql/builder`, `@soda-gql/config`, `@soda-gql/core`).

## 3. @swc/core Version Range Inconsistency

Across `package.json` files:
- `packages/builder/package.json:65` — `"@swc/core": "^1.6.3"`
- `packages/lsp/package.json:58` — `"@swc/core": "^1.6.3"`
- `packages/config/package.json:55` — `"@swc/core": "^1.10.0"` (highest)
- `packages/formatter/package.json:55` — `"@swc/core": "^1.0.0"` (as peerDep)
- `packages/typegen/package.json:62` — `"@swc/core": "^1.0.0"` (as peerDep)
- `packages/swc/package.json:77` — `"@swc/core": "^1.0.0"` (as peerDep)

Packages with direct dependencies (`builder`, `lsp`, `config`) each specify different minimum versions. Since root `resolutions`/`overrides` are not set for `@swc/core`, the minimum version is enforced per-package.

## 4. neverthrow Version Inconsistency

- `packages/config/package.json:56` — `"neverthrow": "^8.2.0"`
- All others — `"neverthrow": "^8.1.1"`

Minor but the config package has a higher minimum version than others that depend on it transitively. Not a breaking change at 8.x but worth aligning.

## 5. colocation-tools tsconfig outDir Uses Stale Package Name

File: `packages/colocation-tools/tsconfig.editor.json:6-7`

```json
"outDir": "../../node_modules/.soda-gql/.typecheck/helpers-internal",
"tsBuildInfoFile": "../../node_modules/.soda-gql/.typecheck/helpers-internal/tsconfig.tsbuildinfo"
```

The package is now `@soda-gql/colocation-tools` but the typecheck output directory still uses `helpers-internal` (the former package name). All other packages use their current name in the outDir. This could cause confusion but is non-functional (it just writes to a differently-named directory).

## 6. cli Package Missing import Export Condition

File: `packages/cli/package.json:43-48`

```json
".": {
  "@soda-gql": "./@x-index.ts",
  "types": "./dist/index.d.cts",
  "require": "./dist/index.cjs",
  "default": "./dist/index.cjs"
}
```

Unlike all other packages, `cli` has no `import` condition — only `require` and `default`. This is intentional (cli is CJS-only for bin usage), but it means ESM consumers cannot `import` from it using Node's conditional exports. The `default` fallback handles it, but the explicit `import` condition is absent.

## 7. Inconsistent dist File Extension Conventions

Three different conventions exist across packages:
- `.js`/`.d.ts`: `core`, `runtime`, `colocation-tools`
- `.mjs`/`.d.mts`: `builder`, `codegen`, `typegen`, `common`, `config`, `formatter`, `lsp`, `babel`, `tsc`, `sdk`, `swc`, `vite-plugin`, `webpack-plugin`, `metro-plugin`
- `.cjs`/`.d.cts`: `cli`

The `.js` group (core, runtime, colocation-tools) appears to be legacy. These packages don't use the `.mjs` convention followed by the majority.

## 8. Unused prettier devDependency in @soda-gql/swc

File: `packages/swc/package.json:74`

`prettier` is listed as a devDependency in `@soda-gql/swc` but no TypeScript source in that package imports from it (unlike `@soda-gql/tsc` which dynamically imports it in `test/test-cases/index.ts`). Likely a leftover from initial scaffolding.

## 9. Dual Error Formatting for BuilderError

Two separate formatters exist for `BuilderError` that produce different output:

1. `packages/builder/src/errors.ts:311` — `formatBuilderError()` — produces plain text with labeled fields per error type
2. `packages/builder/src/errors/formatter.ts:108` — `formatBuilderErrorForCLI()` — produces structured output with `Error [CODE]: message`, location, and hints

Both are exported from `@soda-gql/builder` and `cli` uses `formatBuilderErrorForCLI`. The simpler `formatBuilderError` in `errors.ts` is effectively redundant.

## 10. CONFIG_NOT_FOUND Defined in Both builder and config

The error code `"CONFIG_NOT_FOUND"` exists in two independent type systems:
- `packages/builder/src/errors.ts:9` — as `BuilderErrorCode`
- `packages/config/src/errors.ts:1` — as `ConfigErrorCode`

These are independent discriminated union branches; builder has code `"CONFIG_NOT_FOUND"` with a `path` field, config has it with a `filePath` field. The CLI wraps them separately (`{ category: "builder" }` vs `{ category: "config" }`), so there's no conflict, but it's conceptually confusing.

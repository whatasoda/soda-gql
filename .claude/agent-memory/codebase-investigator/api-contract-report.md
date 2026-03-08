# API Contract and Implementation Inconsistency Report

**Investigated:** 2026-03-08
**Scope:** All packages in the soda-gql monorepo

---

## 1. Public API vs Internal Implementation

### 1.1 `TypegenOptions` Exported but Never Used by `runTypegen` — Dead Export

- **File:** `/Users/whatasoda/workspace/soda-gql/packages/typegen/src/types.ts:13`
- **Index export:** `/Users/whatasoda/workspace/soda-gql/packages/typegen/src/index.ts:21`
- **Description:** `TypegenOptions` (with fields `outdir`, `schemaNames`, `injects`, `importExtension`) is exported from `@soda-gql/typegen` but `runTypegen` takes `RunTypegenOptions` (with only `config: ResolvedSodaGqlConfig`). The two are completely different shapes. `TypegenOptions` is never used internally or referenced externally — it is a dead export that implies a non-existent API surface.
- **Severity:** Medium

### 1.2 `BuilderService.build()` Option Type Narrower Than `BuilderSession.build()`

- **Service interface:** `/Users/whatasoda/workspace/soda-gql/packages/builder/src/service.ts:34`
- **Session interface:** `/Users/whatasoda/workspace/soda-gql/packages/builder/src/session/builder-session.ts:117`
- **Description:** `BuilderService.build()` declares `options?: { force?: boolean }` but the underlying `BuilderSession.build()` accepts `BuildOptions = { force?: boolean; onPhase?: BuildPhaseCallbacks }`. The `createBuilderService` wrapper at line 95 passes `options` directly through (`session.build(options)`), meaning `onPhase` callbacks passed to the service's `build()` call would silently have no effect because the declared type omits them. The same applies to `buildAsync()`.
- **Severity:** Medium

### 1.3 `_collectUsedInputObjectsFromSpecifiers` — Dead Prefixed Private Function

- **File:** `/Users/whatasoda/workspace/soda-gql/packages/typegen/src/emitter.ts:279`
- **Description:** The function `_collectUsedInputObjectsFromSpecifiers` is declared with a leading underscore (indicating "intentionally unused") and is never called anywhere in the codebase. It takes `InputTypeSpecifiers` as input, whereas the actual code uses `collectUsedInputObjects` (with `VariableDefinitionNode[]`) and `collectUsedInputObjectsFromVarDefs` (with VarSpecifier objects). This represents dead code left in a production module.
- **Severity:** Low

### 1.4 `formatBuilderError` Exported from `errors.ts` but Not Re-Exported from Package Index

- **Declared in:** `/Users/whatasoda/workspace/soda-gql/packages/builder/src/errors.ts:311`
- **Package index:** `/Users/whatasoda/workspace/soda-gql/packages/builder/src/index.ts`
- **Description:** `formatBuilderError` is a fully implemented function in `errors.ts` but is not re-exported from `@soda-gql/builder`'s index. The index only exports `formatBuilderErrorForCLI` and `formatBuilderErrorStructured` from `./errors/formatter`. Both formatters produce the same header format (`Error [${error.code}]: ${message}`) but with different fields, creating two parallel implementations.
- **Severity:** Low

### 1.5 `ArtifactLoadError`: Wrong Error Code Used for Read Failure

- **File:** `/Users/whatasoda/workspace/soda-gql/packages/builder/src/artifact/loader.ts:49-53` and `:87-90`
- **Description:** When a file exists but cannot be read (OS-level I/O error), both `loadArtifact` and `loadArtifactSync` return `code: "ARTIFACT_NOT_FOUND"` rather than a separate error code. The error code `ARTIFACT_NOT_FOUND` semantically implies the file does not exist, but it is also used when `readFile`/`readFileSync` throws (e.g., permission denied). Callers cannot distinguish between "file missing" and "file unreadable".
- **Severity:** Medium

---

## 2. Cross-Package Contract Violations

### 2.1 `webpack-plugin` Defines Its Own `TransformerType` Instead of Re-Exporting from Builder

- **webpack-plugin local definition:** `/Users/whatasoda/workspace/soda-gql/packages/webpack-plugin/src/types.ts:8`
- **Canonical definition:** `/Users/whatasoda/workspace/soda-gql/packages/builder/src/plugin/shared-state.ts:10`
- **vite-plugin (correct):** `/Users/whatasoda/workspace/soda-gql/packages/vite-plugin/src/types.ts:3`
- **Description:** `vite-plugin` re-exports `TransformerType` from `@soda-gql/builder/plugin-support`. The `webpack-plugin` re-defines it locally as `type TransformerType = "babel" | "swc"` (identical values, but separate definition). If a new transformer type is added to the builder, the webpack-plugin type will silently go out of sync. The metro-plugin does re-export from builder correctly.
- **Severity:** Low

### 2.2 `cli` `schemaCommand` Silently Drops `config.codegen.chunkSize`

- **CLI entry point:** `/Users/whatasoda/workspace/soda-gql/packages/cli/src/commands/codegen/schema.ts:148-153`
- **SDK entry point:** `/Users/whatasoda/workspace/soda-gql/packages/sdk/src/codegen.ts:89-94`
- **Config field:** `ResolvedSodaGqlConfig.codegen.chunkSize` (normalized in `/Users/whatasoda/workspace/soda-gql/packages/config/src/normalize.ts:164-168`)
- **Description:** Both the CLI `schemaCommand` and `sdk/codegenAsync` load `config.codegen.chunkSize` but do not forward it to `runCodegen`. The call to `runCodegen` omits `chunkSize`, so `runCodegen` defaults to 100 regardless of the user's configuration. The `chunkSize` configuration option is documented and normalized but never applied through the standard CLI/SDK entry points. Only a direct caller of `runCodegen` who explicitly sets `chunkSize` would see it take effect.
- **Severity:** High

### 2.3 `sdk/codegenAsync` Constructs `ConfigError` Inline Without Using `configError()` Helper

- **File:** `/Users/whatasoda/workspace/soda-gql/packages/sdk/src/codegen.ts:78-82`
- **Correct pattern:** `/Users/whatasoda/workspace/soda-gql/packages/config/src/errors.ts:10-25`
- **Description:** When schemas are missing from config, `codegenAsync` returns a raw object literal `{ code: "CONFIG_VALIDATION_FAILED", message: "..." }` typed as `CodegenSdkError` (which is `ConfigError | CodegenError`). This bypasses the `configError()` constructor from `@soda-gql/config`. The raw object omits optional fields `filePath` and `cause` without using the helper, making it inconsistent with how `ConfigError` values are created everywhere else in the codebase.
- **Severity:** Low

### 2.4 `tsc/plugin.ts` Defines Its Own `PluginOptions` Type, Diverging from Builder's

- **Local definition:** `/Users/whatasoda/workspace/soda-gql/packages/tsc/src/plugin.ts:14-17`
- **Builder definition:** `/Users/whatasoda/workspace/soda-gql/packages/builder/src/plugin/session.ts:17-26`
- **Description:** The tsc plugin defines `PluginOptions = { configPath?: string; enabled?: boolean }`. The builder's shared `PluginOptions` also has `failOnError?: boolean`. The tsc plugin doesn't support `failOnError` — instead it always logs-and-returns-fallback on error. This is an intentional design but creates a naming collision: a user who passes `failOnError` to `createTscPlugin` will have the parameter silently ignored (TypeScript won't complain because the local type simply doesn't include it).
- **Severity:** Low

### 2.5 `vite-plugin` Index Exports Fewer Shared State Helpers Than `webpack-plugin` Index

- **vite-plugin index:** `/Users/whatasoda/workspace/soda-gql/packages/vite-plugin/src/index.ts:2` — exports `getSharedArtifact`, `getSharedState`, `getStateKey`
- **webpack-plugin index:** `/Users/whatasoda/workspace/soda-gql/packages/webpack-plugin/src/index.ts:3-10` — additionally exports `getSharedBuilderService`, `setSharedBuilderService`, `getSharedPluginSession`, `setSharedPluginSession`
- **Description:** The two plugin packages expose different subsets of the shared state API. Users who need `getSharedBuilderService` or `getSharedPluginSession` can get them from the webpack-plugin but not from the vite-plugin, creating inconsistent API surfaces across equivalent bundler integrations.
- **Severity:** Low

---

## 3. Test vs Implementation Drift

### 3.1 Test Fixture Uses Callback Builder Syntax That Doesn't Exercise Tagged Templates

- **File:** `/Users/whatasoda/workspace/soda-gql/packages/sdk/test/integration/prebuild.test.ts:62-75`
- **Description:** The integration test fixture creates a source file using the callback builder syntax (`gql.default(({ fragment }) => fragment("EmployeeFragment", "Employee")\`...\`())`). This correctly uses tagged template syntax for the fragment body but the operation uses the fully-qualified callback builder (`.operation({ name, variables, fields })`). Neither form directly tests the pure tagged template operation form, which is a separate code path in the template scanner. Not a drift per se, but the test doesn't cover the `runTypegen` template-scanning path that the typegen runner relies on.
- **Severity:** Low (coverage gap, not a contract violation)

### 3.2 `FieldSelectionData` — Fragment and Operation Use Incompatible `variableDefinitions` Types

- **Type definition:** `/Users/whatasoda/workspace/soda-gql/packages/builder/src/prebuilt/extractor.ts:18-34`
- **Fragment variant:** `variableDefinitions: VariableDefinitions` (i.e., `Record<string, VarSpecifier>`)
- **Operation variant:** `variableDefinitions: readonly VariableDefinitionNode[]` (GraphQL AST nodes)
- **Emitter usage (fragment):** `/Users/whatasoda/workspace/soda-gql/packages/typegen/src/emitter.ts:147-158` — calls `collectUsedInputObjectsFromVarDefs(schema, selection.variableDefinitions)` and `generateInputTypeFromVarDefs(..., selection.variableDefinitions, ...)`
- **Emitter usage (operation):** `/Users/whatasoda/workspace/soda-gql/packages/typegen/src/emitter.ts:175-186` — calls `collectUsedInputObjects(schema, selection.variableDefinitions)` and `generateInputType(schema, selection.variableDefinitions, ...)`
- **Description:** The two branches of `FieldSelectionData` use fundamentally different types for `variableDefinitions`. Fragment uses the core `VariableDefinitions` object (key→VarSpecifier map), while operation uses raw GraphQL `VariableDefinitionNode[]` AST. This asymmetry is intentional (fragments are built from the composer, operations from the GraphQL document), but it means the emitter must use completely different code paths per type and the shared map type `FieldSelectionsMap` conceals this internal inconsistency. Any cross-type generalization will fail silently.
- **Severity:** Medium (design inconsistency, but currently handled correctly by branch-specific code)

---

## 4. Configuration Schema Mismatches

### 4.1 `ResolvedSodaGqlConfig` Has No Zod Schema — Only `SodaGqlConfig` Is Validated

- **Zod validation:** `/Users/whatasoda/workspace/soda-gql/packages/config/src/helper.ts` — `validateConfig` validates raw config
- **Normalize output:** `/Users/whatasoda/workspace/soda-gql/packages/config/src/normalize.ts:174` — produces `ResolvedSodaGqlConfig`
- **Description:** The `ResolvedSodaGqlConfig` type (produced after normalization) has no Zod schema for runtime validation. The `validateConfig` function only validates the raw `SodaGqlConfig`. If normalization introduces a structural bug (e.g., wrong type for a resolved field), there is no schema-level check at the resolved layer. This is not itself a contract violation, but it means the runtime shape of config reaching all consumers is unguarded.
- **Severity:** Low (architectural observation)

### 4.2 `CodegenSchemaConfig` in `@soda-gql/codegen` Partially Mirrors `ResolvedSchemaConfig` from `@soda-gql/config`

- **codegen type:** `/Users/whatasoda/workspace/soda-gql/packages/codegen/src/types.ts:13-19`
- **config type:** `/Users/whatasoda/workspace/soda-gql/packages/config/src/types.ts:258-264`
- **Description:** `ResolvedSchemaConfig` (from config) has `defaultInputDepth: number` (required, with default 3 after normalization). `CodegenSchemaConfig` (in codegen) has `defaultInputDepth?: number` (optional). When the CLI builds `CodegenSchemaConfig` from `ResolvedSchemaConfig` at `/Users/whatasoda/workspace/soda-gql/packages/cli/src/commands/codegen/schema.ts:62-68`, it passes through the field unchanged — but since `ResolvedSchemaConfig.defaultInputDepth` is required (always has a value), the mismatch means the codegen type unnecessarily treats it as optional, adding defensive `undefined` checks in `runCodegen` (line 136: `schemaConfig.defaultInputDepth !== undefined && schemaConfig.defaultInputDepth !== 3`). The two schemas should be aligned.
- **Severity:** Low

---

## 5. Plugin Interface Inconsistencies

### 5.1 `@soda-gql/common/test` Export Only Has `@soda-gql` Condition — No Runtime Access

- **Package exports:** `/Users/whatasoda/workspace/soda-gql/packages/common/package.json:58-60`
- **Internal usage:** `/Users/whatasoda/workspace/soda-gql/packages/builder/src/cache/module-cache.test.ts:3`
- **Description:** The `./test` subpath of `@soda-gql/common` is declared with only `"@soda-gql": "./@devx-test.ts"` — no `types`, `import`, or `require` conditions. This means the subpath works only inside the monorepo (via the `@soda-gql` custom condition) and would throw a module resolution error for any external consumer importing `@soda-gql/common/test`. The README documents this subpath as a public API at line 106.
- **Severity:** Medium (documentation vs. runtime access mismatch for external consumers)

### 5.2 `normalizeInject` Converts String Form Differently From Object Form

- **File:** `/Users/whatasoda/workspace/soda-gql/packages/config/src/normalize.ts:47-58`
- **Description:** When `inject` is a string, `normalizeInject` resolves it as both `scalars` and `adapter` (`adapter: resolvedPath`). When `inject` is an object without `adapter`, the adapter is absent. The type documentation at `/Users/whatasoda/workspace/soda-gql/packages/config/src/types.ts:8-15` says the string form "should be a path to a file that exports scalar (required) and adapter (optional)". So the string form forces `adapter` to be the same file as `scalars`, even if the file doesn't export an adapter. This may cause the codegen to attempt loading an adapter from a scalars-only file.
- **Severity:** High (semantic mismatch between documented intent and implementation behavior — the string form always sets `adapter`, but the file may not export one)

### 5.3 `toImportSpecifier` Function Duplicated Between `codegen/runner.ts` and `typegen/runner.ts`

- **codegen copy:** `/Users/whatasoda/workspace/soda-gql/packages/codegen/src/runner.ts:26-60`
- **typegen copy:** `/Users/whatasoda/workspace/soda-gql/packages/typegen/src/runner.ts:57-91`
- **Description:** Both files contain an identical-looking (but slightly divergent in edge-case behavior) `toImportSpecifier` function. The `normalized.length === 0` branch differs: codegen uses `basename(targetPath, sourceExt)` while typegen uses `targetPath.slice(0, -sourceExt.length).split("/").pop()`. These produce the same result in most cases but diverge when `targetPath` is just a filename with no directory separator. This is a code duplication with subtle drift between implementations.
- **Severity:** Medium

---

## Summary Table

| # | Issue | Severity | Package(s) |
|---|-------|----------|------------|
| 1.1 | `TypegenOptions` dead export | Medium | typegen |
| 1.2 | `BuilderService.build()` narrows `BuilderSession.build()` options | Medium | builder |
| 1.3 | `_collectUsedInputObjectsFromSpecifiers` dead function | Low | typegen |
| 1.4 | `formatBuilderError` not re-exported | Low | builder |
| 1.5 | `ArtifactLoadError`: wrong code for read failure | Medium | builder |
| 2.1 | webpack-plugin redefines `TransformerType` locally | Low | webpack-plugin, builder |
| 2.2 | `chunkSize` config silently dropped by CLI and SDK | **High** | cli, sdk, codegen |
| 2.3 | `codegenAsync` constructs `ConfigError` inline | Low | sdk |
| 2.4 | `tsc/plugin.ts` `PluginOptions` diverges from builder's | Low | tsc |
| 2.5 | `vite-plugin` exports fewer shared state helpers than `webpack-plugin` | Low | vite-plugin, webpack-plugin |
| 3.1 | Test fixture gaps for tagged template scanning | Low | sdk |
| 3.2 | `FieldSelectionData.variableDefinitions` uses incompatible types per variant | Medium | builder, typegen |
| 4.1 | `ResolvedSodaGqlConfig` has no Zod schema | Low | config |
| 4.2 | `CodegenSchemaConfig.defaultInputDepth` optional vs required mismatch | Low | codegen, config |
| 5.1 | `@soda-gql/common/test` only accessible via internal condition | Medium | common |
| 5.2 | String inject form always sets `adapter`, potentially wrong | **High** | config |
| 5.3 | `toImportSpecifier` duplicated with subtle drift | Medium | codegen, typegen |

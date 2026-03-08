# Runtime Behavior Inconsistency Report

Generated: 2026-03-08

---

## 1. Builder Flow Inconsistencies

### 1a. Field-level directives silently dropped in tagged template path

**File**: `/Users/whatasoda/workspace/soda-gql/packages/core/src/composer/fragment-tagged-template.ts`, line 111

**Description**: `buildFieldsFromSelectionSet` constructs `extras` with only `alias` (when an alias is present), but never reads `selection.directives` for regular `FIELD` nodes. Field-level directives such as `@skip` and `@include` written in the template string (e.g., `{ email @skip(if: $show) }`) are silently parsed by graphql-js into the AST but are never forwarded to the field factory via the `directives` array in `extras`.

By contrast, the callback builder exposes `$dir` in the context (from `createGqlElementComposer`) and the field factory in `fields-builder.ts` accepts `extras.directives` and includes them in the `AnyFieldSelection` object and the final AST via `buildDirectives` in `build-document.ts`.

This means `query("Q")\`{ user { email @skip(if: true) } }\`` produces a document with no `@skip` directive on `email`, while the equivalent callback builder query does include `@skip`.

**Severity**: **high** — two syntaxes that claim parity produce different GraphQL documents.

---

### 1b. Fragment spread `path` always `null` in tagged template fragments

**File**: `/Users/whatasoda/workspace/soda-gql/packages/core/src/composer/fragment-tagged-template.ts`, line 483–486

**Description**: When a tagged template fragment's `spread()` is called during operation building, it calls `recordFragmentUsage({ metadataBuilder, path: null })`. The `path` field represents the field-path context where the fragment was spread (`FragmentMetaInfo.fieldPath`), which adapters can use in `aggregateFragmentMetadata` for routing purposes.

In the callback builder path, `fields-builder.ts` tracks the current path using `getCurrentFieldPath()` / `withFieldPath()` as nested field builders are evaluated. The Fragment object's `spread()` method would be called inside those nested callbacks, so `getCurrentFieldPath()` would yield a meaningful path. However, tagged template fragments always produce `null` for `path`, even when spread inside a deeply-nested field.

**Severity**: **medium** — only affects adapters that use `fieldPath` in `aggregateFragmentMetadata`. The default adapter ignores it, so the common case is unaffected.

---

### 1c. `overrideDocumentSource` inconsistency between no-interpolation and interpolation tagged template paths

**File**: `/Users/whatasoda/workspace/soda-gql/packages/core/src/composer/operation-tagged-template.ts`, lines 173–216

**Description**: The operation tagged template has two code paths:

- **No-interpolation path** (line 173): uses `mode: "prebuilt"`, calls `wrapArtifactAsOperation(..., true)` — `overrideDocumentSource: true`, which replaces `documentSource` with `() => ({})`.
- **Interpolation path** (line 193): uses `mode: "fieldsFactory"`, calls `wrapArtifactAsOperation(..., false)` — `overrideDocumentSource: false`, which preserves the real `documentSource`.

`documentSource` is the mechanism by which the builder captures field selections for typegen (via `getIntermediateElements()`). In the no-interpolation path, `documentSource` is wiped to an empty object, so any downstream consumer (like typegen) that relies on `documentSource()` cannot reconstruct field selections from no-interpolation tagged template operations. This is intentional for the prebuilt path (comment says "real documentSource is meaningless"), but it creates an asymmetry in what can be introspected at build time.

**Severity**: **low** — intentional design, documented in comments. However, it means typegen field-selection extraction only works for interpolation-mode tagged templates, not plain-text ones.

---

### 1d. `buildSyntheticOperationSource` does not validate operation type matches schema root

**File**: `/Users/whatasoda/workspace/soda-gql/packages/core/src/composer/operation-tagged-template.ts`, lines 61–67

**Description**: `buildSyntheticOperationSource` just concatenates `${operationType} ${operationName} ${body.trim()}`. There is no validation that `operationType` is a valid operation type for the schema — i.e., that `schema.operations[operationType]` is non-null. The validation that throws an error (`"Operation type ${operationType} is not defined in schema roots"`) only runs in `createOperationComposerFactory` (callback builder path), `createCompatComposer`, and `createCompatTaggedTemplate`. The `createOperationTaggedTemplate` function checks `operationTypeName = schema.operations[operationType]` at line 164 but only uses it as a type, and there is no throw on null. If a schema has no `subscription` root but a user writes `subscription("Foo")\`...\`()`, the document is built and the operation is created with `operationTypeName` as `null` (cast to `keyof typeof schema.object & string`), producing a malformed operation silently.

**Severity**: **high** — can produce silent malformed operations when schema roots are missing, unlike the callback builder which throws early.

---

## 2. Registry / State Management Issues

### 2a. Module-level `cachedGql` / `cachedModulePath` never reset between builder sessions

**File**: `/Users/whatasoda/workspace/soda-gql/packages/builder/src/intermediate-module/evaluation.ts`, lines 102–113

**Description**: `cachedGql` and `cachedModulePath` are module-level singletons. When a `BuilderSession` is created, `executeGraphqlSystemModule` reuses `cachedGql` if `cachedModulePath === modulePath`. This is intentional for performance but `__clearGqlCache()` is never called in any integration test's `afterEach`. If two builder sessions in the same process use different GraphQL system modules (different schemas/outdir), the second session will get a stale module if `cachedModulePath` matches. More importantly: no integration test file calls `__clearGqlCache`, meaning test isolation for this global is not enforced.

**Severity**: **medium** — in practice, tests use a single schema path per test run, so it does not currently cause failures. But the absence of test-level cleanup makes this a latent issue if multi-schema integration tests are added.

---

### 2b. Module-level `_transformSync` singleton shared across parallel build sessions

**File**: `/Users/whatasoda/workspace/soda-gql/packages/builder/src/intermediate-module/evaluation.ts`, lines 23–33

**Description**: `_transformSync` is a module-level singleton initialized lazily via `createRequire`. This is safe for single-session use but cannot be reset (no `__clearTransformSyncCache` export). If the SWC version changes mid-process (which cannot happen in practice), or if tests need to isolate SWC behavior, there is no mechanism to reset this state. Minor concern.

**Severity**: **low** — no current failure scenario, but the module-level state pattern is inconsistent with the resettable `cachedGql`.

---

### 2c. `__resetRuntimeRegistry` does not cover `operationRegistry` entries created inside VM context

**File**: `/Users/whatasoda/workspace/soda-gql/packages/core/src/runtime/runtime-registry.ts`

**Description**: `createRuntimeOperation` (called inside the VM sandbox by `gqlRuntime.operation()`) calls `registerOperation(operation)`, which writes into the `operationRegistry` Map. This map is module-scoped in `@soda-gql/core/runtime`. However, the sandbox uses the host's `@soda-gql/core/runtime` module (imported at sandbox.ts lines 15, `sandboxCoreRuntime`). This means each call to `evaluateIntermediateModules` / `evaluateIntermediateModulesAsync` registers operations into the host's registry.

In tests, `__resetRuntimeRegistry` is called only in SWC and Babel integration test files (around `runtime-behavior.test.ts`). The core `runtime-registry.test.ts` and `operation.test.ts` call it in `beforeEach`/`afterEach`. However, builder integration tests (under `packages/builder/test/integration/`) do **not** call `__resetRuntimeRegistry`, meaning each builder integration test that triggers operation creation will leave state in the host `operationRegistry`. If tests run sequentially, this causes state accumulation. If `getOperation` is called during test verification, stale operations from prior runs may be returned.

**Severity**: **high** — builder integration tests that evaluate operations contaminate the runtime registry and no cleanup is performed between tests.

---

### 2d. `exitHandlerState` is a module-level singleton not cleaned up between `BuilderSession` instances in tests

**File**: `/Users/whatasoda/workspace/soda-gql/packages/builder/src/session/builder-session.ts`, lines 148–185

**Description**: `exitHandlerState.registered` and `exitHandlerState.factories` are module-level singletons. The `__resetExitHandlerForTests` function exists but is not called in any builder integration test's `afterEach`. When multiple `BuilderSession` instances are created across tests (each test calls `createBuilderSession`), the `process.on("beforeExit", ...)` handler is registered only once (by design), but the `factories` Set grows with each session. Calling `session.dispose()` removes the factory from the Set, but if `dispose` is not called in a test, factories accumulate.

Looking at the builder integration tests: `session-incremental.test.ts` creates sessions but it is not clear all tests call `dispose()` in `afterEach`.

**Severity**: **low** — only affects process exit behavior (cache saves), not correctness of builds.

---

## 3. Schema Processing Gaps

### 3a. `createSchemaIndexFromSchema` produces empty field Maps — downstream consumers that expect field-level data will silently fail

**File**: `/Users/whatasoda/workspace/soda-gql/packages/core/src/graphql/schema-adapter.ts`, lines 23–51

**Description**: `createSchemaIndexFromSchema` creates a "name-resolution only" `SchemaIndex` — the Maps for `objects`, `inputs`, `enums`, `unions` are populated with names only, but all inner Maps (`fields`, `values`, `members`) are empty. This is documented.

The issue is that `createSchemaIndex` (from `schema-index.ts`), which parses a real `DocumentNode` and populates field-level data, is a separate function, and the two are easy to confuse. Both return `SchemaIndex`. If any code path calls `createSchemaIndexFromSchema` and then passes the result to something that expects field-level data (e.g., `SchemaIndex.objects.get("Query").fields.get("user")`), it silently returns `undefined` instead of throwing.

Currently, `createSchemaIndexFromSchema` is used only for variable type resolution (`buildVarSpecifiers`), which only needs `.has()` checks on the top-level Maps. But if future code is added that re-uses the `SchemaIndex` returned by `createSchemaIndexFromSchema` for field lookups, it will silently get empty results.

**Severity**: **low** — currently no misuse detected. The two `SchemaIndex` construction paths are structurally identical types with different semantics, a latent confusion risk.

---

### 3b. `resolveFieldTypeName` in tagged templates uses raw string split — does not handle object-format specifiers with args

**File**: `/Users/whatasoda/workspace/soda-gql/packages/core/src/composer/fragment-tagged-template.ts`, lines 347–359

**Description**: `resolveFieldTypeName` splits the field specifier string on `"|"` and takes `parts[1]` as the type name. This only works for the string-format specifier (e.g., `"o|User|!"`). If the field uses the object format (`{ spec: "o|User|!", arguments: { ... } }`) — which is the case for any field with extracted arguments — the specifier passed to `resolveFieldTypeName` is an object. The `typeof fieldDef === "string"` check handles this, but then uses `fieldDef.spec` as the specifier string. However, the union field check path (line 118–120) calls `parseOutputField(fieldSpec)` directly and uses that result, while `resolveFieldTypeName` (called at line 211 for object fields) does its own parsing independently.

Both parse the same string, but via two different code paths. If the format of `DeferredOutputField` changes or if object fields with args are resolved differently from string fields, the two code paths may diverge.

**Severity**: **low** — currently both paths handle the formats correctly, but redundant parsing creates a maintenance risk.

---

## 4. Tagged Template vs Callback Builder Parity

### 4a. Field-level directives not supported in tagged templates (see 1a above)

**Summary**: Tagged templates cannot attach field directives (`@skip`, `@include`, schema-defined directives) to individual field selections. The callback builder exposes `$dir` for this. This is a documented feature gap in the MEMORY but the asymmetry is not described anywhere in the codebase itself.

**Severity**: **high** — users who migrate from callback builder to tagged template syntax will lose directive support silently (no error is thrown; the directive is simply absent from the output).

---

### 4b. Alias support: tagged templates support aliases, callback builder supports aliases — but tagged template aliases are not forwarded to `extras.directives`

**File**: `/Users/whatasoda/workspace/soda-gql/packages/core/src/composer/fragment-tagged-template.ts`, line 111

**Description**: The `extras` object passed to the field factory only contains `{ alias }` (never `{ alias, directives }`). This is a sub-issue of 1a: even if directives were read from the AST, the current `extras` construction would need to be extended to pass both `alias` and `directives` simultaneously. Currently, a field with both an alias and a directive (e.g., `t: name @deprecated`) would have the alias captured but the directive dropped.

**Severity**: **high** (same as 1a, part of the same underlying issue).

---

### 4c. `compat` tagged template path does not validate operation type vs schema root at call time

**File**: `/Users/whatasoda/workspace/soda-gql/packages/core/src/composer/compat-tagged-template.ts`, line 29

**Description**: `createCompatTaggedTemplate` checks `schema.operations[operationType]` and throws early if null. However, `createCompatComposer` (the callback compat variant) also checks this. The inconsistency is that `createOperationTaggedTemplate` (the primary tagged template — not compat) does NOT perform this check at creation time (see finding 1d above). The compat tagged template is safe; the primary tagged template is not.

**Severity**: **high** (same as 1d, just confirming the compat path is correct while the primary tagged template path is not).

---

### 4d. Tagged template metadata callback context differs from callback builder metadata context

**File**: `/Users/whatasoda/workspace/soda-gql/packages/core/src/composer/fragment-tagged-template.ts`, lines 472–480

**Description**: In the tagged template fragment `spread()` closure, the metadata callback receives `{ $ }` where `$` is `createVarAssignments(varSpecifiers, variables)` — a map of variable assignments (which may be `VarRef` instances or nested-value wrappers). In the callback builder fragment, the metadata callback also receives `{ $ }` but the `$` is the result of `createVarRefs` (operation scope) or `createVarAssignments` (fragment scope depending on where it's called from).

The key issue: the tagged template fragment metadata callback's `$` is of type `DeclaredVariables<TSchema, TVariableDefinitions>` built from `createVarAssignments` — it reflects the variables as passed to `spread()` at call time. This means the metadata builder is called fresh on every `spread()` call, with the `$` from that specific invocation's variable values. In the typed callback builder, the fragment's metadata builder is set up once at fragment definition time and called during operation building with the operation's variable context, not the fragment's `spread()` call site.

This is a fundamental structural difference: tagged template fragment metadata can capture per-spread-call variables, while callback builder fragment metadata is evaluated in the operation building context. If a user expects metadata to capture the actual variable values passed to `spread()`, the tagged template path works; if they expect it to be evaluated once during operation document building, the callback path works. These are incompatible mental models.

**Severity**: **medium** — users writing adapters that rely on fragment metadata may observe different behavior depending on which syntax is used.

---

### 4e. No support for `$colocate` in tagged templates

**File**: `/Users/whatasoda/workspace/soda-gql/packages/core/src/composer/gql-composer.ts`, line 155

**Description**: The `$colocate` helper is only available in the callback builder context object. There is no tagged template equivalent syntax for colocation. This is a feature gap, not a bug, but it means codebases mixing syntaxes cannot use colocation from tagged template definitions.

**Severity**: **low** — documented as a feature gap in project notes.

---

### 4f. No field path tracking in `buildFieldsFromSelectionSet` for tagged templates

**File**: `/Users/whatasoda/workspace/soda-gql/packages/core/src/composer/fragment-tagged-template.ts`

**Description**: `buildFieldsFromSelectionSet` recursively processes selections but never calls `withFieldPath` / `appendToPath` to update the field path context. This means any metadata adapter or field path consumer called during tagged template evaluation will see `getCurrentFieldPath()` return `null` at all depths, while the callback builder properly tracks the path through nested `withFieldPath` calls in `fields-builder.ts`.

**Severity**: **medium** — affects metadata adapters that use `fieldPath` for per-field routing; the default adapter is unaffected.

---

## Summary Table

| # | Area | File | Severity |
|---|------|------|----------|
| 1a | Field directives silently dropped in tagged templates | `fragment-tagged-template.ts:111` | high |
| 1b | Fragment spread `path` always `null` in tagged templates | `fragment-tagged-template.ts:483` | medium |
| 1c | `overrideDocumentSource` asymmetry (prebuilt vs fieldsFactory) | `operation-tagged-template.ts:173-216` | low |
| 1d | Missing schema root validation in `createOperationTaggedTemplate` | `operation-tagged-template.ts:164` | high |
| 2a | `cachedGql` never reset in builder integration tests | `evaluation.ts:102-113` | medium |
| 2b | `_transformSync` singleton has no reset mechanism | `evaluation.ts:23-33` | low |
| 2c | `operationRegistry` contaminated across builder integration tests | `runtime-registry.ts` + `evaluation.ts` | high |
| 2d | `exitHandlerState.factories` not cleaned up in tests | `builder-session.ts:148-185` | low |
| 3a | `createSchemaIndexFromSchema` returns empty field Maps | `schema-adapter.ts:23-51` | low |
| 3b | `resolveFieldTypeName` redundant parsing vs `parseOutputField` | `fragment-tagged-template.ts:347-359` | low |
| 4a | Field directives not supported in tagged templates (same as 1a) | `fragment-tagged-template.ts:111` | high |
| 4b | Alias + directive simultaneously lost (subset of 1a) | `fragment-tagged-template.ts:111` | high |
| 4c | `createOperationTaggedTemplate` missing early schema root check (same as 1d) | `operation-tagged-template.ts:164` | high |
| 4d | Fragment metadata callback semantics differ across syntaxes | `fragment-tagged-template.ts:472-480` | medium |
| 4e | `$colocate` unavailable in tagged templates | `gql-composer.ts:155` | low |
| 4f | Field path not tracked in `buildFieldsFromSelectionSet` | `fragment-tagged-template.ts` | medium |

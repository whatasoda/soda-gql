# Research: RFC Steps 4-6 Impact Analysis (Core Changes)

## Investigation Scope

Steps 4-6 (single PR) cover:
- D2: Delete `$var` / `VarBuilder` / `inputTypeMethods`
- D3: Implement `f("field", args)` accessor replacing `f.fieldName(args)`
- D1: Implement `query("Name")({ variables, fields })` options object path

---

## 1. $var Deletion Scope

### Files to DELETE

| File | Reason |
|------|--------|
| `/packages/core/src/composer/var-builder.ts` | Contains `VarBuilder`, `createVarMethodFactory`, `createVarBuilder`, `AllInputTypeNames`, `VarBuilderMethods`, `InputTypeMethod`, `InputTypeMethods`, `AnyInputTypeMethods` |

### Files to MODIFY

| File | Change Required |
|------|-----------------|
| `/packages/core/src/composer/gql-composer.ts` | Remove `inputTypeMethods` from `GqlElementComposerOptions`; remove `createVarBuilder` import; remove `$var` from composer context; update `AnyGqlContext` to remove `$var` field (line 201); update JSDoc examples |
| `/packages/core/src/composer/index.ts` | Remove `export * from "./var-builder"` (line 16) |
| `/packages/core/src/index.ts` | No direct var-builder export — transitively exported via composer/index; will clear itself once gql-composer.ts and index.ts are updated |
| `/packages/tools/src/codegen/generator.ts` | Remove `createVarMethodFactory` from imports block (line 804); remove `inputTypeMethodsBlock` from template options (line 503); remove `renderInputTypeMethods` call (line 909); remove `inputTypeMethods` from `createGqlElementComposer` call (lines 766,771); remove `__inputTypeMethods_${name}` export (line 783); remove `VarBuilder` from index.ts type imports (line 1146); remove `readonly $var: VarBuilder<Schema_${name}>` from `PrebuiltContext_${name}` (line 1120) |

### Test/Fixture Files to UPDATE (all `$var` usages — 316 total occurrences in 37 files)

**Core integration tests** (each uses `$var` to define variables and `$var.getName/getNameAt/getValueAt` in metadata):
- `/packages/core/test/integration/tagged-template-operation.test.ts` — 6 occurrences
- `/packages/core/test/integration/metadata-with-variables.test.ts` — 17 occurrences (including `$var.getName`, `$var.getNameAt`, `$var.getValueAt` in metadata)
- `/packages/core/test/integration/nested-var-ref.test.ts` — 15 occurrences (heavy `$var.getNameAt/getValueAt` usage)
- `/packages/core/test/integration/metadata-adapter.test.ts` — 20 occurrences
- `/packages/core/test/integration/document-transform.test.ts` — 12 occurrences
- `/packages/core/test/integration/colocation-workflow.test.ts` — 9 occurrences
- `/packages/core/test/integration/query-level-fragment-pattern.test.ts` — 14 occurrences
- `/packages/core/test/integration/fragment-metadata-callback.test.ts` — 4 occurrences

**Core unit tests**:
- `/packages/core/src/composer/shorthand-fields.test.ts` — 22 occurrences
- `/packages/core/src/composer/operation.document-transform.test.ts` — 26 occurrences
- `/packages/core/src/composer/gql-composer.test.ts` — 4 occurrences
- `/packages/core/src/composer/gql-composer.helpers-injection.test.ts` — 6 occurrences

**Core type tests** (12 files):
- `/packages/core/test/types/_fixtures.ts` — uses `createVarMethodFactory` to build inputTypeMethods for all fixture schemas
- `/packages/core/test/types/variable-builder.test.ts` — 17 occurrences (tests `$var(name).TypeName(modifier)` API directly — test file may be deleted entirely)
- `/packages/core/test/types/var-ref-tools.test.ts` — 8 occurrences (tests `$var.getValueAt/getNameAt` — see D8 section)
- Plus 9 other type test files using `$var` within `.operation()` calls for variable definitions

**Fixture files** (test fixtures):
- `/packages/core/test/fixtures/input-type-methods.ts` — `createVarMethodFactory` fixture helper — file can be deleted
- `/packages/core/test/integration/metadata-with-variables.test.ts` — `createVarMethodFactory` direct

**Builder integration tests**:
- `/packages/builder/test/integration/tsconfig-paths.test.ts` — 10 occurrences
- `/packages/builder/test/integration/async-metadata.test.ts` — 4 occurrences

**SDK tests**:
- `/packages/sdk/test/integration/prebuild.test.ts` — 2 occurrences

**Codegen emitter tests**:
- `/packages/tools/src/codegen/graphql-compat/emitter.test.ts` — 16 occurrences
- `/packages/tools/src/codegen/graphql-compat/emitter.ts` — 4 occurrences (generates `$var` usage)
- `/packages/tools/test/codegen/integration/graphql-compat.test.ts` — 9 occurrences

### Note on $var.getNameAt / getValueAt / getVariablePath

These methods currently live on `VarBuilder` as `SchemaAwareGetNameAt<TSchema>` / `SchemaAwareGetValueAt<TSchema>`. They wrap the standalone functions `getNameAt`, `getValueAt`, `getVariablePath` from `var-ref-tools.ts`.

Per RFC D8: `getNameAt/getValueAt` continue to work but resolve from `PrebuiltTypes` `varTypes` instead of full schema. The standalone functions in `var-ref-tools.ts` are **schema-independent at runtime** (pure proxy navigation), so they are preserved. The **schema-aware type wrappers** `SchemaAwareGetNameAt/GetValueAt/ResolveTypeFromMeta` in `var-builder.ts` are deleted with the file.

After deletion, `getNameAt/getValueAt/getVariablePath` are still exported directly from `var-ref-tools.ts`. Tests using `$var.getNameAt(...)` will migrate to calling `getNameAt(...)` directly.

---

## 2. f.field() → f("field") Migration

### Files to DELETE

| File | Reason |
|------|--------|
| `/packages/core/src/types/element/fields-builder.ts` | Contains `FieldSelectionFactories<TSchema, TTypeName>` (property-keyed mapped type), `FieldsBuilder`, `FieldsBuilderTools`, `NestedObjectFieldsBuilder`, `NestedUnionFieldsBuilder`, `FieldSelectionFactory`, `FieldSelectionFactoryReturn`, etc. |

### Files to MODIFY

| File | Change Required |
|------|-----------------|
| `/packages/core/src/types/element/index.ts` | Remove `export * from "./fields-builder"` |
| `/packages/core/src/composer/fields-builder.ts` | Replace `createFieldFactories` return type — instead of a property-keyed map (`f.fieldName()`), return a function `f(fieldName, args)`. Core logic of building field selections is preserved, dispatch changes from property lookup to function argument. |
| `/packages/core/src/composer/operation-core.ts` | Import update — `createFieldFactories` returns new `f(name, args)` callable. The call site `fieldsFactory({ f, $ })` stays the same shape; just `f`'s type changes. |
| `/packages/core/src/composer/fragment-tagged-template.ts` | Uses `createFieldFactories` — same call site update |
| `/packages/core/src/types/element/compat-spec.ts` | Imports `FieldsBuilder` from fields-builder — update import |

### Usage count: f.fieldName() pattern

Total: **439 occurrences across 45 files**

**Core test files** (primary migration surface):
- `/packages/core/src/composer/shorthand-fields.test.ts` — 20 occurrences
- `/packages/core/src/composer/extend.test.ts` — 26 occurrences
- `/packages/core/src/composer/operation-core.test.ts` — 33 occurrences
- `/packages/core/src/composer/operation.document-transform.test.ts` — 29 occurrences
- `/packages/core/src/composer/compat.test.ts` — 18 occurrences
- `/packages/core/test/integration/tagged-template-operation.test.ts` — 20 occurrences
- `/packages/core/test/integration/metadata-adapter.test.ts` — 14 occurrences
- `/packages/core/test/integration/colocation-workflow.test.ts` — 5 occurrences
- `/packages/core/test/integration/document-transform.test.ts` — 11 occurrences
- `/packages/core/test/integration/metadata-with-variables.test.ts` — 7 occurrences
- `/packages/core/test/integration/query-level-fragment-pattern.test.ts` — 6 occurrences
- `/packages/core/test/integration/nested-var-ref.test.ts` — 3 occurrences
- `/packages/core/test/integration/fragment-metadata-callback.test.ts` — 3 occurrences

**Core type tests** (13 files):
- `/packages/core/test/types/nested-object-selection.test.ts` — 29 occurrences
- `/packages/core/test/types/directive-application.test.ts` — 24 occurrences
- `/packages/core/test/types/operation-definition.test.ts` — 17 occurrences
- `/packages/core/test/types/alias-handling.test.ts` — 10 occurrences
- `/packages/core/test/types/union-field-selection.test.ts` — 16 occurrences
- `/packages/core/test/types/variable-builder.test.ts` — 19 occurrences
- `/packages/core/test/types/fragment-spreading.test.ts` — 8 occurrences
- `/packages/core/test/types/attach.test.ts` — 6 occurrences
- `/packages/core/test/types/var-ref-tools.test.ts` — 4 occurrences
- `/packages/core/test/types/fragment-definition.test.ts` — 1 occurrence

**Builder integration tests**:
- `/packages/builder/test/integration/tsconfig-paths.test.ts` — 18 occurrences
- `/packages/builder/test/integration/async-metadata.test.ts` — 2 occurrences
- `/packages/builder/test/integration/portable-artifact.test.ts` — 1 occurrence

**SDK**:
- `/packages/sdk/test/integration/prebuild.test.ts` — 1 occurrence

**Formatter** (source files — not just tests):
- `/packages/tools/src/formatter/format.test.ts` — 22 occurrences
- `/packages/tools/src/formatter/detection.ts` — 1 occurrence (detects `f` in destructured params)
- `/packages/tools/src/formatter/format.ts` — 1 occurrence (references field selection object formatting)
- `/packages/tools/test/cli/integration/format.test.ts` — 13 occurrences

**Codegen emitter** (generates `f.fieldName` style):
- `/packages/tools/src/codegen/graphql-compat/emitter.test.ts` — 13 occurrences
- `/packages/tools/src/codegen/graphql-compat/emitter.ts` — 1 occurrence

**Fixture catalog** (16 fixture files with `f.fieldName` usage):
- Includes formatting fixtures that serve as formatter test baselines

### Critical: Formatter Detection Impact

`/packages/tools/src/formatter/detection.ts:isFieldSelectionObject()` (line 51) checks for `f` in the destructured parameter `({ f })` to identify field selection objects. This logic is **syntax-agnostic** — it looks at the parameter shape, not how `f` is called. No change required to the detection logic itself.

However, formatter test fixtures at:
- `/packages/tools/src/formatter/format.test.ts`
- `/packages/tools/test/cli/integration/format.test.ts`
- `/fixture-catalog/fixtures/formatting/valid/` (multiple files)

...all use `f.fieldName()` syntax and will need rewriting to `f("fieldName")`.

---

## 3. query.operation() → query("Name")({}) Migration

### Operation Count: query/mutation/subscription.operation() usages

Total: **approximately 150+ `.operation()` call sites across ~20 files**

**Core integration tests** (main surface):
- `/packages/core/test/integration/tagged-template-operation.test.ts` — 7 `.operation()` calls
- `/packages/core/test/integration/metadata-adapter.test.ts` — 10 `.operation()` calls
- `/packages/core/test/integration/colocation-workflow.test.ts` — 4 `.operation()` calls
- `/packages/core/test/integration/document-transform.test.ts` — 9 `.operation()` calls
- `/packages/core/test/integration/metadata-with-variables.test.ts` — 6 `.operation()` calls
- `/packages/core/test/integration/query-level-fragment-pattern.test.ts` — 7 `.operation()` calls
- `/packages/core/test/integration/nested-var-ref.test.ts` — 3 `.operation()` calls
- `/packages/core/test/integration/fragment-metadata-callback.test.ts` — 3 `.operation()` calls

**Core unit tests**:
- `/packages/core/src/composer/shorthand-fields.test.ts` — 12 `.operation()` calls
- `/packages/core/src/composer/operation.document-transform.test.ts` — 13 `.operation()` calls
- `/packages/core/src/composer/gql-composer.test.ts` — 1 `.operation()` call
- `/packages/core/src/composer/gql-composer.helpers-injection.test.ts` — 1 `.operation()` call

**Core type tests** (~60 `.operation()` calls across 10 type test files):
- `/packages/core/test/types/operation-definition.test.ts` — 9 calls
- `/packages/core/test/types/union-field-selection.test.ts` — 8 calls
- `/packages/core/test/types/directive-application.test.ts` — 8 calls
- `/packages/core/test/types/variable-builder.test.ts` — 8 calls
- `/packages/core/test/types/nested-object-selection.test.ts` — 5 calls
- `/packages/core/test/types/fragment-spreading.test.ts` — 6 calls
- `/packages/core/test/types/alias-handling.test.ts` — 3 calls
- `/packages/core/test/types/attach.test.ts` — 3 calls
- `/packages/core/test/types/var-ref-tools.test.ts` — 2 calls

**Builder integration tests**:
- `/packages/builder/test/integration/tsconfig-paths.test.ts` — 11 `.operation()` calls
- `/packages/builder/test/integration/async-metadata.test.ts` — 2 `.operation()` calls
- `/packages/builder/test/integration/portable-artifact.test.ts` — 1 `.operation()` call

**SDK tests**:
- `/packages/sdk/test/integration/prebuild.test.ts` — 1 `.operation()` call

**Formatter tests** (source code, not generated — must stay updated):
- `/packages/tools/src/formatter/format.test.ts` — 8 `.operation()` calls

**Fixture catalog** (~15 fixture files)

### `.operation()` Options Object Field Mapping

All current `.operation()` call options fields and their RFC equivalents:

| Before | After | Notes |
|--------|-------|-------|
| `name: "OpName"` | moved to step 1: `query("OpName")` | string literal |
| `variables: { ...$var("id").ID("!") }` | `variables: \`($id: ID!)\`` | template literal string |
| `fields: ({ f, $ }) => (...)` | `fields: ({ f, $ }) => (...)` | identical signature |
| `metadata: ({ $ }) => (...)` | moved to step 2: `()(...)` | same callback shape |
| `transformDocument: (...)` | TBD — per RFC, `metadata` in step 2 context | needs clarification |

The `transformDocument` field in `.operation()` options is used in:
- `/packages/core/test/integration/document-transform.test.ts` — per-operation `transformDocument` (different from adapter-level)
- This is passed as `OperationDocumentTransformer` in `operation-core.ts`

The RFC does not explicitly mention `transformDocument` in the options object migration. It will need to be addressed.

### Files to MODIFY (implementation)

| File | Change |
|------|--------|
| `/packages/core/src/composer/operation.ts` | Delete `createOperationComposerFactory` (the `.operation()` factory) or adapt it into the new options object path |
| `/packages/core/src/composer/gql-composer.ts` | Remove `.operation` property assignment; implement new `query("Name")` curried function that accepts either tagged template or options object |
| `/packages/core/src/composer/operation-tagged-template.ts` | Extend `CurriedOperationFunction` to also handle `OperationOptions` object as first arg; add options object path that calls `buildOperationArtifact` similar to `createOperationComposerFactory` |
| `/packages/tools/src/codegen/generator.ts` | Remove `PrebuiltCallbackOperation_${name}` and `readonly operation: ...` from `PrebuiltContext_${name}` (lines 1100-1108) |

---

## 4. Shared Internals — Preserve vs Delete

### PRESERVE (critical shared infrastructure)

| File | Used by | Why |
|------|---------|-----|
| `/packages/core/src/composer/operation-core.ts` | Tagged template + options object path both call `buildOperationArtifact`; `wrapArtifactAsOperation` is used by extend.ts and operation-tagged-template.ts | Core operation building logic |
| `/packages/core/src/composer/input.ts` | `createVarRefs` creates `$` proxy from `VariableDefinitions` — used by `buildOperationArtifact` in both paths | Variable reference creation |
| `/packages/core/src/composer/var-ref-tools.ts` | `getNameAt`, `getValueAt`, `getVariablePath`, `getVarRefName`, `getVarRefValue` — exported and used directly after `VarBuilder` removal | Standalone utility functions |
| `/packages/core/src/composer/fields-builder.ts` | `createFieldFactories` — implementation changes signature but stays; both callback builder and tagged template use it | Field factory creation |
| `/packages/core/src/graphql/var-specifier-builder.ts` | `buildVarSpecifiers` — parses GraphQL variable declarations from `VariableDefinitionNode[]`; used by tagged template AND will be used by options object path | Variable declaration parsing |
| `/packages/core/src/composer/merge-variable-definitions.ts` | `mergeVariableDefinitions` — merges variable defs from fragment interpolations | Fragment variable merging |

### DELETE

| File | Why |
|------|-----|
| `/packages/core/src/composer/var-builder.ts` | Entirely `$var`-related: `VarBuilder`, `createVarBuilder`, `createVarMethodFactory`, schema-aware type wrappers |
| `/packages/core/src/types/element/fields-builder.ts` | `FieldSelectionFactories` property-map type — replaced by function signature |
| `/packages/core/src/composer/operation.ts` | `createOperationComposerFactory` — its logic is absorbed into the options object path of the curried function |

### Candidate for DELETE (verify no other use)

| File | Assessment |
|------|------------|
| `/packages/core/test/fixtures/input-type-methods.ts` | Used only to construct `inputTypeMethods` for tests — entire fixture becomes obsolete |

---

## 5. Risks and Surprises

### Risk 1: var-ref-tools getNameAt/getValueAt API shape changes

The RFC (D8) says `getNameAt/getValueAt` will resolve types from `PrebuiltTypes.varTypes` instead of `ResolveTypeFromMeta<TSchema>`. The runtime functions in `var-ref-tools.ts` are schema-independent (pure proxy). Only the **type signature** of these functions changes. After `VarBuilder` deletion, they need direct export with new type signatures compatible with prebuilt `varTypes`. The current runtime implementation is fully reusable.

Tests using `$var.getNameAt/getValueAt` (found in `nested-var-ref.test.ts` and `metadata-with-variables.test.ts`) will call the functions directly. The `var-ref-tools.test.ts` already tests these functions standalone.

### Risk 2: formatter detection.ts isFieldSelectionObject checks for `f` parameter

`detection.ts` identifies field selection objects by looking for `f` in the arrow function's destructured parameter. After the `f.fieldName()` → `f("fieldName")` change, `f` is still present in `{ f, $ }` destructuring — detection logic works unchanged.

### Risk 3: AnyGqlContext type in gql-composer.ts

`AnyGqlContext` (line 185-205) has `readonly query` typed with `.operation: (...) => AnyOperation`. This type is used by the prebuilt module to avoid heavy schema inference. After removing `.operation`, this type must be updated to reflect the new shape (`query` accepts string → tagged template OR options object). The `.compat` property stays.

### Risk 4: graphql-compat emitter

`/packages/tools/src/codegen/graphql-compat/emitter.ts` generates callback-builder-style code (with `f.fieldName` and `$var`) for backward compat. This emitter will need to generate the new `f("field")` syntax and the new options object syntax. The emitter tests have 16 `$var` occurrences and 13 `f.fieldName` patterns that all need updating.

### Risk 5: Formatter format.test.ts formatting fixtures must stay as callback builders

Per existing memory: "Formatting fixtures must stay as callback builders." After this RFC, callback builders use `f("field")` instead of `f.field()`, so fixtures need updated syntax but remain callback-builder style (not converted to tagged templates).

### Risk 6: transformDocument in .operation() options — RESOLVED

Decision: `transformDocument` moves to step 2 alongside `metadata`:

```typescript
query("GetUser")({
  variables: `($id: ID!)`,
  fields: ({ f, $ }) => ({ ... }),
})({
  metadata: ({ $ }) => ({ ... }),
  transformDocument: (doc) => addPersistedQueryId(doc),
})
```

Rationale: It's an advanced feature on the same level as metadata. Tagged template path also needs this, and step 2 is the natural extension point for both paths.

Impact: 9 test cases in `document-transform.test.ts` that use per-operation `transformDocument` will need to move it from the step 1 options object to the step 2 call.

---

## Summary Table

| Area | Scope | Files | Occurrences |
|------|-------|-------|-------------|
| `$var` / `VarBuilder` delete | 1 file deleted | 37 files updated | 316 occurrences |
| `f.field()` → `f("field")` | 1 file deleted, 4 modified | 45 files updated | 439 occurrences |
| `.operation()` → curried options | 3 files modified | ~20 files updated | ~150 call sites |
| Shared internals to preserve | — | `operation-core.ts`, `input.ts`, `var-ref-tools.ts`, `fields-builder.ts`, `var-specifier-builder.ts` | — |

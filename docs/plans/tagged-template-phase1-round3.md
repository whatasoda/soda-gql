# Phase 1 Round 3: Compat Tagged Template + Extend Adaptation

## Purpose

Implement compat mode for tagged templates (`query.compat\`...\``) and adapt `extend` to handle `TemplateCompatSpec`. After this round, the tagged template compat-to-extend pipeline is fully functional: `query.compat\`...\`` produces a deferred `GqlDefine<TemplateCompatSpec>`, and `extend(compat, { metadata })` builds an `Operation` from it.

**Parent plan**: [Phase 1 Implementation Plan](./tagged-template-unification-phase1.md)
**Strategy document**: [Implementation Strategy](./tagged-template-unification.md)
**RFC reference**: [Tagged Template API Unification](../rfcs/tagged-template-unification/index.md)

## Prerequisites

- **Round 1 complete**: Shared GraphQL utilities exist in `packages/core/src/graphql/`
  - `parseGraphqlSource(source, sourceFile)` -- returns `Result<ParseResult, GraphqlAnalysisError>` where `ParseResult.document` provides raw AST
  - `buildVarSpecifier(varDefNode, schemaIndex)` -- constructs a `VarSpecifier` from a `VariableDefinitionNode` and `SchemaIndex`
  - `createSchemaIndexFromSchema(schema)` -- converts `AnyGraphqlSchema` to minimal `SchemaIndex` for name-resolution lookups
- **Round 2 complete**: Operation and fragment tagged templates exist in `packages/core/src/composer/`
  - `createOperationTaggedTemplate(schema, operationType)` -- returns a tagged template function for operations
  - `createFragmentTaggedTemplate(schema)` -- returns a tagged template function for fragments

## Scope

| Package | Directory | Changes |
|---------|-----------|---------|
| `@soda-gql/core` | `packages/core/src/types/element/` | **Modified** -- `compat-spec.ts` gets `TemplateCompatSpec` type |
| `@soda-gql/core` | `packages/core/src/composer/` | **New** -- `compat-tagged-template.ts` |
| `@soda-gql/core` | `packages/core/src/composer/` | **Modified** -- `extend.ts` adapted for `TemplateCompatSpec` |
| `@soda-gql/core` | `packages/core/src/composer/` | **Retained** -- `compat.ts` existing callback builder compat path unchanged |

## Shared Context

This section contains all type definitions and design context needed for implementation. It is self-contained so the plan survives context compaction.

### TemplateCompatSpec type (new for Round 3)

```typescript
// Stores raw GraphQL source string instead of fieldsBuilder callback.
// For deferred execution via extend().
// Located in: packages/core/src/types/element/compat-spec.ts
type TemplateCompatSpec = {
  readonly schema: AnyGraphqlSchema;
  readonly operationType: OperationType;
  readonly operationName: string;
  readonly graphqlSource: string;  // Raw GraphQL string (NOT parsed yet)
};
```

Key design decision: compat stores the raw GraphQL source string, NOT parsed artifacts. Parsing happens inside `extend()` at extend-time, not at definition-time. This preserves the deferred execution model that compat exists for.

### Existing CompatSpec (for comparison)

```typescript
// Current type in packages/core/src/types/element/compat-spec.ts (79 lines)
// Stores unevaluated fieldsBuilder callback for deferred execution.
type CompatSpec<TSchema, TOperationType, TOperationName, TVarDefinitions, TFields> = {
  readonly schema: TSchema;
  readonly operationType: TOperationType;
  readonly operationName: TOperationName;
  readonly variables: TVarDefinitions;
  readonly fieldsBuilder: FieldsBuilder<...>;
};

type AnyCompatSpec = CompatSpec<AnyGraphqlSchema, OperationType, string, VariableDefinitions, AnyFields>;

type ExtractCompatSpec<T> = T extends CompatSpec<
  infer TSchema, infer TOperationType, infer TOperationName, infer TVarDefinitions, infer TFields
> ? { schema: TSchema; operationType: TOperationType; operationName: TOperationName; variables: TVarDefinitions; fields: TFields; }
  : never;
```

### Existing compat.ts composer (64 lines)

```typescript
// packages/core/src/composer/compat.ts
// Creates GqlDefine<CompatSpec<...>> from callback builder options.
export const createCompatComposer = <TSchema, TOperationType>(schema, operationType) => {
  // Validates operationType exists in schema
  // Returns function: (options: CompatOptions) => GqlDefine<CompatSpec<...>>
  // Stores: { schema, operationType, operationName, variables, fieldsBuilder }
};
```

### Existing extend.ts composer (110 lines)

```typescript
// packages/core/src/composer/extend.ts
// Creates Operations from compat specs.
export const createExtendComposer = <TSchema, TAdapter>(schema, adapter?, transformDocument?) => {
  // Returns function: (compat: GqlDefine<CompatSpec<...>>, options?) => Operation
  // Extracts spec from GqlDefine via compat.value
  // Calls buildOperationArtifact() with fieldsBuilder from spec
  // Passes adapter and metadata/transformDocument from options
};
```

### Existing operation-core.ts (261 lines)

```typescript
// packages/core/src/composer/operation-core.ts
// Core operation building logic.
export type OperationCoreParams<...> = {
  schema, operationType, operationTypeName, operationName,
  variables,        // VariableDefinitions (VarSpecifier records)
  fieldsFactory,    // FieldsBuilder callback
  adapter, metadata?, transformDocument?, adapterTransformDocument?,
};

export const buildOperationArtifact = (params: OperationCoreParams<...>) => {
  // 1. Creates variable refs ($) and field factories (f)
  // 2. Evaluates fieldsFactory({ f, $ }) with fragment tracking
  // 3. Calls buildDocument() to produce DocumentNode
  // 4. Handles metadata (sync/async)
  // 5. Applies document transformations
  // Returns OperationArtifactResult or Promise<OperationArtifactResult>
};
```

### GqlDefine class (100 lines)

```typescript
// packages/core/src/types/element/define.ts
// GqlDefine<TValue> wraps a factory and lazily evaluates it.
// GqlDefine.create<TValue>(factory: () => TValue) => GqlDefine<TValue>
// instance.value triggers lazy evaluation and returns TValue.
```

### API contract (from RFC)

```typescript
// Direct mode -- tagged template produces Operation immediately:
const GetUser = gql.default(({ query }) => query`
  query GetUser($userId: ID!) { user(id: $userId) { id name } }
`());

// Compat mode -- tagged template produces deferred GqlDefine<TemplateCompatSpec>:
const GetUserCompat = gql.default(({ query }) => query.compat`
  query GetUser($userId: ID!) { user(id: $userId) { id name } }
`);
// NOTE: No () call -- compat returns GqlDefine directly, not TemplateResult

// Extend -- builds Operation from compat spec:
const GetUser = gql.default(({ extend }) =>
  extend(GetUserCompat, {
    metadata: { headers: { "X-Auth": "token" } },
    transformDocument: (doc) => addDirectives(doc),
  })
);
```

### Round 1-2 outputs (available functions)

```typescript
// packages/core/src/graphql/parser.ts (Round 1, Task 1.1)
import type { Result } from "../graphql/result";
import type { ParseResult, GraphqlAnalysisError } from "../graphql/types";
export const parseGraphqlSource = (
  source: string,
  sourceFile: string,  // required, not optional
): Result<ParseResult, GraphqlAnalysisError>;
// ParseResult = { document: DocumentNode, operations: ParsedOperation[], fragments: ParsedFragment[] }
// Access raw AST via: result.value.document (after checking result.ok)

// packages/core/src/graphql/var-specifier-builder.ts (Round 1, Task 1.4)
import type { SchemaIndex } from "../graphql/schema-index";
export const buildVarSpecifier = (
  varDefNode: VariableDefinitionNode,
  schema: SchemaIndex,  // SchemaIndex, NOT AnyGraphqlSchema
): BuiltVarSpecifier;

// packages/core/src/graphql/schema-adapter.ts (Round 1, Task 1.2)
import type { AnyGraphqlSchema } from "../types/schema/schema";
export const createSchemaIndexFromSchema = (
  schema: AnyGraphqlSchema,
): SchemaIndex;
// Use this to convert AnyGraphqlSchema before calling buildVarSpecifier
```

### Error handling

Composers use `throw new Error()` consistently (not neverthrow). This is established convention for the composer layer. The builder's VM execution layer catches composer errors via try/catch and wraps them appropriately.

### Existing test structure

- `packages/core/src/composer/compat.test.ts` (175 lines) -- tests `createCompatComposer` for query/mutation/subscription, validates GqlDefine instance, stored properties, and error handling
- `packages/core/src/composer/extend.test.ts` (252 lines) -- tests `createExtendComposer` for basic extend, metadata handling, document access, mutation/subscription compat

Both test files use `basicTestSchema` fixture from `packages/core/test/fixtures/`.

## Tasks

### Task 3.1: TemplateCompatSpec type

**Commit message**: `feat(core): add TemplateCompatSpec type for tagged template compat`

**Files**:
- Modify: `packages/core/src/types/element/compat-spec.ts` (79 lines -> ~130 lines)

**Types**:
```typescript
// New type -- added alongside existing CompatSpec
export type TemplateCompatSpec = {
  readonly schema: AnyGraphqlSchema;
  readonly operationType: OperationType;
  readonly operationName: string;
  readonly graphqlSource: string;
};

// Type guard -- distinguishes TemplateCompatSpec from CompatSpec at runtime
export const isTemplateCompatSpec = (
  spec: AnyCompatSpec | TemplateCompatSpec
): spec is TemplateCompatSpec => {
  return "graphqlSource" in spec && !("fieldsBuilder" in spec);
};

// Updated union -- extend accepts either spec type
export type AnyExtendableSpec = AnyCompatSpec | TemplateCompatSpec;
```

**Implementation**:

1. Add `TemplateCompatSpec` type after the existing `CompatSpec` type definition (after line 53)
2. Add `isTemplateCompatSpec` type guard function
3. Add `AnyExtendableSpec` union type that combines `AnyCompatSpec | TemplateCompatSpec`
4. Keep `AnyCompatSpec` and `ExtractCompatSpec` unchanged -- existing code depends on them
5. Export all new types from the module

**Key considerations**:
- `TemplateCompatSpec` is intentionally NOT generic (unlike `CompatSpec` which has 5 type parameters). Tagged template compat does not carry type-level field or variable information -- types come from typegen.
- The `graphqlSource` field stores the raw string exactly as written in the tagged template, before any parsing or preprocessing.
- `isTemplateCompatSpec` uses structural discrimination (`"graphqlSource" in spec`) rather than a discriminant tag, because `CompatSpec` does not have a discriminant field.

**Dependencies**: None (first task in the round).

**Validation**:
- `bun typecheck` passes
- Existing tests in `compat.test.ts` and `extend.test.ts` still pass (no changes to existing types)

**Subagent**: No -- this is a main-context task (foundational type, small scope, needed by other tasks).

---

### Task 3.2: Compat tagged template

**Commit message**: `feat(core): add compat tagged template for deferred operation specs`

**Files**:
- New: `packages/core/src/composer/compat-tagged-template.ts` (~60 lines)
- New: `packages/core/src/composer/compat-tagged-template.test.ts` (~120 lines)

**Types**:
```typescript
// Return type of createCompatTaggedTemplate
export type CompatTaggedTemplate = (
  strings: TemplateStringsArray,
  ...values: never[]
) => GqlDefine<TemplateCompatSpec>;

// Factory signature
export const createCompatTaggedTemplate: (
  schema: AnyGraphqlSchema,
  operationType: OperationType,
) => CompatTaggedTemplate;
```

**Implementation**:

1. Create `compat-tagged-template.ts` with `createCompatTaggedTemplate(schema, operationType)`:
   - Validate that `operationType` exists in `schema.operations` (same pattern as `compat.ts` line 47-49)
   - Return a tagged template function that:
     a. Joins the `TemplateStringsArray` into a single string (no interpolation values allowed -- `...values: never[]`)
     b. Validates the GraphQL string has valid syntax by calling `parseGraphqlSource(source, "<compat-tagged-template>")` from `core/src/graphql/`. Unwraps the `Result`: if `!parsed.ok`, throws with the error message.
     c. Extracts the operation name from the parsed `DocumentNode` (first `OperationDefinitionNode`'s `name.value`)
     d. Validates the parsed operation type matches the expected `operationType`
     e. Returns `GqlDefine.create(() => templateCompatSpec)` where `templateCompatSpec` is:
        ```typescript
        { schema, operationType, operationName, graphqlSource: source }
        ```
   - The parsed `DocumentNode` is used only for validation and name extraction, then discarded. The raw `graphqlSource` string is what gets stored.

2. Create `compat-tagged-template.test.ts`:
   - Test: `query.compat\`...\`` returns a `GqlDefine` instance
   - Test: `GqlDefine.value` contains correct `schema`, `operationType`, `operationName`, `graphqlSource`
   - Test: Rejects interpolation values (TypeScript-level enforcement via `never[]`)
   - Test: Throws on invalid GraphQL syntax
   - Test: Throws on operation type mismatch (e.g., `mutation.compat\`query ...\``)
   - Test: Throws when operation type is not defined in schema roots
   - Test: Works with mutation and subscription operation types
   - Use `basicTestSchema` fixture consistent with existing tests

**Key considerations**:
- Unlike `query\`...\`()` (direct mode from Round 2), `query.compat\`...\`` does NOT return a `TemplateResult`. It returns `GqlDefine<TemplateCompatSpec>` directly. There is no `()` call.
- GraphQL syntax validation happens at definition-time (when the tagged template is evaluated), NOT at extend-time. This provides early error detection.
- The raw `graphqlSource` string is stored, not the parsed AST. This matches the design decision that compat stores raw source for deferred execution.

**Dependencies**: Task 3.1 (`TemplateCompatSpec` type).

**Validation**:
- `bun run test packages/core/src/composer/compat-tagged-template.test.ts` passes
- `bun typecheck` passes

**Subagent**: Yes -- eligible for parallel execution with Task 3.3.

---

### Task 3.3: Compat composer update

**Commit message**: `refactor(core): ensure compat composer coexists with tagged template compat`

**Files**:
- Modify: `packages/core/src/composer/compat.ts` (64 lines -- minimal changes expected)
- Verify: `packages/core/src/composer/compat.test.ts` (175 lines -- no changes, must still pass)

**Types**: No new types. Existing types and exports unchanged.

**Implementation**:

1. Review `compat.ts` to ensure it does not conflict with the new `compat-tagged-template.ts`:
   - `createCompatComposer` returns `GqlDefine<CompatSpec<...>>` (callback builder path)
   - `createCompatTaggedTemplate` returns `GqlDefine<TemplateCompatSpec>` (tagged template path)
   - Both return `GqlDefine` wrappers, but with different spec types inside
   - No naming collisions: `createCompatComposer` vs `createCompatTaggedTemplate`

2. Verify the import in `compat.ts` of `CompatSpec` from `compat-spec.ts` still resolves correctly after Task 3.1 adds new types to that module.

3. If needed, add a comment to `compat.ts` clarifying the two compat paths:
   ```typescript
   // Callback builder compat path. For tagged template compat, see compat-tagged-template.ts
   ```

4. Run existing tests to confirm no regressions.

**Key considerations**:
- This task is intentionally minimal. The existing callback builder compat path is retained as-is per the RFC. The two compat paths (callback builder and tagged template) coexist independently.
- No changes to `CompatOptions` type or `createCompatComposer` function signature.

**Dependencies**: Task 3.1 (`TemplateCompatSpec` type added to `compat-spec.ts` -- must not break existing imports).

**Validation**:
- `bun run test packages/core/src/composer/compat.test.ts` passes (all 6 existing tests)
- `bun typecheck` passes

**Subagent**: Yes -- eligible for parallel execution with Task 3.2.

---

### Task 3.4: Extend adaptation

**Commit message**: `feat(core): adapt extend to handle TemplateCompatSpec from tagged template compat`

**Files**:
- Modify: `packages/core/src/composer/extend.ts` (110 lines -> ~180 lines)
- Modify: `packages/core/src/composer/extend.test.ts` (252 lines -> ~380 lines)

**Types**:
```typescript
// The extend function's compat parameter type broadens to accept both spec types.
// Before: compat: GqlDefine<CompatSpec<TSchema, TOperationType, ...>>
// After:  compat: GqlDefine<CompatSpec<TSchema, TOperationType, ...>> | GqlDefine<TemplateCompatSpec>

// For the TemplateCompatSpec path, the function returns Operation with AnyFields
// (no type-level field information -- types come from typegen prebuilt types).
```

**Implementation**:

1. Add imports to `extend.ts`:
   ```typescript
   import { type TemplateCompatSpec, isTemplateCompatSpec } from "../types/element/compat-spec";
   import { parseGraphqlSource, buildVarSpecifier, createSchemaIndexFromSchema } from "../graphql";
   ```

2. Broaden the `createExtendComposer` return function to accept both spec types. Add a function overload or union parameter type.

3. Inside the extend function body, after extracting `const spec = compat.value`, add a branch:
   ```typescript
   if (isTemplateCompatSpec(spec)) {
     // TemplateCompatSpec path -- parse GraphQL and build operation
     return buildOperationFromTemplateSpec(spec, schema, options, resolvedAdapter, transformDocument);
   }
   // Existing CompatSpec path continues below (unchanged)
   ```

4. Implement `buildOperationFromTemplateSpec` (private helper, can be inline or extracted):
   ```typescript
   // 1. Parse graphqlSource into ParseResult via Result type
   const parsed = parseGraphqlSource(spec.graphqlSource, "<compat-tagged-template>");
   if (!parsed.ok) throw new Error(parsed.error.message);
   const { document } = parsed.value;

   // 2. Extract OperationDefinitionNode
   const opDef = document.definitions.find(
     (d) => d.kind === Kind.OPERATION_DEFINITION
   ) as OperationDefinitionNode;

   // 3. Build VarSpecifiers from variable definitions (adapter pattern)
   const schemaIndex = createSchemaIndexFromSchema(spec.schema);
   const variables: Record<string, BuiltVarSpecifier> = {};
   for (const varDef of opDef.variableDefinitions ?? []) {
     const varName = varDef.variable.name.value;
     variables[varName] = buildVarSpecifier(varDef, schemaIndex);
   }

   // 4. Get operation type name from schema
   const operationTypeName = schema.operations[spec.operationType];

   // 5. Call buildOperationArtifact with the parsed data
   // NOTE: For the TemplateCompatSpec path, we need a different approach
   // because we have a DocumentNode already, not a fieldsBuilder callback.
   // We can use the document directly rather than going through buildDocument.
   ```

5. **Critical design point**: The TemplateCompatSpec path has a parsed `DocumentNode` from the raw GraphQL source. It does NOT go through `fieldsBuilder` -> `createFieldFactories` -> `buildDocument`. Instead, it should:
   - Use the parsed `DocumentNode` directly as the operation document
   - Create variable refs ($) from the extracted `VarSpecifiers` for the metadata builder
   - Construct the `OperationArtifactResult` directly, using the parsed document
   - Apply metadata and document transformations as normal

   This means we cannot directly reuse `buildOperationArtifact` (which expects a `fieldsFactory` callback). Instead, implement a parallel path that:
   ```typescript
   // a. Parse source
   const parsed = parseGraphqlSource(spec.graphqlSource, "<compat-tagged-template>");
   if (!parsed.ok) throw new Error(parsed.error.message);
   const parsedDoc = parsed.value.document;

   // b. Build VarSpecifiers (adapter pattern)
   const schemaIndex = createSchemaIndexFromSchema(spec.schema);
   const opDef = parsedDoc.definitions.find(d => d.kind === Kind.OPERATION_DEFINITION) as OperationDefinitionNode;
   const variables = buildVarSpecifiers(opDef.variableDefinitions ?? [], schemaIndex);

   // c. Create var refs for metadata builder
   const $ = createVarRefs(variables);

   // d. Build the artifact result
   // - documentSource: () => ({} as never)  (compatibility bridge -- no fields data for TT compat)
   // - document: parsedDoc (already a valid DocumentNode)
   // - Handle metadata (sync/async) using the same pattern as operation-core.ts
   // - Apply transformDocument if provided
   ```

6. Add new tests in `extend.test.ts`:
   - Test: `extend(templateCompat)` returns an `Operation` instance
   - Test: `Operation` has correct `operationType`, `operationName`, `variableNames`
   - Test: `Operation.document` contains the parsed GraphQL
   - Test: `extend(templateCompat, { metadata })` builds metadata correctly
   - Test: Metadata builder receives `$` with variable refs from parsed variables
   - Test: Metadata builder receives `document`
   - Test: Works with mutation and subscription compat specs
   - Test: Existing `CompatSpec` tests still pass (regression check)

7. Keep the existing `CompatSpec` path completely unchanged -- the `isTemplateCompatSpec` guard routes to the new path only for tagged template compat specs.

**Key considerations**:
- The `documentSource` for `TemplateCompatSpec` path returns `() => ({} as never)`. Tagged template compat does not have fields data from the callback builder DSL. This is acceptable because the `documentSource` compatibility bridge is only needed for the callback builder path. The tagged template path will use the document directly.
- Fragment usage tracking (`withFragmentUsageCollection`) is NOT needed for the TemplateCompatSpec path -- fragment spreads are already embedded in the GraphQL source string and appear in the parsed document.
- The metadata handling pattern (sync/async, fragment metadata aggregation, document transforms) should mirror `operation-core.ts` steps 4-10 for the metadata and transform portions. Fragment metadata from `withFragmentUsageCollection` is empty for the template compat path since there are no programmatic fragment usages.
- Type safety: The `TemplateCompatSpec` path produces `Operation` with `AnyFields` type (no type-level field information). This is acceptable because tagged template types come from typegen prebuilt types, not from TypeScript inference.

**Dependencies**: Task 3.1 (`TemplateCompatSpec` and `isTemplateCompatSpec`), Task 3.2 (`createCompatTaggedTemplate` -- needed for integration-style tests, but extend.test.ts can construct `GqlDefine<TemplateCompatSpec>` directly via `GqlDefine.create()`).

**Validation**:
- `bun run test packages/core/src/composer/extend.test.ts` passes (all existing + new tests)
- `bun typecheck` passes
- Integration check: Create `TemplateCompatSpec` via `GqlDefine.create()`, pass to `extend()`, verify `Operation` output

**Subagent**: No -- this is a main-context task (modifies shared extend.ts, complex logic, depends on 3.1 + 3.2).

## Subagent Parallelization Map

```
[3.1 TemplateCompatSpec type]              <- main context (first)
         |
         v
[3.2 compat TT] [3.3 compat update]       <- parallel subagent (after 3.1)
         |              |
         v              v
[3.4 extend adaptation]                    <- main context (after 3.2 + 3.3)
```

**Execution order**:
1. Task 3.1 runs in main context (small, foundational)
2. Tasks 3.2 and 3.3 run in parallel subagents (independent files, no conflicts)
3. Task 3.4 runs in main context after 3.2 and 3.3 complete (depends on both)

**File isolation**:
- Task 3.1: `packages/core/src/types/element/compat-spec.ts`
- Task 3.2: `packages/core/src/composer/compat-tagged-template.ts` (new) + test
- Task 3.3: `packages/core/src/composer/compat.ts` (minimal changes)
- Task 3.4: `packages/core/src/composer/extend.ts` + test

No file conflicts between parallel tasks 3.2 and 3.3.

## Round 3 Verification

After all 4 tasks are complete, run the following verification steps:

### Test verification

```bash
# All compat tests (existing callback builder + new tagged template)
bun run test packages/core/src/composer/compat.test.ts
bun run test packages/core/src/composer/compat-tagged-template.test.ts

# All extend tests (existing + new TemplateCompatSpec path)
bun run test packages/core/src/composer/extend.test.ts

# Full test suite (ensure no regressions)
bun run test
```

### Type check verification

```bash
bun typecheck
```

### Integration verification

The following end-to-end flow must work:

1. `query.compat\`query GetUser($id: ID!) { user(id: $id) { id name } }\`` produces `GqlDefine<TemplateCompatSpec>` with `graphqlSource` stored
2. `extend(compat)` produces an `Operation` with:
   - `operationType === "query"`
   - `operationName === "GetUser"`
   - `variableNames === ["id"]`
   - `document` is a valid `DocumentNode` containing the parsed query
3. `extend(compat, { metadata: (...) => ({ headers: { "X-Auth": "token" } }) })` produces an `Operation` with metadata attached

### What is NOT verified in Round 3

- Hybrid context integration (`query.compat` wired into `gql-composer.ts`) -- this is Round 4
- Integration with the tagged template direct mode (`query\`...\`()`) -- Round 2 handles this
- Typegen support for TemplateCompatSpec -- Phase 2

## References

- [Phase 1 Implementation Plan](./tagged-template-unification-phase1.md) -- parent plan with full task overview
- [Implementation Strategy](./tagged-template-unification.md) -- strategy decision record
- [RFC: Design Decisions](../rfcs/tagged-template-unification/design-decisions.md) -- Section 5.1 context shape, compat mode
- [RFC: Resolved Questions](../rfcs/tagged-template-unification/resolved-questions.md) -- extend() feature, TemplateResult pattern
- [RFC: Affected Areas](../rfcs/tagged-template-unification/affected-areas.md) -- Phase 1 scope

### Key source files

| File | Lines | Role |
|------|-------|------|
| `packages/core/src/types/element/compat-spec.ts` | 79 | CompatSpec type (modified in Task 3.1) |
| `packages/core/src/composer/compat.ts` | 64 | Callback builder compat composer (reviewed in Task 3.3) |
| `packages/core/src/composer/compat.test.ts` | 175 | Existing compat tests (must not regress) |
| `packages/core/src/composer/extend.ts` | 110 | Extend composer (modified in Task 3.4) |
| `packages/core/src/composer/extend.test.ts` | 252 | Existing extend tests (extended in Task 3.4) |
| `packages/core/src/composer/operation-core.ts` | 261 | Core operation building logic (reference for Task 3.4) |
| `packages/core/src/types/element/define.ts` | 100 | GqlDefine class (used by compat tagged template) |
| `packages/core/src/composer/gql-composer.ts` | 210 | Main composer entry point (wired in Round 4, not this round) |

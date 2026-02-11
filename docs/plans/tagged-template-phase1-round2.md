# Phase 1 Round 2: Operation & Fragment Tagged Templates + Hybrid Context Integration

## Purpose

Implement tagged template functions for `query`/`mutation`/`subscription` and `fragment`, then integrate them into the hybrid context in `gql-composer.ts`.

**Prerequisites**: Round 1 complete -- all `packages/core/src/graphql/` utilities available (`parseGraphqlSource`, `preprocessFragmentArgs`, `buildVarSpecifier`).

**Scope**: `packages/core/src/composer/` (new files + modify `gql-composer.ts`)

**Parent plan**: [Phase 1 Implementation Plan](./tagged-template-unification-phase1.md)

---

## Shared Context

### TemplateResult type (new for Round 2)

```typescript
// Internal intermediate type returned by tagged template functions.
// Never escapes the callback -- always resolved via () call.
type TemplateResult<TElement extends AnyOperation | AnyFragment> = {
  (options?: TemplateResultMetadataOptions): TElement;
};

type TemplateResultMetadataOptions = {
  metadata?: unknown;
};
```

`TemplateResult` is callable with an optional options parameter:
- `()` -- resolves to `Operation`/`Fragment` without metadata
- `({ metadata: { ... } })` -- resolves to `Operation`/`Fragment` with metadata
- The `()` call is **always required** -- `TemplateResult` never escapes the callback

### Round 1 outputs (available functions)

These functions are provided by Round 1 in `packages/core/src/graphql/`:

```typescript
// packages/core/src/graphql/parser.ts
import { parseGraphqlSource } from "../graphql/parser";
// Parses a GraphQL source string and extracts operations and fragments.
// Returns Result<ParseResult, GraphqlAnalysisError>.
function parseGraphqlSource(
  source: string,
  sourceFile: string
): Result<ParseResult, GraphqlAnalysisError>;

// packages/core/src/graphql/fragment-args-preprocessor.ts
import { preprocessFragmentArgs } from "../graphql/fragment-args-preprocessor";
// Strips Fragment Arguments RFC syntax by replacing argument lists with spaces.
// Preserves line/column alignment.
function preprocessFragmentArgs(content: string): PreprocessResult;
// PreprocessResult = { preprocessed: string; modified: boolean; }

// packages/core/src/graphql/var-specifier-builder.ts
import { buildVarSpecifier } from "../graphql/var-specifier-builder";
// Builds a VarSpecifier from a VariableDefinitionNode and schema.
// Resolves kind (scalar/enum/input) by looking up the type name in the schema.
function buildVarSpecifier(
  varDefNode: VariableDefinitionNode,
  schema: SchemaIndex
): VarSpecifier;

// packages/core/src/graphql/schema-adapter.ts
import { createSchemaIndexFromSchema } from "../graphql/schema-adapter";
// Converts AnyGraphqlSchema to a minimal SchemaIndex (name-resolution only).
// Use before calling buildVarSpecifier from the composer layer.
function createSchemaIndexFromSchema(schema: AnyGraphqlSchema): SchemaIndex;
```

The `ParseResult` type contains:

```typescript
type ParseResult = {
  readonly document: DocumentNode;
  readonly operations: readonly ParsedOperation[];
  readonly fragments: readonly ParsedFragment[];
};

type ParsedOperation = {
  readonly kind: "query" | "mutation" | "subscription";
  readonly name: string;
  readonly variables: readonly ParsedVariable[];
  readonly selections: readonly ParsedSelection[];
  readonly sourceFile: string;
};

type ParsedFragment = {
  readonly name: string;
  readonly onType: string;
  readonly selections: readonly ParsedSelection[];
  readonly sourceFile: string;
};
```

### Existing functions to reuse

**`buildOperationArtifact`** from `packages/core/src/composer/operation-core.ts` (261 lines):
- Builds an operation artifact from parameters: schema, operationType, operationName, variables, fieldsFactory, adapter, metadata, transformDocument
- Creates variable refs (`$`) and field factories (`f`), evaluates fields with fragment usage tracking, builds the document, handles metadata aggregation
- Returns `OperationArtifactResult` (sync) or `Promise<OperationArtifactResult>` (async metadata)

**`Operation.create`** from `packages/core/src/types/element/operation.ts` (179 lines):
```typescript
static create<TSchema, TOperationType, TOperationName, TVarDefinitions, TFields>(
  define: (context: GqlElementContext | null) => {
    operationType: TOperationType;
    operationName: TOperationName;
    schemaLabel: TSchema["label"];
    variableNames: (keyof TVarDefinitions & string)[];
    documentSource: () => TFields;
    document: TypedDocumentNode<...>;
    metadata?: unknown;
  } | Promise<{...}>
) => Operation<...>;
```

**`Fragment.create`** from `packages/core/src/types/element/fragment.ts` (124 lines):
```typescript
static create<TSchema, TTypeName, TVariableDefinitions, TFields>(
  define: () => {
    typename: TTypeName;
    key: string | undefined;
    schemaLabel: TSchema["label"];
    variableDefinitions: TVariableDefinitions;
    spread: (variables: OptionalArg<...>) => TFields;
  }
) => Fragment<...>;
```

### Error handling

Composers use `throw new Error()` (NOT neverthrow). This is consistent with all existing composers (`operation.ts`, `compat.ts`, `fields-builder.ts`, `var-builder.ts`). The builder's VM execution layer catches composer errors via `try/catch`.

### Design decisions (from RFC)

1. **`query`/`mutation`/`subscription` are hybrid**: tagged template function + `.operation()` + `.compat`. Created via `Object.assign`.
2. **`fragment` is a pure tagged template function**: No `.User()`, `.Post()` type-keyed builders. The `on User` type condition is part of the GraphQL syntax.
3. **TemplateResult `()` call always required**: Optional options parameter for metadata. No `.resolve()` method.
4. **No interpolation in tagged templates**: `values.length` must be 0 -- tagged templates must not contain `${...}` expressions.
5. **Fragment Arguments syntax**: Preprocessed before parsing via `preprocessFragmentArgs`.
6. **VarSpecifier construction**: AST + schema resolution at creation time -- no placeholders.

---

## Task 2.1: Operation Tagged Template

**Commit message**: `feat(core): add operation tagged template function`

### Files

| File | Action | Line estimate |
|------|--------|---------------|
| `packages/core/src/composer/operation-tagged-template.ts` | **New** | ~120 |
| `packages/core/src/composer/operation-tagged-template.test.ts` | **New** | ~180 |

### Types

```typescript
// Exported factory function signature
export const createOperationTaggedTemplate: <TSchema extends AnyGraphqlSchema>(
  schema: TSchema,
  operationType: OperationType,
  metadataAdapter?: AnyMetadataAdapter,
  transformDocument?: DocumentTransformer<...>,
) => OperationTaggedTemplateFunction;

// The tagged template function type
type OperationTaggedTemplateFunction = (
  strings: TemplateStringsArray,
  ...values: never[]
) => TemplateResult<AnyOperation>;

// TemplateResult -- callable, resolves to Operation
type TemplateResult<TElement extends AnyOperation | AnyFragment> = {
  (options?: TemplateResultMetadataOptions): TElement;
};

type TemplateResultMetadataOptions = {
  metadata?: unknown;
};
```

### Implementation

`createOperationTaggedTemplate(schema, operationType, metadataAdapter?, transformDocument?)` returns a tagged template function that:

1. **Validates no interpolation**: Throws if `values.length > 0` -- tagged templates must not contain `${...}` expressions.
2. **Extracts source**: Joins `strings` array (for the zero-interpolation case this is just `strings[0]`).
3. **Parses GraphQL**: Calls `parseGraphqlSource(source, "<tagged-template>")`. On error, unwraps the `Result` and throws (composer layer uses `throw`).
4. **Validates operation type**: Checks that the parsed result contains exactly one operation definition. Validates that the operation's `kind` matches the expected `operationType` (e.g., calling `query\`...\`` with a `mutation` definition is an error).
5. **Validates operation name**: Anonymous operations (no name) throw an error.
6. **Extracts variable definitions**: Parses `VariableDefinitionNode` entries from the GraphQL AST using `graphql-js`'s `parse` result. Converts `schema` (AnyGraphqlSchema) to `SchemaIndex` via `createSchemaIndexFromSchema(schema)`. For each variable definition node, calls `buildVarSpecifier(varDefNode, schemaIndex)` to build a `VarSpecifier`.
7. **Returns TemplateResult**: A callable function that accepts optional `{ metadata }` and returns an `Operation`.

The `TemplateResult` call:

1. Creates an `Operation` via `Operation.create` with a lazy factory function.
2. The lazy factory calls `buildOperationArtifact` with:
   - `schema`, `operationType`, `operationTypeName` (from `schema.operations[operationType]`)
   - `operationName` (from parsed AST)
   - `variables` (built `VarSpecifier` record)
   - `fieldsFactory` -- a compatibility bridge function that creates field selections from the parsed AST (see note below)
   - `adapter`, `metadata`, `transformDocument`, `adapterTransformDocument`

**Note on `fieldsFactory` compatibility bridge**: The `buildOperationArtifact` function expects a `fieldsFactory: ({ f, $ }) => TFields` callback. For tagged templates, this factory is constructed to produce field selection data from the GraphQL AST. The factory calls `createFieldFactories(schema, operationTypeName)` and `createVarRefs(variables)` internally, then uses the parsed selections to drive the field factories. This is the `documentSource` compatibility bridge described in the RFC. The exact implementation of this bridge depends on Round 1's GraphQL transformer utilities.

**Alternative simplified approach**: If the Round 1 transformer provides a `buildDocumentFromParsedSource` function that can produce a `TypedDocumentNode` directly from parsed GraphQL (bypassing `fieldsFactory`), the implementation can skip `buildOperationArtifact` entirely and construct the `OperationArtifact` directly:

```typescript
// Simplified path: construct artifact directly from parsed GraphQL
return Operation.create(() => ({
  operationType,
  operationName: parsedOp.name,
  schemaLabel: schema.label,
  variableNames: Object.keys(varDefs),
  documentSource: () => ({} as never), // Compatibility stub
  document: parse(source), // Already a DocumentNode from graphql-js
  metadata: options?.metadata,
}));
```

The implementer should choose between these approaches based on what Round 1 actually provides. The simplified approach is preferred if `buildOperationArtifact`'s field evaluation is unnecessary for tagged templates (since the document is already parsed).

### Dependencies

- Round 1 outputs: `parseGraphqlSource`, `buildVarSpecifier`, `createSchemaIndexFromSchema`
- Existing: `Operation.create` (`packages/core/src/types/element/operation.ts`)
- Existing: `buildOperationArtifact` (`packages/core/src/composer/operation-core.ts`)
- Existing: `AnyGraphqlSchema`, `OperationType` (`packages/core/src/types/schema/`)
- Existing: `VarSpecifier`, `VariableDefinitions` (`packages/core/src/types/type-foundation/type-specifier.ts`)
- GraphQL: `parse`, `VariableDefinitionNode` from `graphql`

### Validation

- Unit test: `query` tagged template parses a valid query and produces an `Operation` with correct `operationType`, `operationName`, `variableNames`, `document`
- Unit test: `mutation` tagged template produces correct `operationType: "mutation"`
- Unit test: `subscription` tagged template produces correct `operationType: "subscription"`
- Unit test: Throws when operation type mismatches (e.g., `query\`mutation Foo ...\``)
- Unit test: Throws when source contains interpolation (`values.length > 0`)
- Unit test: Throws on anonymous operations (no name)
- Unit test: Throws on parse errors (invalid GraphQL syntax)
- Unit test: Metadata is passed through when `TemplateResult` is called with `{ metadata }`
- Unit test: Multiple variable definitions are correctly converted to `VarSpecifier` records

### Subagent eligibility

**Eligible for subagent** -- parallel with Task 2.2. No file overlap.

---

## Task 2.2: Fragment Tagged Template

**Commit message**: `feat(core): add fragment tagged template function`

### Files

| File | Action | Line estimate |
|------|--------|---------------|
| `packages/core/src/composer/fragment-tagged-template.ts` | **New** | ~140 |
| `packages/core/src/composer/fragment-tagged-template.test.ts` | **New** | ~200 |

### Types

```typescript
// Exported factory function signature
export const createFragmentTaggedTemplate: <TSchema extends AnyGraphqlSchema>(
  schema: TSchema,
) => FragmentTaggedTemplateFunction;

// The tagged template function type
type FragmentTaggedTemplateFunction = (
  strings: TemplateStringsArray,
  ...values: never[]
) => TemplateResult<AnyFragment>;
```

### Implementation

`createFragmentTaggedTemplate(schema)` returns a tagged template function that:

1. **Validates no interpolation**: Throws if `values.length > 0`.
2. **Extracts raw source**: Joins `strings` array to get the raw GraphQL string (contains Fragment Arguments syntax).
3. **Extracts variable definitions from raw source**: Before preprocessing, uses a regex or mini-parser to extract `fragment Name($var: Type, ...)` argument lists. Then parses these argument variable definitions by re-parsing just the variable declaration portion, or by extracting `VariableDefinitionNode` entries from a synthetic operation wrapper. Converts `schema` (AnyGraphqlSchema) to `SchemaIndex` via `createSchemaIndexFromSchema(schema)`. For each variable definition, calls `buildVarSpecifier(varDefNode, schemaIndex)` to produce a `VarSpecifier`.
4. **Preprocesses Fragment Arguments**: Calls `preprocessFragmentArgs(rawSource)` to strip argument syntax (replace with whitespace, preserving positions).
5. **Parses GraphQL**: Calls `parseGraphqlSource(preprocessedSource, "<tagged-template>")` on the preprocessed content. On error, unwraps the `Result` and throws.
6. **Validates fragment**: Checks that the parsed result contains exactly one fragment definition. Validates that the fragment's `onType` exists in `schema.object`.
7. **Returns TemplateResult**: A callable function that accepts optional `{ metadata }` and returns a `Fragment`.

The `TemplateResult` call:

1. Creates a `Fragment` via `Fragment.create` with a lazy factory function.
2. The lazy factory produces:
   - `typename`: From parsed fragment's `onType`
   - `key`: The fragment name (from parsed AST) -- used as prebuilt registry key
   - `schemaLabel`: From `schema.label`
   - `variableDefinitions`: The `VarSpecifier` record built from raw source
   - `spread`: A function that, when called with variables, creates field selections from the parsed AST

**Fragment `spread` function implementation**:

The `spread(variables)` function is the fragment's field evaluation mechanism. For tagged template fragments, it needs to:

1. Create `VarAssignments` from the provided variables using `createVarAssignments(varDefinitions, variables)`
2. Record fragment usage via `recordFragmentUsage({ metadataBuilder, path })` where `metadataBuilder` is derived from the metadata option if provided
3. Return field selections derived from the parsed GraphQL AST

This mirrors the pattern in `packages/core/src/composer/fragment.ts` (lines 86-96) where the existing callback builder:
- Creates field factories with `createFieldFactories(schema, typename)`
- Creates var assignments with `createVarAssignments(varDefinitions, variables)`
- Records fragment usage with `recordFragmentUsage`
- Returns `fields({ f, $ })`

For tagged templates, the `spread` function constructs equivalent field selection data from the parsed AST rather than from callback builder factories. Similar to Task 2.1, this is the `documentSource` compatibility bridge.

**Variable definition extraction strategy**:

Fragment Arguments are not standard GraphQL and are stripped before parsing. To extract `VariableDefinitionNode` entries from the raw source:

1. Extract the argument list text `($var1: Type1, $var2: Type2 = default)` from the raw source using regex (match between `fragment Name(` and the matching `)`).
2. Wrap the extracted argument list in a synthetic query: `query _Synthetic(${argListText}) { __typename }`.
3. Parse the synthetic query with `graphql-js` `parse()`.
4. Extract `VariableDefinitionNode[]` from the parsed result.
5. Call `buildVarSpecifier(node, schemaIndex)` on each node (where `schemaIndex = createSchemaIndexFromSchema(schema)`).

This approach reuses `graphql-js`'s parser for variable type parsing rather than reimplementing it.

### Dependencies

- Round 1 outputs: `parseGraphqlSource`, `preprocessFragmentArgs`, `buildVarSpecifier`, `createSchemaIndexFromSchema`
- Existing: `Fragment.create` (`packages/core/src/types/element/fragment.ts`)
- Existing: `createVarAssignments` (`packages/core/src/composer/input.ts`)
- Existing: `recordFragmentUsage` (`packages/core/src/composer/fragment-usage-context.ts`)
- Existing: `createFieldFactories` (`packages/core/src/composer/fields-builder.ts`)
- Existing: `AnyGraphqlSchema` (`packages/core/src/types/schema/`)
- Existing: `VarSpecifier`, `VariableDefinitions` (`packages/core/src/types/type-foundation/type-specifier.ts`)
- GraphQL: `parse`, `VariableDefinitionNode` from `graphql`

### Validation

- Unit test: Fragment tagged template parses a valid fragment and produces a `Fragment` with correct `typename`, `key`, `schemaLabel`
- Unit test: Fragment with `on User` type condition resolves correctly
- Unit test: Fragment without variables produces empty `variableDefinitions`
- Unit test: Fragment with variables (Fragment Arguments syntax) correctly extracts `VarSpecifier` records
- Unit test: Fragment with default values in arguments extracts `defaultValue` correctly
- Unit test: Throws when source contains interpolation
- Unit test: Throws on parse errors
- Unit test: Throws when `onType` is not found in schema
- Unit test: Throws when source contains zero or multiple fragment definitions
- Unit test: `spread` function is callable and returns field selections
- Unit test: Metadata is passed through when `TemplateResult` is called with `{ metadata }`

### Subagent eligibility

**Eligible for subagent** -- parallel with Task 2.1. No file overlap.

---

## Task 2.3: Hybrid Context Integration

**Commit message**: `feat(core): integrate tagged templates into gql-composer hybrid context`

### Files

| File | Action | Line estimate |
|------|--------|---------------|
| `packages/core/src/composer/gql-composer.ts` | **Modify** | ~15 lines changed |

### Types

The `context` object shape changes from:

```typescript
// BEFORE (current, lines 150-170 of gql-composer.ts)
const context = {
  fragment,  // Record<string, FragmentBuilder> (type-keyed)
  query: {
    operation: createOperationComposer("query"),
    compat: createCompatComposer(schema, "query"),
  },
  mutation: {
    operation: createOperationComposer("mutation"),
    compat: createCompatComposer(schema, "mutation"),
  },
  subscription: {
    operation: createOperationComposer("subscription"),
    compat: createCompatComposer(schema, "subscription"),
  },
  // ...rest
};
```

To:

```typescript
// AFTER (hybrid context)
const queryTaggedTemplate = createOperationTaggedTemplate(schema, "query", metadataAdapter, transformDocument);
const context = {
  fragment: createFragmentTaggedTemplate(schema),  // Pure tagged template function
  query: Object.assign(queryTaggedTemplate, {
    operation: createOperationComposer("query"),
    compat: createCompatComposer(schema, "query"),
  }),
  mutation: Object.assign(
    createOperationTaggedTemplate(schema, "mutation", metadataAdapter, transformDocument),
    {
      operation: createOperationComposer("mutation"),
      compat: createCompatComposer(schema, "mutation"),
    },
  ),
  subscription: Object.assign(
    createOperationTaggedTemplate(schema, "subscription", metadataAdapter, transformDocument),
    {
      operation: createOperationComposer("subscription"),
      compat: createCompatComposer(schema, "subscription"),
    },
  ),
  // ...rest unchanged
};
```

The `AnyGqlContext` type updates from:

```typescript
// BEFORE (current, lines 198-209 of gql-composer.ts)
export type AnyGqlContext = {
  readonly fragment: Record<string, unknown>;
  readonly query: { operation: (...args: unknown[]) => AnyOperation; compat: (...args: unknown[]) => AnyGqlDefine };
  readonly mutation: { operation: (...args: unknown[]) => AnyOperation; compat: (...args: unknown[]) => AnyGqlDefine };
  readonly subscription: { operation: (...args: unknown[]) => AnyOperation; compat: (...args: unknown[]) => AnyGqlDefine };
  // ...rest
};
```

To:

```typescript
// AFTER
export type AnyGqlContext = {
  readonly fragment: (strings: TemplateStringsArray, ...values: never[]) => TemplateResult<AnyFragment>;
  readonly query: ((strings: TemplateStringsArray, ...values: never[]) => TemplateResult<AnyOperation>) & {
    operation: (...args: unknown[]) => AnyOperation;
    compat: (...args: unknown[]) => AnyGqlDefine;
  };
  readonly mutation: ((strings: TemplateStringsArray, ...values: never[]) => TemplateResult<AnyOperation>) & {
    operation: (...args: unknown[]) => AnyOperation;
    compat: (...args: unknown[]) => AnyGqlDefine;
  };
  readonly subscription: ((strings: TemplateStringsArray, ...values: never[]) => TemplateResult<AnyOperation>) & {
    operation: (...args: unknown[]) => AnyOperation;
    compat: (...args: unknown[]) => AnyGqlDefine;
  };
  // ...rest unchanged
};
```

### Implementation

Modifications to `packages/core/src/composer/gql-composer.ts`:

1. **Add imports**: Import `createOperationTaggedTemplate` from `./operation-tagged-template` and `createFragmentTaggedTemplate` from `./fragment-tagged-template`. Import `TemplateResult` type if needed for `AnyGqlContext`.

2. **Replace `fragment` context member** (line 141):
   - Remove: `const fragment = createGqlFragmentComposers<TSchema, TMetadataAdapter>(schema, metadataAdapter) as TFragmentBuilders;`
   - Add: `const fragment = createFragmentTaggedTemplate<TSchema>(schema);`
   - Remove the import of `createGqlFragmentComposers` from `./fragment`. (Note: do NOT delete `fragment.ts` itself -- it is still used by existing callback builder tests. Removal happens in Phase 4.)

3. **Create hybrid `query`/`mutation`/`subscription`** (lines 152-163):
   - Use `Object.assign` to combine tagged template function with `.operation` and `.compat` properties.
   - Each operation type gets its own `createOperationTaggedTemplate(schema, operationType, metadataAdapter, transformDocument)` call.

4. **Update `AnyGqlContext` type** (lines 198-209):
   - Change `fragment` from `Record<string, unknown>` to tagged template function type.
   - Change `query`/`mutation`/`subscription` from plain objects to intersection of tagged template function and property object.

5. **Update `FragmentBuildersAll` type** (lines 68-75): This type is exported and used by codegen. It references the old fragment builder pattern. It should be kept temporarily for backward compatibility but marked as deprecated, or updated to reflect the new tagged template function type. The decision depends on whether codegen generates references to this type. For Round 2, keep the type as-is if no compilation errors occur; otherwise, update it.

6. **Remove unused import**: Remove `type FragmentBuilderFor` from the import of `./fragment` if it is no longer referenced.

### Dependencies

- Task 2.1: `createOperationTaggedTemplate` must be available
- Task 2.2: `createFragmentTaggedTemplate` must be available
- Existing: `createOperationComposerFactory` (unchanged)
- Existing: `createCompatComposer` (unchanged)
- Existing: All other context members (`define`, `extend`, `$var`, `$dir`, `$colocate`) unchanged

### Test Migration Strategy (GAP-04/06 resolution)

Replacing `fragment` from `Record<TypeName, FragmentBuilder>` to a pure tagged template function breaks all `fragment.User(...)` calls. These 32 calls across 8 test files must be migrated as part of Task 2.3.

#### Migration target list

| File | Calls | Migration approach |
|------|-------|--------------------|
| `packages/core/test/types/fragment-definition.test.ts` | 8 | Tagged template. `$infer.output`/`$infer.input` type assertions deferred to Phase 2 typegen |
| `packages/core/test/types/fragment-spreading.test.ts` | 7 | Tagged template + GraphQL variable syntax |
| `packages/core/test/integration/metadata-adapter.test.ts` | 6 | Tagged template + `({ metadata })` option |
| `packages/core/src/composer/shorthand-fields.test.ts` | 5 | Fragment calls only. `query.operation` shorthand tests unchanged |
| `packages/core/src/composer/gql-composer.test.ts` | 3 | Tagged template |
| `packages/core/test/integration/compat-extend.test.ts` | 1 | Tagged template |
| `packages/core/test/integration/document-transform.test.ts` | 1 | Tagged template |
| `packages/core/test/integration/nested-object-selection.test.ts` | 1 | Tagged template |

#### Migration patterns

**Basic fragment:**
```typescript
// BEFORE
fragment.User({ fields: ({ f }) => ({ ...f.id(), ...f.name() }) })
// AFTER
fragment`fragment UserFields on User { id name }`()
```

**Fragment with variables (Fragment Arguments syntax):**
```typescript
// BEFORE
fragment.User({
  variables: { ...$var("userId").ID("!") },
  fields: ({ f }) => ({ ...f.id() }),
})
// AFTER
fragment`fragment UserFields($userId: ID!) on User { id }`()
```

**Fragment with metadata:**
```typescript
// BEFORE
fragment.User({
  metadata: () => ({ headers: { "X-Test": "1" } }),
  fields: ({ f }) => ({ ...f.id() }),
})
// AFTER
fragment`fragment UserFields on User { id }`({
  metadata: () => ({ headers: { "X-Test": "1" } }),
})
```

#### Type-level test handling

Tests in `fragment-definition.test.ts` and `fragment-spreading.test.ts` that use `$infer.output` / `$infer.input` cannot be directly migrated because tagged template fragments do not carry TypeScript-level field/variable type information (types come from typegen in Phase 2). These tests should:
- Test runtime behavior (fragment creation, spreading, variable extraction) instead of type inference
- Type inference tests are deferred to Phase 2 typegen integration tests

**TODO marker**: Add `// TODO(Phase 2): Add type-level tests via typegen integration` comments where type assertions are removed.

### Validation

- All migrated fragment tests pass with tagged template syntax: `bun run test`
- Type check passes: `bun typecheck`
- Hybrid `query` is callable as tagged template: `query\`query Foo { ... }\`()`
- Hybrid `query.operation` still works: `query.operation({ name: "Foo", ... })`
- Hybrid `query.compat` still works: `query.compat({ name: "Foo", ... })`
- `fragment` is callable as tagged template: `fragment\`fragment Bar on User { ... }\`()`
- `fragment.User` is no longer available (expected: type error or `undefined`)

### Subagent eligibility

**Main context only** -- depends on Tasks 2.1 and 2.2. Must run after both subagent tasks complete.

---

## Subagent Parallelization Map

```
[2.1 Operation Tagged Template]  [2.2 Fragment Tagged Template]  <-- parallel subagent
             |                              |
             v                              v
         [2.3 Hybrid Context Integration]                        <-- main context
```

Tasks 2.1 and 2.2 have **zero file overlap** -- they create separate new files and do not modify any shared files. They can be safely executed in parallel by independent subagents.

Task 2.3 depends on both 2.1 and 2.2 completing successfully. It modifies `gql-composer.ts` to import and wire up the outputs of both tasks.

---

## Round 2 Verification

After all three tasks are complete, verify:

1. **All Round 2 unit tests pass**: `bun run test` includes the new test files for operation-tagged-template and fragment-tagged-template.
2. **Type check passes**: `bun typecheck` succeeds with the modified `gql-composer.ts` and updated `AnyGqlContext` type.
3. **Hybrid context provides both APIs**:
   - Tagged template: `query\`query GetUser($id: ID!) { user(id: $id) { id name } }\`()` produces an `Operation`
   - Callback builder: `query.operation({ name: "GetUser", variables: {...}, fields: ({f, $}) => ({...}) })` produces an `Operation`
   - Fragment tagged template: `fragment\`fragment UserFields on User { id name }\`()` produces a `Fragment`
4. **All migrated fragment tests pass**: 32 `fragment.User(...)` calls migrated to tagged template syntax (see Test Migration Strategy in Task 2.3). `fragment.User` is no longer available.
5. **No regressions in other packages**: `bun quality` passes (lint + type check).

---

## Key Source File Reference

| File | Lines | Role |
|------|-------|------|
| `packages/core/src/composer/gql-composer.ts` | 210 | Main context creation -- **modified in Task 2.3** |
| `packages/core/src/composer/operation.ts` | 97 | Existing operation composer factory (callback builder) -- **read only** |
| `packages/core/src/composer/operation-core.ts` | 261 | Shared operation artifact builder -- **reused by Task 2.1** |
| `packages/core/src/composer/fragment.ts` | 111 | Existing fragment composer factory (callback builder) -- **read only, pattern reference for Task 2.2** |
| `packages/core/src/types/element/operation.ts` | 179 | Operation class with `Operation.create` -- **reused by Task 2.1** |
| `packages/core/src/types/element/fragment.ts` | 124 | Fragment class with `Fragment.create` -- **reused by Task 2.2** |
| `packages/core/src/types/element/gql-element.ts` | 156 | Base element class with lazy evaluation -- **read only** |
| `packages/core/src/types/type-foundation/type-specifier.ts` | 121 | `VarSpecifier` and `VariableDefinitions` types -- **read only** |
| `packages/core/src/composer/input.ts` | 61 | `createVarRefs`, `createVarAssignments` -- **reused by Tasks 2.1 and 2.2** |
| `packages/core/src/composer/fragment-usage-context.ts` | 60 | `recordFragmentUsage`, `withFragmentUsageCollection` -- **reused by Task 2.2** |
| `packages/core/src/composer/compat.ts` | 64 | Compat composer -- **unchanged in Round 2** |
| `packages/core/src/composer/extend.ts` | 110 | Extend composer -- **unchanged in Round 2** |
| `packages/core/src/composer/build-document.ts` | 639 | Document builder from field selections -- **reused by Task 2.1** |

---

## References

- [Phase 1 Implementation Plan](./tagged-template-unification-phase1.md)
- [Implementation Strategy](./tagged-template-unification.md)
- [RFC: Design Decisions](../rfcs/tagged-template-unification/design-decisions.md) -- Sections 5.1 (API design, hybrid context, TemplateResult)
- [RFC: Resolved Questions](../rfcs/tagged-template-unification/resolved-questions.md) -- Fragment context member, TemplateResult call signature, documentSource handling, error handling
- [RFC: Affected Areas](../rfcs/tagged-template-unification/affected-areas.md) -- Phase 1 scope

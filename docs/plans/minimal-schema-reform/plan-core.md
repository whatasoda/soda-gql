# Implementation Plan: Steps 1, 4-6 — Core Changes

## Step 1: MinimalSchema Type Definition

### `packages/core/src/types/schema/schema.ts`

**Change**: Add `MinimalSchema` type alongside existing `AnyGraphqlSchema`.

```typescript
/** Slim schema type for composer — reduces TS type-checking cost.
 *  At JS runtime, codegen output retains full field argument data ({ spec, arguments }).
 *  MinimalSchema sees object fields as string, but runtime duck-typing accesses richer data. */
export type MinimalSchema = {
  readonly label: string;
  readonly operations: OperationRoots;
  readonly object: { readonly [typename: string]: { readonly [field: string]: string } };
  readonly union: { readonly [typename: string]: readonly string[] };
  readonly typeNames: {
    readonly scalar: readonly string[];
    readonly enum: readonly string[];
    readonly input: readonly string[];
  };
};
```

- `OperationRoots` は既存の型を再利用（`{ query: string | null; mutation: string | null; subscription: string | null }`）
- `AnyGraphqlSchema` は typegen が引き続き使用するため削除しない
- `MinimalSchema` を `packages/core/src/types/schema/index.ts` 経由で export

---

## Steps 4-6 Overview

This plan covers three tightly coupled changes in `packages/core/`:

- **D2**: Delete `$var` / `VarBuilder` / `inputTypeMethods`
- **D3**: Change `f.fieldName(args)` to `f("fieldName", args)`
- **D1**: Add `query("Name")({ variables, fields })` options object path; remove `.operation()`

All changes assume MinimalSchema (Step 1) and updated codegen/typegen (Steps 2-3) are in place.

### Key Design Principle: TS Type vs JS Runtime Separation

MinimalSchema reduces **TypeScript type-checking cost only**. At JavaScript runtime, the codegen-generated schema object retains full field argument data (`{ spec, arguments }` format). The MinimalSchema TypeScript type sees `object` fields as `{ [field: string]: string }`, but the actual runtime value may contain richer objects. Internal code that needs argument type info (e.g., `buildArguments` for enum detection) accesses it at runtime via duck-typing:

```typescript
const fieldDef = typeDef[fieldName];
const spec = typeof fieldDef === "string" ? fieldDef : fieldDef.spec;
const args = typeof fieldDef === "string" ? {} : fieldDef.arguments;
```

This preserves enum argument serialization (`Kind.ENUM` vs `Kind.STRING`) in the callback builder path without inflating the TypeScript type surface.

---

## Files to DELETE

| File | Reason |
|------|--------|
| `packages/core/src/composer/var-builder.ts` | `$var` eliminated — entire file is VarBuilder/createVarMethodFactory/schema-aware type wrappers |
| `packages/core/src/composer/operation.ts` | `createOperationComposerFactory` — `.operation()` factory; logic absorbed into options object path |
| `packages/core/src/types/element/fields-builder.ts` | Schema-inference types (`FieldSelectionFactories`, `FieldSelectionFactory`, `FieldSelectionFactoryReturn`, etc.) replaced by PrebuiltTypes. Builder contract types (`FieldsBuilder`, `NestedObjectFieldsBuilder`, `NestedUnionFieldsBuilder`) **moved to `composer/fields-builder.ts`** as type-erased versions before deletion (see Section 6) |
| `packages/core/src/composer/compat.ts` | Callback compat composer (`createCompatComposer`) — internal API only, not publicly exposed via `gql-composer.ts`. Replaced by tagged template compat (`query.compat("Name")\`...\``) and options object path. `extend.ts` updated to accept `TemplateCompatSpec` only |
| `packages/core/test/fixtures/input-type-methods.ts` | Fixture for constructing `inputTypeMethods` — no longer needed |

---

## File-Level Changes

### 1. `packages/core/src/types/schema/schema.ts`

**Change**: Update `UnionMemberName` to work with both `AnyGraphqlSchema` (union `{ [typename]: true }`) and MinimalSchema (union `string[]`). Since MinimalSchema is the new primary consumer, update `UnionMemberName` for array-based unions.

**Details**:
- `UnionMemberName`: Change `keyof TSchema["union"][TName]["types"]` to array element extraction for MinimalSchema. The type currently uses `TSchema["union"][TName]["types"]` — with MinimalSchema this becomes `TSchema["union"][TName][number]`.
- Keep `AnyGraphqlSchema` and existing types (`InferInputProfile`, `InferOutputProfile`, `AllInputTypeNames`, `InferInputKind`, `ResolveInputProfileFromMeta`) intact — they are still used by typegen's `type-calculator.ts` and will be cleaned up later when typegen fully transitions.

### 2. `packages/core/src/graphql/schema-adapter.ts`

**Change**: Update `createSchemaIndexFromSchema` to accept `MinimalSchema` instead of `AnyGraphqlSchema`.

**Details**:
- Change parameter type: `schema: AnyGraphqlSchema` → `schema: MinimalSchema`
- Change `schema.scalar` → iterate `schema.typeNames.scalar` (name-only array)
- Change `schema.enum` → iterate `schema.typeNames.enum` (name-only array)
- Change `schema.input` → iterate `schema.typeNames.input` (name-only array)
- Change `schema.object` → iterate `Object.keys(schema.object)` (unchanged structure)
- Change `schema.union` → iterate `Object.keys(schema.union)` (keys unchanged, values are now arrays)
- Import `MinimalSchema` from `../types/schema/schema`

**New signature**:
```typescript
export const createSchemaIndexFromSchema = (schema: MinimalSchema): SchemaIndex => {
  const scalars: SchemaIndex["scalars"] = new Map(
    schema.typeNames.scalar.map((n) => [n, { name: n, directives: [] }]),
  );
  const enums: SchemaIndex["enums"] = new Map(
    schema.typeNames.enum.map((n) => [n, { name: n, values: new Map(), directives: [] }]),
  );
  const inputs: SchemaIndex["inputs"] = new Map(
    schema.typeNames.input.map((n) => [n, { name: n, fields: new Map(), directives: [] }]),
  );
  // objects and unions: unchanged key iteration (Object.keys)
  // ...
};
```

### 3. `packages/core/src/composer/gql-composer.ts`

**Changes**: Remove `$var`, remove `.operation()`, add options object dispatch.

**Details**:

1. **Remove imports**:
   - Delete `import { type AnyInputTypeMethods, createVarBuilder } from "./var-builder"`
   - Delete `import { createOperationComposerFactory } from "./operation"`

2. **Update `GqlElementComposerOptions`**:
   - Delete `inputTypeMethods: AnyInputTypeMethods` field
   - Change `_TSchema extends AnyGraphqlSchema` to `_TSchema extends MinimalSchema`

3. **Update `GqlElementComposerWithSchema`**:
   - Change `TSchema extends AnyGraphqlSchema` to `TSchema extends MinimalSchema`

4. **Update `createGqlElementComposer`**:
   - Change `TSchema extends AnyGraphqlSchema` to `TSchema extends MinimalSchema`
   - Remove `inputTypeMethods` destructuring from options
   - Remove `$var: createVarBuilder<TSchema>(inputTypeMethods)` from context
   - Remove `.operation: createOperationComposer(...)` from query/mutation/subscription
   - Keep `.compat` on query/mutation/subscription
   - The curried function returned by `createOperationTaggedTemplate` already handles tagged templates; add options object dispatch (see file #5 below)

5. **Update `AnyGqlContext`**:
   - Remove `readonly $var: unknown` (line 201)
   - Remove `operation: (...args: unknown[]) => AnyOperation` from query/mutation/subscription (lines 188, 192, 196)

6. **Update JSDoc example**: Replace `$var` usage with GraphQL variable syntax

**New context shape**:
```typescript
const context = {
  fragment,
  query: Object.assign(
    createOperationTaggedTemplate(schema, "query", metadataAdapter, transformDocument),
    { compat: createCompatTaggedTemplate(schema, "query") },
  ),
  mutation: Object.assign(
    createOperationTaggedTemplate(schema, "mutation", metadataAdapter, transformDocument),
    { compat: createCompatTaggedTemplate(schema, "mutation") },
  ),
  subscription: Object.assign(
    createOperationTaggedTemplate(schema, "subscription", metadataAdapter, transformDocument),
    { compat: createCompatTaggedTemplate(schema, "subscription") },
  ),
  define: <TValue>(factory: () => TValue | Promise<TValue>) => GqlDefine.create(factory),
  extend: createExtendComposer<TSchema, TMetadataAdapter>(schema, metadataAdapter, transformDocument),
  // $var: DELETED
  $dir: directiveMethods ?? (createStandardDirectives() as TDirectiveMethods),
  $colocate: createColocateHelper(),
  ...(helpers ?? ({} as THelpers)),
};
```

### 4. `packages/core/src/composer/index.ts`

**Changes**:
- Delete `export * from "./var-builder"` (line 16)
- Delete `export * from "./operation"` (line 13)

### 5. `packages/core/src/composer/operation-tagged-template.ts`

**Changes**: Extend the curried function to also accept an options object as first argument (overloaded dispatch).

**Details**:

1. **Add options object type**:
```typescript
/** Options object for callback builder path */
export type OperationOptionsObject = {
  variables?: string;
  fields: (tools: { f: FieldAccessorFunction; $: Readonly<Record<string, AnyVarRef>> }) => AnyFieldsExtended;
};
```

Note: `variables` is typed as `string` at both the type and runtime level. A template literal `` `($id: ID!)` `` in an object literal evaluates to a plain `string` — `TemplateStringsArray` only exists in tagged template call contexts. The formatter enforces template literal syntax in source code.

2. **Update `CurriedOperationFunction`**:
```typescript
export type CurriedOperationFunction<TOperationType extends OperationType = OperationType> = (
  operationName: string,
) => OperationBuilderDispatch<TOperationType>;

/** Dispatch: tagged template OR options object */
export type OperationBuilderDispatch<TOperationType extends OperationType = OperationType> =
  & OperationTaggedTemplateFunction<TOperationType>
  & ((options: OperationOptionsObject) => TemplateResult<AnyOperationOf<TOperationType>>);
```

3. **Modify `createOperationTaggedTemplate`**:
   - The inner function returned for `(operationName)` currently returns a tagged template handler directly
   - Change it to return a dispatcher function that checks the first argument:
     - If `firstArg` has `.raw` property (TemplateStringsArray) → tagged template path (existing logic)
     - If `firstArg` is a plain object → options object path (new logic)

4. **Options object path implementation**:
```typescript
// Inside the dispatcher, when options object is detected:
const optionsPath = (options: OperationOptionsObject): TemplateResult<AnyOperationOf<TOperationType>> => {
  // Parse variables from string if provided
  let varSpecifiers: VariableDefinitions = {};
  if (options.variables) {
    // options.variables is a string like "($id: ID!)" or "($id: ID!, $limit: Int)"
    // Parse it as GraphQL: wrap in a dummy operation to get variable definition nodes
    const varSource = `query __var_parse__ ${String(options.variables).trim()}{ __typename }`;
    const parsed = parseGraphql(varSource);
    const opDef = parsed.definitions[0];
    if (opDef?.kind === Kind.OPERATION_DEFINITION) {
      varSpecifiers = buildVarSpecifiers(opDef.variableDefinitions ?? [], schemaIndex) as VariableDefinitions;
    }
  }

  const operationTypeName = schema.operations[operationType];
  if (operationTypeName === null) {
    throw new Error(`Operation type ${operationType} is not defined in schema roots`);
  }

  const resolvedAdapter = metadataAdapter ?? defaultMetadataAdapter;

  // Return TemplateResult (step 2 callable)
  return (step2Options?: OperationTemplateMetadataOptions & { transformDocument?: OperationDocumentTransformer }): AnyOperationOf<TOperationType> => {
    const resolvedMetadata = resolveMetadataOption(step2Options?.metadata);

    return wrapArtifactAsOperation(() =>
      buildOperationArtifact({
        schema,
        operationType,
        operationTypeName,
        operationName,
        variables: varSpecifiers,
        fieldsFactory: options.fields,
        adapter: resolvedAdapter,
        metadata: resolvedMetadata,
        transformDocument: step2Options?.transformDocument,
        adapterTransformDocument,
      }),
    );
  };
};
```

5. **Update `TemplateResult` type** to accept `transformDocument` in step 2 options:
```typescript
export type OperationTemplateMetadataOptions = {
  metadata?: ...;  // existing
  transformDocument?: OperationDocumentTransformer<unknown>;  // NEW
};
```

This also applies to the tagged template path — `transformDocument` moves to step 2 for both paths per RFC Risk 6 resolution.

### 6. `packages/core/src/composer/fields-builder.ts`

**Changes**: Replace property-keyed factory map with a single function `f(fieldName, args)`.

**Details**:

1. **Change return type of `createFieldFactories`**:
   - Currently returns `FieldSelectionFactories<TSchema, TTypeName>` (object with per-field properties)
   - Change to return a single function: `FieldAccessorFunction`

2. **New return type**:
```typescript
/** Function-call field accessor: f("fieldName", args, extras) */
export type FieldAccessorFunction = (
  fieldName: string,
  fieldArgs?: AnyFieldSelection["args"] | null | void,
  extras?: { alias?: string; directives?: AnyDirectiveRef[] },
) => AnyFieldSelectionFactoryReturn<string | null>;
```

3. **Change `createFieldFactories` signature**:
```typescript
export const createFieldFactories = <TSchema extends MinimalSchema>(
  schema: TSchema,
  typeName: string,
): FieldAccessorFunction => {
```

4. **Implementation change**:
   - Instead of pre-building a `Record<string, factory>` from `Object.entries(typeDef.fields)`, return a function that does lazy lookup:
```typescript
const createFieldFactoriesInner = (schema: MinimalSchema, typeName: string): FieldAccessorFunction => {
  const typeDef = schema.object[typeName];
  if (!typeDef) {
    throw new Error(`Type ${typeName} is not defined in schema objects`);
  }

  return (fieldName, fieldArgs, extras) => {
    // __typename is an implicit introspection field
    if (fieldName === "__typename") {
      const wrap = <T>(value: T) => wrapByKey((extras?.alias ?? fieldName), value);
      return wrap({
        parent: typeName,
        field: fieldName,
        type: "s|String|!",
        args: {},
        directives: extras?.directives ?? [],
        object: null,
        union: null,
      });
    }

    const typeSpecifier = typeDef[fieldName]; // MinimalSchema: fields are direct spec strings
    if (!typeSpecifier) {
      throw new Error(`Field "${fieldName}" is not defined on type "${typeName}"`);
    }

    const parsedType = parseOutputField(typeSpecifier as DeferredOutputField);
    // ... rest of factory logic (same as current per-field factory body)
  };
};
```

5. **Key structural change**: The MinimalSchema TypeScript type defines `typeDef` as `{ [field: string]: string }`. However, at JavaScript runtime the codegen output retains `{ spec, arguments }` objects for fields with arguments. The `FieldAccessorFunction` uses runtime duck-typing to extract the spec string and arguments:

   ```typescript
   const fieldDef = typeDef[fieldName];
   const spec = typeof fieldDef === "string" ? fieldDef : fieldDef.spec;
   const args = typeof fieldDef === "string" ? {} : fieldDef.arguments;
   const parsedType = parseOutputField(spec as DeferredOutputField);
   ```

   This replaces the old `typeDef.fields[fieldName]` access pattern.

6. **Cache key change**: Cache still keyed by `schema + typeName`, but cached value is now `FieldAccessorFunction` instead of `Record<string, factory>`.

7. **Nested field factories**: When creating nested `f` for object/union children, `createFieldFactories(schema, parsedType.name)` returns a `FieldAccessorFunction` — same type, no API change for nested builders.

8. **Relocated builder contract types** (from `types/element/fields-builder.ts`):

The following types are moved here as type-erased versions (schema generic parameters removed, replaced with `FieldAccessorFunction`):

```typescript
/** Builder callback for top-level field selections (has $ variable access) */
export type FieldsBuilder<TFields extends AnyFieldsExtended = AnyFieldsExtended> =
  (tools: { f: FieldAccessorFunction; $: Readonly<Record<string, AnyVarRef>> }) => TFields;

/** Builder callback for nested object field selections (no $ access) */
export type NestedObjectFieldsBuilder<TFields extends AnyFieldsExtended = AnyFieldsExtended> =
  (tools: { f: FieldAccessorFunction }) => TFields;

/** Builder for union type selections with per-member field definitions */
export type NestedUnionFieldsBuilder = {
  [typeName: string]: NestedObjectFieldsBuilder | undefined;
} & { __typename?: true };
```

All consumers (`operation-core.ts`, `compat-spec.ts`) update imports to `composer/fields-builder.ts`. The `types/element/index.ts` re-export is updated to point to the new location.

### 7. `packages/core/src/composer/operation-core.ts`

**Changes**: Update types and imports for MinimalSchema and new field accessor.

**Details**:

1. **Change `AnyGraphqlSchema` to `MinimalSchema`** in all type parameters and imports
2. **Update `fieldsFactory` call**: `createFieldFactories(schema, operationTypeName)` now returns `FieldAccessorFunction` instead of a property map — the call site doesn't change since `fieldsFactory({ f, $ })` uses `f` by name
3. **Update `FieldsBuilder` import**: The `FieldsBuilder` type from `../types/element` needs to use the new `FieldAccessorFunction` for `f` — or just use `AnyFieldsExtended` constraint directly
4. **`OperationCoreParams` type**: Change `TSchema extends AnyGraphqlSchema` → `TSchema extends MinimalSchema`

### 8. `packages/core/src/composer/fragment-tagged-template.ts`

**Changes**: MinimalSchema compatibility + union array lookup.

**Details**:

1. **Change `AnyGraphqlSchema` to `MinimalSchema`** in parameter types
2. **Line ~168**: Change `unionDef?.types[memberName]` to `unionDef?.includes(memberName)` for array-based union member validation
3. **Line ~148**: `schema.object[typeName]` access — with MinimalSchema, `typeDef.fields[fieldName]` becomes `typeDef[fieldName]`. Use runtime duck-typing to extract spec string: `typeof fieldDef === "string" ? fieldDef : fieldDef.spec`
4. **`buildFieldsFromSelectionSet`**: Update field spec lookup from `typeDef.fields[fieldName]` to `typeDef[fieldName]` with runtime duck-typing

### 9. `packages/core/src/composer/build-document.ts`

**Changes**: MinimalSchema compatibility; remove `$var`-only code paths.

**Details**:

1. **Change `AnyGraphqlSchema` to `MinimalSchema`** in function parameters
2. **Delete `buildVariables` function** (lines 558-585): Only called from the callback-builder `$var` path. After `$var` deletion, variable definitions in the document come from the tagged template parser or options object parser — both produce `VariableDefinitionNode[]` directly
3. **Delete `AnyVarSpecifier` type** (lines 548-554): Only used by `buildVariables`
4. **Delete `buildConstValueNode` function**: Only called by `buildVariables` for default values
5. **`schema.input` accesses and enum detection** (lines 116, 417):

   `buildArgumentValue` uses `schema.input[name]` for nested enum detection in input objects. `buildArguments` (line 179) is used by the callback builder `fields` path, not just `$var`.

   **Resolution**: Per the Key Design Principle (TS type vs JS runtime separation), the codegen-generated schema object retains full field argument data at JavaScript runtime. The MinimalSchema TypeScript type sees fields as `string`, but the actual runtime value contains `{ spec, arguments }` objects for fields that have arguments.

   `buildArguments` receives `argumentSpecifiers` from `parseOutputField(fieldDef)`. At runtime, `fieldDef` may be a `{ spec, arguments }` object (from codegen output), so `parseOutputField` extracts `.arguments` correctly. The `buildArgumentValue` function continues to access `schema.input` — at runtime, the schema object passed to `createGqlElementComposer` is the full codegen output, which contains `schema.input` data even though the TypeScript type doesn't expose it.

   For `buildArgumentValue`, change the `enumLookup.schema` type annotation from `AnyGraphqlSchema` to `unknown` and use runtime duck-typing to access `.input[name]`:

   ```typescript
   // Runtime duck-typing for input type access
   const inputDefs = (enumLookup.schema as any)?.input;
   const inputDef = inputDefs?.[enumLookup.typeSpecifier.name];
   ```

   This preserves full enum detection in the callback builder path without inflating the MinimalSchema TypeScript type.

6. **`expandShorthand` function** (line 279): Change `typeDef.fields[fieldName]` to `typeDef[fieldName]` with runtime duck-typing for spec extraction.

7. **`buildField` function**: Uses runtime duck-typing on `typeDef[fieldName]` to extract both `spec` (for `parseOutputField`) and `arguments` (for `buildArguments`). At JS runtime the codegen output provides full `{ spec, arguments }` objects, preserving enum detection.

8. **`buildDocument` function**: Update the `variables` parameter handling — after `$var` deletion, the `variables` parameter contains `BuiltVarSpecifier` records (from `buildVarSpecifiers`). The `buildVariables` call on line 637 converts these to `VariableDefinitionNode[]`. Since we're deleting `buildVariables`, we need to convert `VariableDefinitions` to `VariableDefinitionNode[]` differently.

   **Actually**: The tagged template path already builds `VariableDefinitionNode[]` from the parsed GraphQL source. The options object path should do the same — parse the variables string, get `VariableDefinitionNode[]` from the parsed AST, and pass those directly. `buildDocument` should accept `VariableDefinitionNode[]` instead of `VariableDefinitions` for the document's variable definitions.

   **Change**: Modify `buildDocument` to accept `variableDefinitions: VariableDefinitionNode[]` (pre-parsed AST nodes) instead of `variables: VariableDefinitions` (VarSpecifier records). The `buildVariables` call is replaced by directly using the passed-in nodes.

   The `variables` parameter (VarSpecifier records) is still needed for `createVarRefs` in `operation-core.ts` — that stays. But `buildDocument` only needs the AST nodes for the document output.

   **New `buildDocument` signature**:
   ```typescript
   export const buildDocument = <...>(params: {
     operationName: string;
     operationType: OperationType;
     operationTypeName: string;
     variableDefinitions: readonly VariableDefinitionNode[];  // PRE-PARSED
     fields: AnyFieldsExtended;
     schema: MinimalSchema;
   }) => { ... };
   ```

   **Update callers**:
   - `operation-core.ts`: Build `VariableDefinitionNode[]` from `VariableDefinitions` (the VarSpecifier records) before calling `buildDocument`. This conversion logic is extracted from the deleted `buildVariables`. Or better: pass the pre-parsed nodes through from the tagged template / options object path.
   - **Even better**: Store the `VariableDefinitionNode[]` alongside the `VariableDefinitions` in `buildOperationArtifact` params. The tagged template path already has them (from `opNode.variableDefinitions`). The options object path gets them from parsing the variables string. Add `variableDefinitionNodes?: readonly VariableDefinitionNode[]` to `OperationCoreParams` as **optional**.

   When `variableDefinitionNodes` is not provided, `buildDocument` falls back to converting `VariableDefinitions` internally (retaining the current `buildVariables` logic as a private fallback). This ensures all callers work without modification:

   **Callers and their supply strategy:**
   - **Tagged template path** (`operation-tagged-template.ts`): Supplies `opDef.variableDefinitions` (already parsed)
   - **Options object path** (`operation-tagged-template.ts`): Supplies parsed nodes from variables string
   - **TemplateCompatSpec path** (`extend.ts` line 176): Supplies `opDef.variableDefinitions` (already parsed at line 158)
   - **CompatSpec path** (`extend.ts` line 112): Omits field — falls back to internal conversion from `variables` (VarSpecifier records)

### 10. `packages/core/src/composer/compat.ts`

**Change**: **DELETE this file.** The callback compat composer (`createCompatComposer`) is an internal API not exposed via `gql-composer.ts`. With `$var` and `.operation()` removed, the callback compat path has no remaining use case. The tagged template compat (`query.compat("Name")\`...\``) covers all compat needs.

**Impact**:
- `composer/index.ts`: Delete `export * from "./compat"`
- `extend.ts`: Remove the `CompatSpec` code path (line 103-125). Only the `TemplateCompatSpec` path remains.
- `compat.test.ts`, `extend.test.ts`: Delete/update tests that use `createCompatComposer`
- `compat-spec.ts`: Remove `CompatSpec` type and related types. Keep `TemplateCompatSpec` only.

### 11. `packages/core/src/composer/compat-tagged-template.ts`

**Change**: Update `AnyGraphqlSchema` → `MinimalSchema` in imports and type parameters.

### 12. `packages/core/src/composer/extend.ts`

**Changes**:
- Update `AnyGraphqlSchema` → `MinimalSchema` in imports and type parameters.
- Remove the `CompatSpec` code path (lines 103-125). Only the `TemplateCompatSpec` path (lines 132-189) remains.
- Remove `isTemplateCompatSpec` check — all specs are now `TemplateCompatSpec`.
- The `TemplateCompatSpec` path already has `opDef.variableDefinitions` (line 158) — supply it as `variableDefinitionNodes` to `buildOperationArtifact`.

### 13. `packages/core/src/composer/input.ts`

**Change**: Update `AnyGraphqlSchema` → `MinimalSchema` in imports and type parameters.

### 14. `packages/core/src/types/element/index.ts`

**Change**: Replace `export * from "./fields-builder"` with re-export from the new location:
```typescript
// Before
export * from "./fields-builder";
// After
export { type FieldsBuilder, type NestedObjectFieldsBuilder, type NestedUnionFieldsBuilder } from "../../composer/fields-builder";
```

This preserves the public export path for downstream consumers.

### 15. `packages/core/src/types/element/compat-spec.ts`

**Change**: Update `FieldsBuilder` import from `./fields-builder` to `../../composer/fields-builder`. The type-erased `FieldsBuilder` (without schema generics) is compatible with `compat-spec.ts` usage.

### 16. `packages/core/src/prebuilt/types.ts`

**Change**: Add optional `varTypes` and `fields` to `PrebuiltTypeRegistry` operation entry (this may be done in Step 3, but listing here for completeness).

---

## Type Changes Summary

### Types to DELETE (with their files)

| Type | File | Replacement |
|------|------|-------------|
| `VarBuilder<TSchema>` | `var-builder.ts` | Direct imports of `getNameAt/getValueAt/getVariablePath` from `var-ref-tools.ts` |
| `AllInputTypeNames<TSchema>` (usage in VarBuilder) | `var-builder.ts` | N/A — codegen generates concrete overloads |
| `VarBuilderMethods` | `var-builder.ts` | N/A |
| `InputTypeMethods<TSchema>` | `var-builder.ts` | N/A |
| `AnyInputTypeMethods` | `var-builder.ts` | N/A |
| `SchemaAwareGetNameAt/GetValueAt` | `var-builder.ts` | Type-erased versions; codegen generates concrete types |
| `ResolveTypeFromMeta<TSchema, TMeta>` | `var-builder.ts` | PrebuiltTypes `varTypes` |
| `GenericVarSpecifier` | `var-builder.ts` | `BuiltVarSpecifier` from `var-specifier-builder.ts` |
| `FieldSelectionFactories<TSchema, TTypeName>` | `types/element/fields-builder.ts` | `FieldAccessorFunction` in `composer/fields-builder.ts` |
| `FieldSelectionFactory<TSchema, TSelection>` | `types/element/fields-builder.ts` | PrebuiltTypes overloads |
| `FieldSelectionFactoryReturn` and variants | `types/element/fields-builder.ts` | PrebuiltTypes overloads |
| `FieldsBuilder<TSchema, TTypeName, TVarDefs, TFields>` | `types/element/fields-builder.ts` | Type-erased `FieldsBuilder<TFields>` in `composer/fields-builder.ts` |
| `FieldsBuilderTools<TSchema, TTypeName, TVarDefs>` | `types/element/fields-builder.ts` | Inline `{ f: FieldAccessorFunction; $: ... }` |
| `NestedObjectFieldsBuilder<TSchema, TTypeName, TFields>` | `types/element/fields-builder.ts` | Type-erased `NestedObjectFieldsBuilder<TFields>` in `composer/fields-builder.ts` |
| `NestedObjectFieldsBuilderTools` | `types/element/fields-builder.ts` | Inline `{ f: FieldAccessorFunction }` |
| `NestedUnionFieldsBuilder<TSchema, TMember, TFields>` | `types/element/fields-builder.ts` | Type-erased `NestedUnionFieldsBuilder` in `composer/fields-builder.ts` |
| `CompatOptions` | `compat.ts` | Deleted with callback compat |
| `CompatSpec` | `compat-spec.ts` | Deleted — only `TemplateCompatSpec` remains |
| `AnyVarSpecifier` | `build-document.ts` | Deleted with `buildVariables` |

### Types to ADD

| Type | File | Purpose |
|------|------|---------|
| `FieldAccessorFunction` | `composer/fields-builder.ts` | `f("fieldName", args, extras)` callable |
| `FieldsBuilder<TFields>` | `composer/fields-builder.ts` | Type-erased builder callback (relocated from `types/element/fields-builder.ts`) |
| `NestedObjectFieldsBuilder<TFields>` | `composer/fields-builder.ts` | Type-erased nested builder (relocated) |
| `NestedUnionFieldsBuilder` | `composer/fields-builder.ts` | Type-erased union builder (relocated) |
| `OperationOptionsObject` | `composer/operation-tagged-template.ts` | Options for callback builder path (`variables` typed as `string`) |
| `OperationBuilderDispatch` | `composer/operation-tagged-template.ts` | Union of tagged template and options object handler |

### Types to MODIFY

| Type | File | Change |
|------|------|--------|
| `CurriedOperationFunction` | `operation-tagged-template.ts` | Returns `OperationBuilderDispatch` instead of `OperationTaggedTemplateFunction` |
| `OperationTemplateMetadataOptions` | `operation-tagged-template.ts` | Add `transformDocument` field |
| `AnyGqlContext` | `gql-composer.ts` | Remove `$var`; remove `.operation` from query/mutation/subscription |
| `GqlElementComposerOptions` | `gql-composer.ts` | Remove `inputTypeMethods` |
| `OperationCoreParams` | `operation-core.ts` | Add optional `variableDefinitionNodes?` field; change `AnyGraphqlSchema` → `MinimalSchema` |

---

## Data Flow Changes

### Before (callback builder path)

```
query.operation({
  name: "GetUser",
  variables: { ...$var("id").ID("!") },       // VarSpecifier records
  fields: ({ f, $ }) => ({ ...f.employee() }), // f.fieldName property access
  metadata: ({ $ }) => ({ ... }),
  transformDocument: (doc) => ...,
})
  ↓ createOperationComposerFactory
  ↓ buildOperationArtifact
  ↓ buildDocument(variables: VariableDefinitions)
  ↓ buildVariables(varSpecifiers, schema)   // converts to VariableDefinitionNode[]
  → Operation
```

### After (options object path)

```
query("GetUser")({
  variables: `($id: ID!)`,                    // Template literal string
  fields: ({ f, $ }) => ({ ...f("employee") }),  // f("fieldName") function call
})({
  metadata: ({ $ }) => ({ ... }),
  transformDocument: (doc) => ...,
})
  ↓ dispatch (detects plain object)
  ↓ parse variables string → VariableDefinitionNode[] + buildVarSpecifiers → VariableDefinitions
  ↓ buildOperationArtifact
  ↓ buildDocument(variableDefinitions: VariableDefinitionNode[])   // pre-parsed nodes
  → TemplateResult → Operation
```

### Before (tagged template path)

```
query("GetUser")`($id: ID!) { employee(id: $id) { id } }`(metadataOptions)
  ↓ parse GraphQL source → VariableDefinitionNode[]
  ↓ buildVarSpecifiers → VariableDefinitions
  ↓ buildOperationArtifact
  ↓ buildDocument(variables: VariableDefinitions)
  ↓ buildVariables(varSpecifiers, schema)
  → Operation
```

### After (tagged template path)

```
query("GetUser")`($id: ID!) { employee(id: $id) { id } }`({
  metadata: ...,
  transformDocument: ...,
})
  ↓ parse GraphQL source → VariableDefinitionNode[]
  ↓ buildVarSpecifiers → VariableDefinitions
  ↓ buildOperationArtifact (receives both VariableDefinitionNode[] and VariableDefinitions)
  ↓ buildDocument(variableDefinitions: VariableDefinitionNode[])   // pre-parsed nodes
  → Operation
```

### Extend path (TemplateCompatSpec only — CompatSpec path deleted)

```
extend(query.compat("GetUser")`($id: ID!) { user(id: $id) { name } }`)({
  metadata: ...,
  transformDocument: ...,
})
  ↓ parse GraphQL source from TemplateCompatSpec.graphqlSource
  ↓ extract opDef.variableDefinitions → VariableDefinitionNode[]
  ↓ buildVarSpecifiers → VariableDefinitions
  ↓ buildOperationArtifact (receives variableDefinitionNodes from opDef)
  ↓ buildDocument(variableDefinitions: VariableDefinitionNode[])
  → Operation
```

---

## Implementation Notes

### `f("field")` — The `__typename` Special Case

The current `buildFieldsFromSelectionSet` in `fragment-tagged-template.ts` (line ~120) handles `__typename` as an implicit introspection field. The new `FieldAccessorFunction` in `fields-builder.ts` must also handle `__typename` — when `fieldName === "__typename"`, return a scalar field selection with spec `"s|String|!"` without looking up the type definition.

### Variable Parsing in Options Object Path

The options object's `variables` field is a template literal string like `` `($id: ID!)` ``. At runtime this arrives as a plain string. The parser wraps it in a synthetic operation `query __var_parse__ $theString { __typename }`, parses with `graphql-js`, and extracts `VariableDefinitionNode[]`. Then `buildVarSpecifiers` converts those to `VariableDefinitions` (the VarSpecifier records needed for `createVarRefs`).

This reuses the same parsing infrastructure as the tagged template path.

### `transformDocument` in Step 2

Both paths place `transformDocument` in the step 2 options (the `TemplateResult` call). This means the tagged template path's `OperationTemplateMetadataOptions` must be extended with `transformDocument`. The existing 9 test cases in `document-transform.test.ts` that use per-operation `transformDocument` will move it from step 1 to step 2.

### `getNameAt` / `getValueAt` Direct Export

After deleting `var-builder.ts`, these functions are still exported from `var-ref-tools.ts` (via `composer/index.ts`). Tests using `$var.getNameAt(...)` migrate to calling `getNameAt(...)` directly. The runtime behavior is identical — the `VarBuilder` wrapper was purely for type enrichment.

---

## Test Migration Scope

### Files to DELETE

| File | Reason |
|------|--------|
| `packages/core/test/types/variable-builder.test.ts` | Tests `$var(name).TypeName(modifier)` API directly |
| `packages/core/test/fixtures/input-type-methods.ts` | `createVarMethodFactory` fixture helper |

### Mechanical Rewrites (all test/fixture files)

**Pattern 1: `$var` elimination** (316 occurrences in 37 files)

```typescript
// Before
variables: { ...$var("id").ID("!"), ...$var("limit").Int("?") },

// After (in options object)
variables: `($id: ID!, $limit: Int)`,
```

**Pattern 2: `f.fieldName()` → `f("fieldName")`** (439 occurrences in 45 files)

```typescript
// Before
...f.employee({ id: $.id })(({ f }) => ({ ...f.name(), ...f.id() }))

// After
...f("employee", { id: $.id })(({ f }) => ({ ...f("name")(), ...f("id")() }))
```

Note: scalar fields now require `f("name")()` — the extra `()` is needed because the function always returns a curried factory. For scalar/enum fields with no children, the factory returns the field selection directly (not a nested builder function).

**Wait — correction**: Looking at the current implementation, scalar/enum fields return the result directly from `factory(args, extras)` without currying. The `f.name()` call returns `{ name: { parent, field, type, args, directives, object: null, union: null } }` directly. With `f("name")`, the function call `f("name")` replaces `f.name` (getting the factory), and then `()` calls it with no args. So `f("name")()` is correct for scalar fields.

For object fields: `f("employee", { id: $.id })` replaces `f.employee({ id: $.id })`, and the result is still a curried function expecting a nested builder.

**Pattern 3: `.operation()` → options object** (~150 call sites in ~20 files)

```typescript
// Before
query.operation({
  name: "GetUser",
  variables: { ...$var("id").ID("!") },
  fields: ({ f, $ }) => ({ ...f.user({ id: $.id })(({ f }) => ({ ...f.name() })) }),
  metadata: ({ $ }) => ({ ... }),
  transformDocument: (doc) => ...,
})

// After
query("GetUser")({
  variables: `($id: ID!)`,
  fields: ({ f, $ }) => ({ ...f("user", { id: $.id })(({ f }) => ({ ...f("name")() })) }),
})({
  metadata: ({ $ }) => ({ ... }),
  transformDocument: (doc) => ...,
})
```

**Pattern 4: `$var.getNameAt` / `$var.getValueAt`** → direct function calls

```typescript
// Before
$var.getNameAt($.filter, p => p.user.id)
$var.getValueAt($.filter, p => p.user.name)

// After
getNameAt($.filter, p => p.user.id)
getValueAt($.filter, p => p.user.name)
```

Import `getNameAt`, `getValueAt` from `@soda-gql/core` (exported via `composer/var-ref-tools.ts` → `composer/index.ts` → `core/index.ts`).

---

## Dependency on Steps 1-3

This plan assumes:

1. **Step 1**: `MinimalSchema` type exists in `packages/core/src/types/schema/schema.ts`
2. **Step 2**: Codegen generates `_defs/type-names.ts` (new), keeps existing `_defs/` files unchanged, updates `_internal.ts` with dual schema assembly (MinimalSchema + full schema) and removes `inputTypeMethods`
3. **Step 3**: Typegen generates `varTypes` and `fields` in `types.prebuilt.ts`

These must be implemented before or concurrently with Steps 4-6 (single PR).

---

## Implementation Order (Cross-Plan, Single PR)

All changes across both plans ship in a single PR. The dependency graph determines implementation order:

```
Step 1: MinimalSchema type definition
  ↓
Step 2: Codegen (_defs/type-names.ts, _internal.ts dual assembly)  ←→  Step 4-6: Core changes (parallel-capable)
  ↓                                                                          ↓
Step 3: Typegen (varTypes, fields, loadFullSchemasFromBundle)      Step 7: Formatter
  ↓                                                                          ↓
Step 8: Test/fixture mechanical rewrite (depends on all above)
```

### Recommended sequence within Core changes (Steps 4-6):

1. **Relocate builder contract types**: Move `FieldsBuilder`, `NestedObjectFieldsBuilder`, `NestedUnionFieldsBuilder` to `composer/fields-builder.ts` as type-erased versions
2. **Define `FieldAccessorFunction`** and update `createFieldFactories` with runtime duck-typing for field spec/arguments extraction
3. **Update `createSchemaIndexFromSchema`** for MinimalSchema
4. **Delete callback compat**: Delete `compat.ts`, remove `CompatSpec` from `compat-spec.ts`, update `extend.ts` to `TemplateCompatSpec` only
5. **Add options object path** to `operation-tagged-template.ts` (with `variables: string`)
6. **Update `build-document.ts`**: Accept optional `variableDefinitionNode[]`, keep `buildVariables` as fallback, update field spec access with duck-typing
7. **Update `operation-core.ts`**: Pass `variableDefinitionNodes`, use MinimalSchema
8. **Update `gql-composer.ts`**: Remove `$var`, `.operation()`, `inputTypeMethods`
9. **Delete files**: `var-builder.ts`, `operation.ts`, `types/element/fields-builder.ts`, fixture files
10. **Update barrel exports**: `composer/index.ts`, `types/element/index.ts`
11. **Update remaining files**: `compat-tagged-template.ts`, `extend.ts`, `input.ts`, `fragment-tagged-template.ts`
12. **Migrate tests** — mechanical rewrites following Patterns 1-4

# Research: Step 1-3 Impact Analysis — MinimalSchema, Codegen, Typegen

## Summary

This document maps the full impact of RFC Steps 1-3 on the codebase, identifying every component
that must change, what the change entails, and dependencies between steps.

---

## Step 1: MinimalSchema type (Core)

### Current: `AnyGraphqlSchema` definition

**File:** `packages/core/src/types/schema/schema.ts:24`

Current shape:
```typescript
export type AnyGraphqlSchema = {
  readonly label: string;
  readonly operations: OperationRoots;
  readonly scalar: { readonly [name: string]: ScalarDefinition<any> };  // ← heavy typed object
  readonly enum:   { readonly [name: string]: EnumDefinition<any> };    // ← enum full definitions
  readonly input:  { readonly [name: string]: InputDefinition };        // ← input field specs
  readonly object: { readonly [name: string]: ObjectDefinition };       // ← object full field specs
  readonly union:  { readonly [name: string]: UnionDefinition };        // ← union type maps
  readonly __defaultInputDepth?: number;
  readonly __inputDepthOverrides?: InputDepthOverrides;
};
```

RFC target (new `MinimalSchema` type):
```typescript
export type MinimalSchema = {
  readonly label: string;
  readonly operations: OperationRoots;
  readonly object: { readonly [name: string]: { readonly [field: string]: string } };  // spec strings only
  readonly union:  { readonly [name: string]: readonly string[] };                     // member names array
  readonly typeNames: {
    readonly scalar: readonly string[];
    readonly enum:   readonly string[];
    readonly input:  readonly string[];
  };
};
```

### Consumers of `AnyGraphqlSchema` — classified by need

**Consumers that need the FULL schema (scalar/enum/input typed lookups):**

| File | What it uses | Change needed |
|------|-------------|---------------|
| `packages/core/src/types/schema/schema.ts` | `InferInputProfile`, `InferOutputProfile`, `AllInputTypeNames`, `InferInputKind`, `ResolveInputProfileFromMeta` — all walk `TSchema["scalar"]`, `TSchema["enum"]`, `TSchema["input"]` | Delete or demote to `AnyGraphqlSchema`-only scope; these types vanish when `$var` is deleted (Step 4-6) |
| `packages/core/src/types/schema/const-assignable-input.ts` | `ConstAssignableInput`, `ConstAssignableInputFromVarDefs` — resolve TS types from specifiers via `InferInputProfile` | Same — deleted with `$var` |
| `packages/core/src/types/fragment/assignable-input.ts` | `AssignableInput`, `AssignableInputFromVarDefs`, `FragmentVariableValue`, `FieldArgumentValue`, `DeclaredVariables` | Same — deleted with `$var` |
| `packages/core/src/types/fragment/field-selection.ts` | `FieldSelectionType<TSchema, ...>` — resolves output types by traversing `TSchema["scalar"]` and `TSchema["enum"]` | Deleted/replaced in Step 4-6 |
| `packages/core/src/types/element/fields-builder.ts` | `FieldSelectionFactories<TSchema, TTypeName>` — maps over `TSchema["object"][TTypeName]["fields"]` | Deleted in Step 4-6 |
| `packages/core/src/composer/var-builder.ts` | `VarBuilder<TSchema>`, `createVarMethodFactory` — enumerate all input type names | Deleted in Step 4-6 |
| `packages/core/src/prebuilt/type-calculator.ts` | `getScalarOutputType`, `getEnumType`, `calculateFieldsType`, etc. — traverses `schema.scalar`, `schema.enum`, `schema.input`, `schema.object` | Must keep but operate on `AnyGraphqlSchema` (typegen only uses these in Step 3) |

**Consumers that work with MinimalSchema (graph shape only):**

| File | What it uses | Change needed |
|------|-------------|---------------|
| `packages/core/src/composer/fragment-tagged-template.ts` | `schema.object[typeName].fields[fieldName]` spec strings; `schema.union`; `schema.operations` | Compatible with MinimalSchema — `object` field structure unchanged in spec format |
| `packages/core/src/composer/operation-tagged-template.ts` | `schema.operations`, field spec lookups via `schema.object` | Compatible with MinimalSchema |
| `packages/core/src/composer/build-document.ts` | `schema.enum[name]` for enum value detection, `schema.object[type].fields[field]` for type resolution | Enum lookup changes: instead of `schema.enum[name]`, use `schema.typeNames.enum.includes(name)` |
| `packages/core/src/composer/fields-builder.ts` | `schema.object[typeName].fields` keys and specs | Compatible — spec strings unchanged |
| `packages/core/src/composer/operation-core.ts` | `schema.operations` | Compatible |
| `packages/core/src/composer/compat.ts` | schema passed through | Compatible |
| `packages/core/src/composer/extend.ts` | schema passed through | Compatible |
| `packages/core/src/composer/gql-composer.ts` | `createGqlElementComposer(schema, options)` — `TSchema extends AnyGraphqlSchema` | Must change generic constraint to `MinimalSchema` |
| `packages/core/src/graphql/schema-adapter.ts` | `createSchemaIndexFromSchema(schema: AnyGraphqlSchema)` — converts full schema to SchemaIndex | No longer needed after Step 2 (MinimalSchema doesn't have full scalar/input structure) |

**Key finding:** `build-document.ts:558` `buildVariables` uses `schema.enum[name].values` to validate enum values. With MinimalSchema, enums are just a name list — validation must shift to runtime (already partially done) or be dropped. This is the only substantive **runtime behavior change** in Step 1.

### New type to create

**File:** `packages/core/src/types/schema/schema.ts` (new section or new file)

```typescript
// MinimalSchema: the only schema information needed by the composer layer
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

The `union` shape changes from `{ [typename: string]: true }` to `readonly string[]` — this is a breaking change to `UnionDefinition` and `UnionMemberName` type utilities.

### Files to update for Step 1

| File | Change |
|------|--------|
| `packages/core/src/types/schema/schema.ts` | Add `MinimalSchema` type; retain `AnyGraphqlSchema` for typegen (type-calculator) |
| `packages/core/src/composer/gql-composer.ts` | Change `TSchema extends AnyGraphqlSchema` → `TSchema extends MinimalSchema` |
| `packages/core/src/composer/fragment-tagged-template.ts` | Change parameter type to `MinimalSchema` |
| `packages/core/src/composer/operation-tagged-template.ts` | Change parameter type to `MinimalSchema` |
| `packages/core/src/composer/operation-core.ts` | Change parameter type to `MinimalSchema` |
| `packages/core/src/composer/build-document.ts` | Change parameter type to `MinimalSchema`; adapt enum lookup logic |
| `packages/core/src/composer/fields-builder.ts` | Change parameter type to `MinimalSchema` |
| `packages/core/src/composer/compat.ts` | Change parameter type to `MinimalSchema` |
| `packages/core/src/composer/compat-tagged-template.ts` | Change parameter type to `MinimalSchema` |
| `packages/core/src/composer/extend.ts` | Change parameter type to `MinimalSchema` |
| `packages/core/src/composer/input.ts` | Change parameter type to `MinimalSchema` |

`AnyGraphqlSchema` stays for now in `packages/core/src/prebuilt/type-calculator.ts` (used by typegen, not the composer).

---

## Step 2: Codegen changes

### Current output structure

The codegen pipeline (`packages/tools/src/codegen/`) produces:

| File | Generator | Function |
|------|-----------|---------|
| `_defs/enums.ts` | `generator.ts:renderEnumVar` via `generateMultiSchemaModule` | Full `defineEnum(...)` calls with value sets |
| `_defs/inputs.ts` | `generator.ts:renderInputVar` via `generateMultiSchemaModule` | `{ name, fields: { fieldName: "k|Type|modifier" } }` objects |
| `_defs/objects.ts` | `generator.ts:renderObjectVar` via `generateMultiSchemaModule` | `{ name, fields: { fieldName: { spec, arguments: {...} } } }` objects |
| `_defs/unions.ts` | `generator.ts:renderUnionVar` via `generateMultiSchemaModule` | `{ name, types: { MemberName: true } }` objects |
| `_internal.ts` | `generator.ts:multiRuntimeTemplate` | Imports defs, assembles schema, creates `createVarMethodFactory`, `inputTypeMethods_*`, `createGqlElementComposer` call |
| `_internal-injects.ts` | `generator.ts:generateInjectsCode` | Scalar/adapter re-exports from user inject files |
| `index.ts` | `generator.ts:generateIndexModule` | Re-exports `__gql_*`, prebuilt context types |
| `types.prebuilt.ts` | `generator.ts:generatePrebuiltStub` | Empty stub (typegen fills it in) |

### Target output structure (RFC)

| Before | After | Change |
|--------|-------|--------|
| `_defs/enums.ts` | removed | Deleted — enum info moves to `_defs/type-names.ts` as name-only list |
| `_defs/inputs.ts` | removed | Deleted — input info moves to `_defs/type-names.ts` as name-only list |
| `_defs/objects.ts` | `_defs/graph.ts` | Restructured: single object export (not per-type), spec strings only (no `arguments` sub-object, no `name` property) |
| `_defs/unions.ts` | `_defs/unions.ts` (simplified) | Same file, but value changes from `{ MemberName: true }` to `["MemberName", ...]` array |
| `_internal.ts` | simplified | No `createVarMethodFactory`, no `inputTypeMethods_*`, schema uses `typeNames` instead of full `scalar`/`enum`/`input` records |
| `_internal-injects.ts` | unchanged | Still holds scalar/adapter re-exports |
| `index.ts` | updated | PrebuiltContext type updated for new API (no `.operation()`, no `$var`) |
| `types.prebuilt.ts` | extended | Stub unchanged, but typegen output adds `varTypes` and `fields` entries |

### Generator changes required

#### `packages/tools/src/codegen/generator.ts`

**Functions to DELETE:**
- `renderEnumVar` (line ~269) — produces `defineEnum(...)` calls
- `renderInputVar` (line ~278) — produces `input_${name}_${type}` objects
- `renderInputTypeMethods` (line ~330) — produces `inputTypeMethods_*` block
- `renderInputTypeMethod` (line ~327) — helper

**Functions to MODIFY:**
- `renderObjectVar` (line ~283) → `renderObjectEntry`: change output format from `{ name: "T", fields: { f: { spec: "...", arguments: {} } } }` to just `{ f: "spec" }` (field → spec string only, arguments dropped at MinimalSchema level; arguments needed only for typegen which uses the full schema from codegen output, not MinimalSchema)
  - **Important:** Field arguments are still needed by typegen (for `fields.*.args` in `varTypes`/`fields` entries). They must be preserved somewhere — either kept in a separate structure or typegen uses the schema from before MinimalSchema reduction.
  - **Decision point:** The RFC example shows `graph.ts` having no `arguments` — only spec strings per field. Field arguments for typegen must come from the full `SchemaIndex` which codegen still has during generation. Typegen accesses `AnyGraphqlSchema` via the CJS bundle export `__schema_*`; if `MinimalSchema` replaces that, typegen loses argument info. Resolution: Keep `__schema_*` export as full `AnyGraphqlSchema` in the CJS bundle (not MinimalSchema) OR pass argument data through a separate structure. RFC says typegen generates `fields.*.args` — it must have argument info. The CJS bundle can export both `__schema_*` (full) and the MinimalSchema is just what `createGqlElementComposer` receives.
- `renderUnionVar` (line ~288) → change to produce array format: `["Member1", "Member2"]`

**Functions to ADD:**
- `renderGraphEntry(schemaName, objectTypeNames, ...)` — generates the new `object_${name}` single-object export mapping `TypeName → { fieldName: "spec" }`
- `renderTypeNamesEntry(schemaName, scalarNames, enumNames, inputNames)` — generates `typeNames_${name}` with three arrays

**`multiRuntimeTemplate` changes (line ~580):**
- Remove `createVarMethodFactory<>()` call lines
- Remove `inputTypeMethods_*` variable generation
- Remove `inputTypeMethods` from `createGqlElementComposer` options
- Change `const object_${name} = { TypeName: object_${name}_TypeName, ... }` assembly to import `object_${name}` from `_defs/graph`
- Remove enum/input assembly lines
- Add `typeNames_${name}` import from `_defs/type-names`
- Change schema assembly to MinimalSchema shape:
  ```typescript
  const ${schemaVar} = {
    label: "${name}" as const,
    operations: { ... } as const,
    object: object_${name},
    union: union_${name},
    typeNames: typeNames_${name},
  } as const satisfies MinimalSchema;
  ```
- Remove `AnyGraphqlSchema` import, import `MinimalSchema` instead
- Remove `createVarMethodFactory` from core imports
- Keep exporting `__schema_${name}` but it's now MinimalSchema shape (the full schema is no longer in the CJS bundle — typegen must use SchemaIndex from the DocumentNode directly, see below)

**`generateDefsStructure` in `defs-generator.ts`:**
- `DefinitionCategory` type: remove `"enums"` and `"inputs"`, add `"graph"` and `"type-names"`
- `CategoryVars` type: remove `enums` and `inputs` fields, add `graph` and `typeNames` fields
- Update `importPaths` defaults

**`generateMultiSchemaModule` orchestration (line ~813):**
- Remove `enumVars`, `inputVars` from `schemaConfigs`
- Add `graphVars` and `typeNamesCode` to `schemaConfigs`
- Remove `inputTypeMethodsBlock` and `directiveMethodsBlock` generation
- Remove `inputTypeMethods_*` from prebuilt exports `__inputTypeMethods_${name}`

**`generateIndexModule` (line ~1039):**
- Update `PrebuiltContext_*` types: remove `$var`, remove `.operation()` from query/mutation/subscription
- Update `PrebuiltCallbackOperation_*` to new options object shape
- Update `GenericFieldFactory_*` to function call form `f("fieldName", args)` rather than `f.fieldName(args)`

#### `packages/tools/src/codegen/runner.ts`

- Remove `inputDepthOverrides` and `defaultInputDepth` config forwarding (MinimalSchema doesn't have these)
- Remove `chunkSize` for the old category vars; the new `graph.ts` and `type-names.ts` don't chunk in the same way (they are single consolidated exports)
- Update `CategoryVars` usage to match new fields

### Impact on typegen (Step 3 dependency)

The current `runTypegen` (`packages/tools/src/typegen/runner.ts:113`) calls:
```typescript
const schemasResult = loadSchemasFromBundle(cjsPath, schemaNames);
```

This loads the `__schema_*` exports from the CJS bundle. After Step 2, `__schema_*` will be `MinimalSchema` (no `scalar`/`enum`/`input` typed definitions). Typegen's `emitPrebuiltTypes` in `emitter.ts` uses `AnyGraphqlSchema` extensively:
- `calculateFieldsType(schema, ...)` — walks `schema.scalar`, `schema.enum`, `schema.object`
- `generateInputObjectType(schema, ...)` — walks `schema.input`
- `collectUsedInputObjects(schema, ...)` — checks `schema.scalar`, `schema.enum`, `schema.input`

**Resolution:** Typegen needs the full schema. Two options:
1. Keep a separate full-schema export in the CJS bundle (`__fullSchema_*`) alongside `MinimalSchema` (`__schema_*`)
2. Have codegen export both shapes

Option 1 is cleaner: `__schema_*` → `MinimalSchema` (for runtime/composer), `__fullSchema_*` → `AnyGraphqlSchema` (for typegen only). The typegen runner loads `__fullSchema_*` instead of `__schema_*`. This is a localized change.

---

## Step 3: Typegen changes (`types.prebuilt.ts` extension)

### Current output

`packages/tools/src/typegen/emitter.ts` generates for each operation entry:
```typescript
readonly "GetEmployee": { readonly input: {...}; readonly output: {...} };
```

For each fragment entry:
```typescript
readonly "EmployeeFragment": { readonly typename: "Employee"; readonly input: {...}; readonly output: {...} };
```

### RFC target — add `varTypes` and `fields`

For operations, add:
```typescript
readonly "GetEmployee": {
  readonly input: {...};
  readonly output: {...};
  readonly varTypes: { readonly employeeId: ...; readonly taskLimit: ... | null };    // NEW
  readonly fields: {                                                                    // NEW
    readonly "Query": { readonly employee: { args: { id: string | VarRef }; returns: "Employee" } };
    readonly "Employee": { ... };
  };
};
```

### Changes required in `emitter.ts`

**`PrebuiltOperationEntry` type (line ~73):** Add `varTypes` and `fields` string fields.

**`groupBySchema` function (line ~101):** For operation entries, call two new generators:
1. `generateVarTypes(schema, selection.variableDefinitions)` → TypeScript type string for `varTypes`
2. `generateFieldsMap(schema, selection)` → TypeScript type string for `fields`

**`generateTypesCode` function (line ~342):** Update operation entry template:
```typescript
// Before:
`    readonly "${o.key}": { readonly input: ${o.inputType}; readonly output: ${o.outputType} };`

// After:
`    readonly "${o.key}": { readonly input: ${o.inputType}; readonly output: ${o.outputType}; readonly varTypes: ${o.varTypes}; readonly fields: ${o.fields} };`
```

**`PrebuiltTypeRegistry` type (line in `packages/core/src/prebuilt/types.ts`):** Add `varTypes` and `fields` to the operation entry constraint:
```typescript
readonly operations: {
  readonly [key: string]: {
    readonly input: object;
    readonly output: object;
    readonly varTypes?: unknown;  // optional for backwards compat
    readonly fields?: unknown;
  };
};
```

### New functions to add in `emitter.ts`

**`generateVarTypes(schema, variableDefinitions)`**:
- For each variable definition node, resolve the TypeScript input type
- Use `generateInputType` with appropriate formatters
- Output shape: `{ readonly varName: TypeString; ... }`

**`generateFieldsMap(schema, selection)`**:
- Walk the selected fields from the operation's `fields` map
- For each object type encountered:
  - List each selected field with its `args` type (from `schema.object[type].fields[field].arguments`)
  - `returns` is the nested object type name (or `null` for scalars/enums)
- Output shape matches RFC Section 4.2 `fields` example

**Important:** The `generateFieldsMap` function needs field argument specs from `schema.object[type].fields[field]`. After Step 2, `__schema_*` is MinimalSchema (no argument data). This confirms the need for `__fullSchema_*` in the CJS bundle for typegen to access argument information.

---

## File Impact Summary

### `packages/core/src/types/schema/schema.ts`
- Add `MinimalSchema` type
- Retain `AnyGraphqlSchema` (typegen's type-calculator still uses it)
- Update `UnionDefinition` to use array instead of `{ [typename]: true }` map (or add new type alongside)

### `packages/core/src/prebuilt/types.ts`
- Add optional `varTypes` and `fields` to `PrebuiltTypeRegistry` operation entry

### `packages/tools/src/codegen/generator.ts`
- Delete: `renderEnumVar`, `renderInputVar`, `renderInputTypeMethods`, `renderInputTypeMethod`
- Add: `renderGraphEntry`, `renderTypeNamesEntry`
- Modify: `renderObjectVar` → stripped spec-only format
- Modify: `renderUnionVar` → array format
- Modify: `multiRuntimeTemplate` — remove inputTypeMethods, adapt schema assembly
- Modify: `generateIndexModule` — update PrebuiltContext types
- Keep: all scalar-related rendering (scalars still in `_internal-injects.ts`)

### `packages/tools/src/codegen/defs-generator.ts`
- Update `DefinitionCategory` union: remove `"enums"` and `"inputs"`, add `"graph"` and `"type-names"`
- Update `CategoryVars` shape accordingly

### `packages/tools/src/codegen/runner.ts`
- Update CategoryVars usage
- Export `__fullSchema_*` (full AnyGraphqlSchema) from CJS bundle for typegen
- Remove inputDepthOverrides forwarding (MinimalSchema doesn't carry depth config)

### `packages/tools/src/typegen/emitter.ts`
- Add `varTypes` and `fields` to `PrebuiltOperationEntry`
- Add generator functions: `generateVarTypes`, `generateFieldsMap`
- Update `generateTypesCode` template for operations

### `packages/tools/src/typegen/runner.ts`
- Load `__fullSchema_*` instead of `__schema_*` from CJS bundle

### Fixture / test files to update
- `fixture-catalog/graphql-system/_defs/` — all 4 files change structure
- `fixture-catalog/graphql-system/_internal.ts` — simplified
- `fixture-catalog/graphql-system/types.prebuilt.ts` — extended with varTypes/fields
- All `packages/core/src/composer/*.test.ts` that use `AnyGraphqlSchema` as a mock schema type must be updated to use `MinimalSchema` (or still use `AnyGraphqlSchema` if testing typegen-only paths)
- `packages/tools/src/codegen/generator.test.ts`, `defs-generator.test.ts` — new test cases

---

## Dependency Graph

```
Step 1: Define MinimalSchema type in core
  └→ Step 2: Codegen generates MinimalSchema-shaped _internal.ts + new _defs/graph.ts + _defs/type-names.ts
       └→ Step 3: Typegen emitter adds varTypes + fields to types.prebuilt.ts
            └→ Steps 4-6: Core composer uses MinimalSchema; $var deleted; f("field") implemented
```

Step 3 also depends on Step 2's decision to export `__fullSchema_*` (full AnyGraphqlSchema) from the CJS bundle, because generating `varTypes` and `fields.*.args` requires field argument information not present in MinimalSchema.

---

## Open Questions

1. **CJS bundle full-schema export**: Should codegen export `__fullSchema_*` (AnyGraphqlSchema) alongside `__schema_*` (MinimalSchema)? Or should typegen reconstruct the full schema from the original `.graphql` files (which it doesn't currently have access to)?
   - Recommended: Export `__fullSchema_*` from CJS bundle. Typegen already requires the CJS bundle; adding a second export is minimal overhead.

2. **`build-document.ts` enum validation**: Currently `buildVariables` uses `schema.enum[name]` to resolve enum type info for argument construction. With MinimalSchema, only `schema.typeNames.enum` (name list) is available. The enum value-to-AST conversion in `buildArgumentValue` at `build-document.ts:71` uses `EnumLookup.schema.enum[name]` — this still needs the full schema or the enum kind must be detected differently (e.g., via `schema.typeNames.enum.includes(name)`).
   - The spec string prefix (`e|Name|modifier`) already encodes the type kind, so `buildArgumentValue` can check the specifier kind character rather than looking up the schema. This is the right fix.

3. **`UnionDefinition.types` → array change**: Changing union representation from `{ [typename]: true }` to `string[]` breaks `UnionMemberName` type utility and any code that spreads union members. The RFC is clear about this format change; it just needs to be tracked across all union consumers (mostly in `fields-builder.ts` and fragment spreading).

---

## Follow-up A: `__fullSchema_*` Export Details

### How the CJS bundle is produced

**Bundler code:** `packages/tools/src/codegen/bundler/esbuild.ts:6`

```typescript
export const esbuildBundler: Bundler = {
  name: "esbuild",
  bundle: async ({ sourcePath, external }) => {
    await build({
      entryPoints: [sourcePath],  // sourcePath = index.ts (the codegen entry point)
      outfile: cjsPath,           // cjsPath = index.cjs (same basename, .cjs extension)
      format: "cjs",
      platform: "node",
      bundle: true,
      external: [...external],    // ["@soda-gql/core", "@soda-gql/core/runtime"]
      treeShaking: false,         // ← all exports are preserved, including __schema_*
    });
  },
};
```

Entry point is `index.ts` (the generated file at `outPath`). esbuild bundles everything into `index.cjs`. The bundler is called from `packages/tools/src/codegen/runner.ts:326`.

**Key point:** `treeShaking: false` means ALL exports in `_internal.ts` and `index.ts` end up in the CJS bundle, including `__schema_*`, `__inputTypeMethods_*`, `__directiveMethods_*`, `__gql_*`.

### What `__schema_*` looks like in the bundle today

From `fixture-catalog/graphql-system/_internal.ts:127`:

```typescript
export { defaultSchema as __schema_default };
```

Where `defaultSchema` is the full `AnyGraphqlSchema` object assembled at `_internal.ts:41`:

```typescript
const defaultSchema = {
  label: "default" as const,
  operations: { query: "Query", mutation: "Mutation", subscription: "Subscription" } as const,
  scalar: scalar_default,   // ← imported from _internal-injects.ts (scalar/adapter types)
  enum: enum_default,       // ← { CacheScope: defineEnum(...), EmployeeRole: defineEnum(...), ... }
  input: input_default,     // ← { BigIntFilter: { name, fields: {...} }, ... }
  object: object_default,   // ← { Comment: { name, fields: { ... spec objects ... } }, ... }
  union: union_default,     // ← { ActivityItem: { name, types: { Comment: true, Task: true } }, ... }
} as const satisfies AnyGraphqlSchema;
```

The `__schema_*` export is the **same runtime object** that `createGqlElementComposer` receives. The `$schema` property on the gql composer points to this same object (set in `gql-composer.ts:166`).

### How `loadSchemasFromBundle` consumes `$schema`

**File:** `packages/builder/src/schema-loader.ts:47`

The loader does NOT access `__schema_*` directly. It accesses the `$schema` property on each gql composer through the `gql` export object:

```typescript
// schema-loader.ts:87
const gql = finalExports.gql as Record<string, { $schema?: unknown }>;

// schema-loader.ts:112
const schema = composer.$schema;  // composer = gql["default"], gql["admin"], etc.

schemas[name] = schema as AnyGraphqlSchema;
```

**Flow:** `index.cjs` → evaluate in VM sandbox (`executeSandbox`) → get `exports.gql` → `gql.default.$schema` = `defaultSchema`.

`index.ts:164` exports:
```typescript
export const gql = {
  default: __gql_default as unknown as GqlComposer_default,
  admin: __gql_admin as unknown as GqlComposer_admin
};
```

`__gql_default` is `gql_default` from `_internal.ts:125`, which is the result of `createGqlElementComposer(defaultSchema, ...)`. The `$schema` property on this composer is `defaultSchema` itself (`gql-composer.ts:166-171`).

### Size/complexity impact analysis

**Current CJS bundle contents (relevant exports from `_internal.ts`):**
- `__schema_default` — the full `AnyGraphqlSchema` with `scalar`, `enum`, `input`, `object`, `union` records
- `__inputTypeMethods_default` — one entry per input type name (scalars + enums + inputs)
- `__directiveMethods_default` — one entry per directive
- `__gql_default` — the composer with `$schema = __schema_default`

The full schema is already in the bundle today. With MinimalSchema reform:
- `__schema_*` becomes MinimalSchema (smaller: no `scalar`/`enum`/`input` typed definitions)
- Typegen needs the full schema with field argument specs

**Is the full schema used at runtime (production bundles)?**

No. The CJS bundle (`index.cjs`) is a **dev-time artifact** consumed only by:
1. The typegen runner (`runTypegen` → `loadSchemasFromBundle` → accesses `$schema`)
2. The builder service (`createBuilderService`) during build artifact evaluation

The CJS bundle is NOT imported by application code. Application code imports from `index.ts` (TypeScript source), which is bundled by the app's own bundler (Vite, webpack, etc.) — that bundler only needs the `gql` export for types and the runtime functions.

**Production bundle impact of adding `__fullSchema_*`:** Zero. The esbuild CJS bundle is only read by the typegen/builder tooling at dev time.

### Alternatives analysis

**Option A (recommended): Export `__fullSchema_*` alongside `__schema_*`**

In `multiRuntimeTemplate` (`generator.ts:721+`), add one more export line:
```typescript
// Existing:
export { ${schemaVar} as __schema_${name} };

// New (keep full schema for typegen):
export { ${fullSchemaVar} as __fullSchema_${name} };
```

Where `fullSchemaVar` is the pre-MinimalSchema object (built with `scalar`, `enum`, `input` etc.) still assembled in `_internal.ts`. The MinimalSchema `__schema_*` is the slim version for `createGqlElementComposer`.

In `schema-loader.ts`, load `__fullSchema_*` directly instead of going through `gql.$schema`.

This is the cleanest approach: localized change, no new infrastructure.

**Option B: Typegen reads from `.graphql` files directly**

Typegen would need to know the `.graphql` file paths (currently only codegen does). `runTypegen` receives `ResolvedSodaGqlConfig` which contains `config.schemas[name].schema` (the schema file paths). So typegen COULD load and parse the `.graphql` files itself using `loadSchema` from the codegen package.

However this duplicates schema processing logic, requires typegen to depend on the codegen `schema.ts` module, and bypasses the `typeFilter` configuration that codegen applies to exclude certain types. Codegen already applies the filter before writing the excluded-types-aware `AnyGraphqlSchema` to `_internal.ts`. Reading raw `.graphql` files would include excluded types.

**Option C: Export from SchemaIndex**

Not feasible — `SchemaIndex` is a codegen-internal `Map`-based structure, not serializable to CJS.

**Conclusion:** Option A is the right choice. The only question is what exact shape `__fullSchema_*` should export: the current `AnyGraphqlSchema` (with all the heavy scalar/enum/input typed definitions including `defineEnum()` results) or a lighter intermediate representation. Given typegen needs `schema.input[name].fields` for type calculation and `schema.enum[name].values` for enum value lists (used in `getEnumType` in `type-calculator.ts:131`), it needs the full `AnyGraphqlSchema`. So `__fullSchema_*` = current `__schema_*`.

---

## Follow-up B: `build-document.ts` Enum Detection — Full Code Path

### The two `schema.input` access points

There are exactly **three** places in the production composer code that access the schema for type kind resolution. All are in `build-document.ts`. There are NO `schema.enum`, `schema.scalar` accesses in `build-document.ts` — the file only accesses `schema.input` and `schema.object`.

#### Access 1: `buildArgumentValue` — object branch (line 116)

```typescript
// build-document.ts:108-134
if (typeof value === "object") {
  return {
    kind: Kind.OBJECT,
    fields: Object.entries(value)
      .map(([key, fieldValue]): ObjectFieldNode | null => {
        // Look up field type in nested InputObject for enum detection
        let fieldTypeSpecifier: ParsedInputSpecifier | null = null;
        if (enumLookup.typeSpecifier?.kind === "input") {
          const inputDef = enumLookup.schema.input[enumLookup.typeSpecifier.name];  // ← schema.input access
          const fieldSpec = inputDef?.fields[key];
          fieldTypeSpecifier = fieldSpec ? parseInputSpecifier(fieldSpec) : null;
        }
        // ...
      })
  };
}
```

**What this does:** When a value is an object (input object type), it looks up the schema's `input` record to find the field spec strings for that input type's fields. This allows nested enum detection: if you pass `{ status: "ACTIVE" }` to a field whose argument type is `StatusInput`, and `StatusInput.status` is `"e|Status|!"`, then `"ACTIVE"` gets emitted as `Kind.ENUM`.

The guard `enumLookup.typeSpecifier?.kind === "input"` ensures this only runs when the current type is an input object. The `schema.input[name]` lookup retrieves `{ name: string, fields: InputTypeSpecifiers }`.

#### Access 2: `buildConstValueNode` — object branch (line 417)

```typescript
// build-document.ts:409-434 (in buildConstValueNode)
if (typeof value === "object") {
  return {
    kind: Kind.OBJECT,
    fields: Object.entries(value)
      .map(([key, fieldValue]): ConstObjectFieldNode | null => {
        let fieldTypeSpecifier: ParsedInputSpecifier | null = null;
        if (enumLookup.typeSpecifier?.kind === "input") {
          const inputDef = enumLookup.schema.input[enumLookup.typeSpecifier.name];  // ← schema.input access
          const fieldSpec = inputDef?.fields[key];
          fieldTypeSpecifier = fieldSpec ? parseInputSpecifier(fieldSpec) : null;
        }
        // ...
      })
  };
}
```

Identical pattern to Access 1, but for constant values (default values in variable definitions). Called from `buildVariables` (line 571) for `$var.defaultValue`.

**Note:** `buildVariables` (line 558) is called only for the callback-builder `$var()` path. Tagged template variables use a different path (parsed from GraphQL syntax). After `$var` is deleted in Steps 4-6, `buildVariables` is also deleted. **Both `schema.input` accesses disappear entirely when `$var` is removed.**

#### Access 3: `expandShorthand` — `schema.object` (line 280)

```typescript
// build-document.ts:279-299
const expandShorthand = (schema: AnyGraphqlSchema, typeName: string, fieldName: string): AnyFieldSelection => {
  const typeDef = schema.object[typeName];  // ← schema.object access
  // ...
  const fieldSpec = typeDef.fields[fieldName];
  // ...
};
```

This accesses `schema.object[typeName].fields[fieldName]` — the same structure that MinimalSchema retains. **No change needed here.**

### Where the `typeSpecifier` for enum detection comes from

The `EnumLookup.typeSpecifier` is set in `buildArguments` (line 170):

```typescript
// build-document.ts:170-188
const buildArguments = (
  args: AnyAssignableInput,
  argumentSpecifiers: InputTypeSpecifiers,
  schema: AnyGraphqlSchema,
): ArgumentNode[] =>
  Object.entries(args ?? {})
    .map(([name, value]): ArgumentNode | null => {
      const specifierStr = argumentSpecifiers[name];
      const typeSpecifier = specifierStr ? parseInputSpecifier(specifierStr) : null;
      const valueNode = buildArgumentValue(value, { schema, typeSpecifier });
      // ...
    });
```

`argumentSpecifiers` comes from `parsedType.arguments` — that is, from the field's `DeferredOutputFieldWithArgs.arguments` record in the current `_defs/objects.ts` format:

```typescript
// current _defs/objects.ts format:
object_default_Employee = { name: "Employee", fields: {
  tasks: { spec: "o|Task|![]!", arguments: { limit: "s|Int|?" } },
  // ...
}}
```

`parseOutputField` extracts `arguments` as a `Record<string, string>` of deferred input specifier strings. `parseInputSpecifier("s|Int|?")` yields `{ kind: "scalar", ... }` or `parseInputSpecifier("e|Status|!")` yields `{ kind: "enum", ... }`.

**The enum detection chain is:**
1. Field arg spec string from `_defs/objects.ts` — e.g., `"e|SortOrder|?"`
2. `parseInputSpecifier` → `{ kind: "enum", name: "SortOrder", ... }`
3. `buildArgumentValue` checks `typeSpecifier?.kind === "enum"` at line 139
4. Outputs `Kind.ENUM` for the string value

**No `schema.enum` lookup is involved at any point.** The `typeSpecifier.kind` comes entirely from the spec string prefix character.

### Is the `e|` prefix reliably available at enum detection time?

**Yes, with one important nuance.**

For top-level argument values: the spec string comes directly from `parsedType.arguments[name]` (field argument specifiers from the object definition). These always have the correct kind prefix.

For nested object values (the `schema.input` access path): the spec string comes from `schema.input[typeName].fields[key]` — the input type's field specifier. These also have correct kind prefixes (e.g., `"e|SortOrder|?"` for an enum field in an input type).

**The only thing `schema.input` is used for** is to look up nested input type field specifiers (to propagate enum detection into nested objects). With MinimalSchema, `schema.input` doesn't exist — but `schema.typeNames.input` is just a name list and cannot serve this purpose.

### The minimal change to switch from schema lookup to spec-prefix detection

Since `schema.input` is **only used to get field spec strings for nested input types**, and since these spec strings encode the kind in their prefix, the fix is:

**Option 1 (clean): Store field specs in MinimalSchema's typeNames or a new `inputFields` map**

Add to MinimalSchema:
```typescript
inputFields: {
  readonly [typeName: string]: {
    readonly [fieldName: string]: string; // spec string, e.g. "e|SortOrder|?"
  };
}
```

Then replace:
```typescript
// Before:
const inputDef = enumLookup.schema.input[enumLookup.typeSpecifier.name];
const fieldSpec = inputDef?.fields[key];
```
with:
```typescript
// After:
const fieldSpec = enumLookup.schema.inputFields?.[enumLookup.typeSpecifier.name]?.[key];
```

This preserves the existing behavior exactly. The `inputFields` shape is already available during codegen generation (it's the current `InputRecord.fields` data). This is minimal and self-contained.

**Option 2 (simpler, incomplete): Use typeNames.input as existence check only**

This would break nested enum detection because without the field specs, we cannot know which fields of an input type are enums. Not viable.

**Option 3 (from prior report, now corrected): Use spec prefix from parent context**

The prior report suggested using `schema.typeNames.enum.includes(name)` for enum detection. This is WRONG for the nested case: when we are inside an input object `{ status: "ACTIVE" }`, we do not have the spec string for `status` — we only know the parent type is `StatusInput`. We need the input type's field map to find the spec for `status`.

**Conclusion:** The cleanest approach for MinimalSchema is Option 1 — add `inputFields` to MinimalSchema containing input type field spec strings. This:
- Replaces the current `schema.input[name].fields` lookup directly
- Keeps the same runtime behavior (nested enum detection works correctly)
- Is smaller than the full `input: { name, fields: {...} }` records (drops the `name` property, but field specs are identical)
- Codegen already generates these spec strings for `_defs/inputs.ts`; they just go into a different shape

The `inputFields` data is NOT needed after `$var` is deleted (Steps 4-6), because `buildArguments` / `buildVariables` / `buildConstValueNode` are only called from the `$var` callback-builder path. After deletion, MinimalSchema can drop `inputFields` entirely. But for Step 1 (MinimalSchema as the new type), it must be included for backwards compatibility during the transition period.

### Full list of `schema.enum`/`schema.input`/`schema.scalar` accesses across all production composer files

From the grep results, only `build-document.ts` accesses `schema.input` in production code:

| File | Line | Access | Context |
|------|------|--------|---------|
| `build-document.ts` | 116 | `schema.input[name]` | `buildArgumentValue` — nested enum detection in input objects |
| `build-document.ts` | 417 | `schema.input[name]` | `buildConstValueNode` — same, for const/default values |
| `build-document.ts` | 280 | `schema.object[typeName]` | `expandShorthand` — field spec lookup (MinimalSchema compatible) |
| `fragment-tagged-template.ts` | 148 | `schema.object[typeName]` | `buildFieldsFromSelectionSet` — field spec lookup (compatible) |
| `fragment-tagged-template.ts` | 168 | `schema.union[name]` | Union member validation: `!unionDef?.types[memberName]` |
| `fragment-tagged-template.ts` | 378 | `schema.object[typeName]` | `resolveFieldTypeName` — spec lookup (compatible) |
| `fragment-tagged-template.ts` | 424 | `schema.object` | `onType in schema.object` — existence check (compatible) |
| `fields-builder.ts` | 72 | `schema.object[typeName]` | Field factory creation (compatible) |
| `extend.ts` | 168 | `schema.operations` | Get root type name (compatible) |

The `fragment-tagged-template.ts:168` access is `schema.union[parsedType.name]` — specifically it checks `unionDef?.types[memberName]` where `types` is `{ MemberName: true }`. After MinimalSchema, `union[name]` becomes an array `["Member1", "Member2"]`. This lookup must change to `unionDef?.includes(memberName)`. This is the union representation change mentioned in the original report.

**Summary of schema accesses that require MinimalSchema changes:**
1. `build-document.ts:116, 417` — `schema.input[name].fields[key]` → needs `schema.inputFields[name][key]` (add `inputFields` to MinimalSchema), deleted in Steps 4-6 with `$var`
2. `fragment-tagged-template.ts:168` — `schema.union[name].types[memberName]` → needs `schema.union[name].includes(memberName)` after union shape change to array

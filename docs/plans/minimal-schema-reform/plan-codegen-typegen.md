# Implementation Plan: Codegen, Typegen, Formatter & Test Migration

## Overview

This plan covers RFC Steps 2, 3, 7, and 8:
- **Step 2**: Codegen generates MinimalSchema-shaped output + `__fullSchema_*` for typegen
- **Step 3**: Typegen extends `types.prebuilt.ts` with `varTypes` and `fields`
- **Step 7**: Formatter updates for options object syntax and line break rules
- **Step 8**: Mechanical test/fixture rewrite rules

All changes are in a single PR. No migration paths (pre-release v0.2.0).

**Prerequisites**: Step 1 (MinimalSchema type in Core) must be complete. Steps 2 and 4-6 can proceed in parallel. Step 3 (typegen) depends on Step 2 (codegen) for `__fullSchema_*` exports. Step 8 (test rewrite) depends on all implementation steps. See `plan-core.md` "Implementation Order" for the full dependency graph.

---

## Step 2: Codegen Changes

### 2.0 Authoritative `_defs/` Strategy

**Key Design Principle**: MinimalSchema reduces TypeScript type-checking cost only. Codegen output retains full field argument data at JavaScript runtime.

**`_defs/` files:**
- **ALL existing `_defs/` files are KEPT UNCHANGED** (`enums.ts`, `inputs.ts`, `objects.ts`, `unions.ts`)
  - These feed both `__fullSchema_*` (for typegen) AND `MinimalSchema.object` (runtime data via type cast)
  - `objects.ts` retains `{ spec, arguments }` format — the MinimalSchema TS type sees it as `string`, but runtime code accesses arguments via duck-typing
- **NEW file added: `_defs/type-names.ts`** — scalar/enum/input name arrays for `MinimalSchema.typeNames`
- **`_defs/graph.ts` is NOT generated** — `objects.ts` is reused for MinimalSchema with a type cast

**`_internal.ts`** assembles two schemas:
- `minimalSchema_${name}`: MinimalSchema (uses existing `object_${name}` with type cast, union conversion from old format, `typeNames_${name}`)
- `fullSchema_${name}`: AnyGraphqlSchema (unchanged assembly from existing _defs)

### 2.1 `packages/tools/src/codegen/defs-generator.ts`

**EXPAND (not replace) `DefinitionCategory` and `CategoryVars`:**

```typescript
// BEFORE:
export type DefinitionCategory = "enums" | "inputs" | "objects" | "unions";
export type CategoryVars = {
  readonly enums: readonly DefinitionVar[];
  readonly inputs: readonly DefinitionVar[];
  readonly objects: readonly DefinitionVar[];
  readonly unions: readonly DefinitionVar[];
};

// AFTER: add "type-names", keep all existing categories
export type DefinitionCategory = "enums" | "inputs" | "objects" | "unions" | "type-names";
export type CategoryVars = {
  readonly enums: readonly DefinitionVar[];
  readonly inputs: readonly DefinitionVar[];
  readonly objects: readonly DefinitionVar[];
  readonly unions: readonly DefinitionVar[];
  readonly typeNames: readonly DefinitionVar[];
};
```

**Update `generateDefsStructure`:**
- Add `"type-names"` to the categories iteration (keep all existing categories)
- Add `importPaths` entry: `"type-names": "./_defs/type-names"`
- Keep all existing `importPaths` unchanged
- Keep `needsDefineEnum` logic unchanged (enums.ts still generated)

### 2.2 `packages/tools/src/codegen/generator.ts`

#### Functions to DELETE

| Function | Line | Reason |
|----------|------|--------|
| `renderInputTypeMethod` | ~327 | `inputTypeMethods` eliminated |
| `renderInputTypeMethods` | ~330 | `inputTypeMethods` eliminated |

#### Functions KEPT UNCHANGED

- `renderEnumVar` — still generates per-enum `defineEnum()` calls for `_defs/enums.ts`
- `renderInputVar` — still generates per-input objects for `_defs/inputs.ts`
- `renderObjectVar` — still generates per-type `{ name, fields: { f: { spec, arguments } } }` for `_defs/objects.ts`
- `renderUnionVar` — still generates per-union `{ name, types: { ... } }` for `_defs/unions.ts`

#### Functions to ADD

**Add `renderTypeNamesObject`**

New function to generate the `typeNames_${name}` export:

```typescript
const renderTypeNamesObject = (
  schemaName: string,
  scalarNames: string[],
  enumNames: string[],
  inputNames: string[],
): string => {
  const scalarList = scalarNames.map((n) => `"${n}"`).join(", ");
  const enumList = enumNames.map((n) => `"${n}"`).join(", ");
  const inputList = inputNames.map((n) => `"${n}"`).join(", ");
  return `const typeNames_${schemaName} = {
  scalar: [${scalarList}],
  enum: [${enumList}],
  input: [${inputList}],
} as const;`;
};
```

#### `MultiRuntimeTemplateOptions` type update

```typescript
// Remove from per-schema config:
// - inputTypeMethodsBlock (deleted)

// Add to per-schema config:
// - typeNamesCode: string (typeNames object code)

// Keep all existing fields (enumVars, inputVars, objectNames, etc. — still needed for full schema)

type MultiRuntimeTemplateOptions = {
  readonly schemas: Record<string, {
    readonly queryType: string;
    readonly mutationType: string;
    readonly subscriptionType: string;
    // NEW for MinimalSchema
    readonly typeNamesCode: string;
    // ALL existing fields kept for full schema export
    readonly scalarVars: string[];
    readonly scalarNames: string[];
    readonly enumVars: string[];
    readonly enumNames: string[];
    readonly inputVars: string[];
    readonly inputNames: string[];
    readonly objectNames: string[];  // needed for full schema assembly
    readonly unionNames: string[];   // needed for full schema assembly
    readonly directiveMethodsBlock: string;
    readonly defaultInputDepth?: number;
    readonly inputDepthOverrides?: Readonly<Record<string, number>>;
  }>;
  readonly injection: RuntimeTemplateInjection;
  readonly splitting: SplittingMode;
};
```

#### `multiRuntimeTemplate` function update

**Imports block changes:**
- Remove `createVarMethodFactory` from `@soda-gql/core` import
- Add `MinimalSchema` to `@soda-gql/core` import (keep `AnyGraphqlSchema` for `__fullSchema_*`)
- Keep `defineEnum` imported only in `_defs/enums.ts` (already split)
- In split mode, import from new path: `"./_defs/type-names"`
- Keep ALL existing imports (enums, inputs, objects, unions per-type for full schema assembly)

**Per-schema block: dual schema assembly in `_internal.ts`**

The generator assembles two schemas in `_internal.ts`:

1. **Full schema** (unchanged): existing `AnyGraphqlSchema` assembly from `_defs/{enums,inputs,objects,unions}`
2. **MinimalSchema** (new): uses existing `object_${name}` from `_defs/objects.ts` with type cast, generated union arrays inline, and `typeNames_${name}` from `_defs/type-names.ts`

Key insight: `_defs/objects.ts` data (with `{ spec, arguments }` per field) is reused for MinimalSchema's `object` field. The TypeScript type casts it to `MinimalSchema["object"]` (sees `string`), but JavaScript runtime retains the full `{ spec, arguments }` objects for enum detection.

Union data is generated inline since the generator already knows the union members — no runtime conversion needed.

Delete `createVarMethodFactory` and `inputTypeMethods_*` blocks.

#### Per-schema block in `_internal.ts` (after changes):

```typescript
// --- FULL SCHEMA (for typegen) ---
// [existing imports from _defs/enums, _defs/inputs, _defs/objects, _defs/unions]
// [existing scalar imports from _internal-injects]
// [existing assembly: enum_${name}, input_${name}, object_${name}_full, union_${name}]

const fullSchema_${name} = {
  label: "${name}" as const,
  operations: { query: "${queryType}", mutation: "${mutationType}", subscription: "${subscriptionType}" } as const,
  scalar: ${scalarRef},
  enum: enum_${name},
  input: input_${name},
  object: object_${name}_full,  // renamed from object_${name} to avoid clash with graph import
  union: union_${name},
} as const satisfies AnyGraphqlSchema;

// --- MINIMAL SCHEMA (for composer) ---
import { typeNames_${name} } from "./_defs/type-names";

// Union data generated inline (generator knows members)
const minimalUnion_${name} = {
  ActivityItem: ["Comment", "Project", "Task"],
  // ... (generated from schema)
} as const;

// Reuse object_${name} from _defs/objects.ts — JS runtime has full { spec, arguments } data,
// but TS type cast sees it as MinimalSchema["object"] (string-keyed)
const minimalSchema_${name} = {
  label: "${name}" as const,
  operations: { query: "${queryType}", mutation: "${mutationType}", subscription: "${subscriptionType}" } as const,
  object: object_${name} as unknown as MinimalSchema["object"],
  union: minimalUnion_${name},
  typeNames: typeNames_${name},
} as const satisfies MinimalSchema;

// --- COMPOSER ---
const ${customDirectivesVar} = { ...createStandardDirectives(), ...${config.directiveMethodsBlock} };
const ${gqlVarName} = createGqlElementComposer(minimalSchema_${name}, { directiveMethods: ${customDirectivesVar} });
// NOTE: inputTypeMethods removed from options

// --- EXPORTS ---
export { minimalSchema_${name} as __schema_${name} };
export { fullSchema_${name} as __fullSchema_${name} };
// export { inputTypeMethods_${name} as __inputTypeMethods_${name} };  // DELETED
export { ${customDirectivesVar} as __directiveMethods_${name} };
```

**Naming note**: `object_${name}` from `_defs/objects.ts` is used for BOTH full schema and MinimalSchema (with type cast). No name collision — the full schema's `object` field receives the same `object_${name}` variable.

#### `generateMultiSchemaModule` orchestration update

In the main loop (line ~826):

```typescript
// KEEP: existing scalarVars, enumVars, inputVars, objectVars, unionVars generation
// (all needed for _defs/ files and full schema assembly)

// ADD: generate typeNames for _defs/type-names.ts
const allScalarNames = [...builtinScalarTypes.keys(), ...customScalarNames];
const typeNamesCode = renderTypeNamesObject(name, allScalarNames, enumTypeNames, inputTypeNames);

// ADD: generate MinimalSchema union entries (inline in _internal.ts)
const minimalUnionEntries = unionTypeNames
  .map((uName) => {
    const record = schema.unions.get(uName);
    if (!record) return null;
    const members = Array.from(record.members.values())
      .filter((m) => !excluded.has(m.name.value))
      .sort((a, b) => a.name.value.localeCompare(b.name.value))
      .map((m) => `"${m.name.value}"`);
    return `  ${uName}: [${members.join(", ")}]`;
  })
  .filter((e): e is string => e !== null);
```

Add to `schemaConfigs`:
```typescript
schemaConfigs[name] = {
  // ...existing fields...
  graphEntries,         // NEW
  typeNamesCode,        // NEW
  minimalUnionEntries,  // NEW
};
```

#### `SplittingMode` update

Add new import paths:
```typescript
type SplittingMode = {
  readonly importPaths: {
    readonly enums: string;
    readonly inputs: string;
    readonly objects: string;
    readonly unions: string;
    readonly graph: string;       // NEW
    readonly typeNames: string;   // NEW
  };
};
```

Update default paths in `generateMultiSchemaModule`:
```typescript
const splitting: SplittingMode = {
  importPaths: {
    enums: "./_defs/enums",
    inputs: "./_defs/inputs",
    objects: "./_defs/objects",
    unions: "./_defs/unions",
    graph: "./_defs/graph",           // NEW
    typeNames: "./_defs/type-names",  // NEW
  },
};
```

#### `generateIndexModule` update (line ~1039)

**Remove from `PrebuiltContext_${name}`:**
- `readonly $var: VarBuilder<Schema_${name}>;` (line 1120)
- `readonly operation: PrebuiltCallbackOperation_${name}<"query">;` from query/mutation/subscription (lines 1107, 1112, 1116)

**Remove type:**
- `PrebuiltCallbackOperation_${name}` (line 1100-1102) — `.operation()` path is gone

**Update `GenericFieldFactory_${name}`:**
Change from property-keyed map to function call form:
```typescript
// BEFORE:
type GenericFieldFactory_${name} = { readonly [K in AllObjectFieldNames_${name}]: FieldFactoryFn_${name} }
  & Record<string, FieldFactoryFn_${name}>;

// AFTER:
type GenericFieldFactory_${name} = (fieldName: string, ...args: unknown[]) => Record<string, unknown>
  & ((callback: (tools: GenericFieldsBuilderTools_${name}) => Record<string, unknown>) => Record<string, unknown>);
```

**Update imports from `@soda-gql/core`:**
- Remove `VarBuilder` from import list (line 1146)

**Update `PrebuiltContext_${name}`:**
```typescript
export type PrebuiltContext_${name} = {
  readonly fragment: PrebuiltCurriedFragment_${name};
  readonly query: PrebuiltCurriedOperation_${name}<"query"> & {
    readonly compat: (...) => ...;
  };
  readonly mutation: PrebuiltCurriedOperation_${name}<"mutation"> & {
    readonly compat: (...) => ...;
  };
  readonly subscription: PrebuiltCurriedOperation_${name}<"subscription"> & {
    readonly compat: (...) => ...;
  };
  readonly define: <TValue>(factory: () => TValue | Promise<TValue>) => GqlDefine<TValue>;
  readonly extend: (...args: unknown[]) => AnyOperation;
  // readonly $var: VarBuilder<Schema_${name}>;  // DELETED
  readonly $dir: typeof __directiveMethods_${name};
  readonly $colocate: <T extends Record<string, unknown>>(projections: T) => T;
};
```

**Update `GqlComposer_${name}`:**
```typescript
type GqlComposer_${name} = {
  <TResult>(composeElement: (context: PrebuiltContext_${name}) => TResult): TResult;
  readonly $schema: MinimalSchema;  // was AnyGraphqlSchema
};
```

**Note**: The `GqlComposer_${name}` `$schema` type change from `AnyGraphqlSchema` to `MinimalSchema` is important. However, the typegen `schema-loader.ts` currently accesses `gql.${name}.$schema` and casts it as `AnyGraphqlSchema`. After this change, typegen must use `__fullSchema_*` exports directly instead of `$schema`. See Step 3 below.

#### `categoryVarsResult` update in `generateMultiSchemaModule`

The `categoryVars` result needs to include the new categories for `_defs/` file generation:

```typescript
return [
  schemaName,
  {
    // Keep existing for full schema _defs/ files
    enums: (config.enumVars as string[]).map((c) => toDefVar(c, "enum")),
    inputs: (config.inputVars as string[]).map((c) => toDefVar(c, "input")),
    objects: (config.objectVars as string[]).map((c) => toDefVar(c, "object")),
    unions: (config.unionVars as string[]).map((c) => toDefVar(c, "union")),
    // New for MinimalSchema _defs/ files
    graph: [{ name: `graph_${schemaName}`, code: graphObjectCode }],
    typeNames: [{ name: `typeNames_${schemaName}`, code: typeNamesCode }],
  },
];
```

### 2.3 `packages/tools/src/codegen/runner.ts`

**Update `runCodegen`:**

- The `_defs/` file generation loop needs to handle both old categories (enums, inputs, objects, unions) and new categories (graph, type-names)
- OR: use a combined `CategoryVars` that includes all categories

The simplest approach: expand `CategoryVars` to include all 6 categories, and `generateDefsStructure` handles them all. But this changes the `DefinitionCategory` type to include both old and new.

**Better approach**: Keep two separate `CategoryVars` types — one for legacy (`LegacyCategoryVars`) and one for MinimalSchema (`MinimalCategoryVars`). Generate two sets of defs files.

**Simplest approach (recommended)**: Since all 6 categories are independent, just generate all 6 in the runner loop. Expand `CategoryVars` union:

```typescript
export type DefinitionCategory = "enums" | "inputs" | "objects" | "unions" | "graph" | "type-names";

export type CategoryVars = {
  readonly enums: readonly DefinitionVar[];
  readonly inputs: readonly DefinitionVar[];
  readonly objects: readonly DefinitionVar[];
  readonly unions: readonly DefinitionVar[];
  readonly graph: readonly DefinitionVar[];
  readonly typeNames: readonly DefinitionVar[];
};
```

The `generateDefsStructure` function already iterates over categories dynamically. Just update the `categories` array and `importPaths`.

**Note**: `graph.ts` and `type-names.ts` are single-export files (one consolidated object), so they don't need the chunk/variable-per-type pattern. They can use `generateDefinitionFile` directly.

### 2.4 ~~`_defs/graph.ts`~~ — NOT GENERATED

Per Section 2.0, `_defs/graph.ts` is **not generated**. The existing `_defs/objects.ts` (with `{ spec, arguments }` format) is reused for MinimalSchema via type cast in `_internal.ts`. This avoids duplicating object type data.

### 2.5 New `_defs/type-names.ts` output format

```typescript
/**
 * type-names definitions
 * @generated by @soda-gql/tools/codegen
 */
export const typeNames_default = {
  scalar: ["BigInt", "Boolean", "DateTime", "Float", "ID", "Int", "JSON", "String"],
  enum: ["CacheScope", "EmployeeRole", "LogLevel", "ProjectStatus", "SortOrder", "TaskPriority"],
  input: ["BigIntFilter", "BooleanFilter", "CreateProjectInput", /* ... */],
} as const;
```

### 2.6 Updated `_internal.ts` output format

See section 2.2 above for the full template. Key differences from current:

1. `createVarMethodFactory` call and `inputTypeMethods_*` block removed
2. `inputTypeMethods` option removed from `createGqlElementComposer` call
3. Two schema objects: `fullSchema_${name}` (AnyGraphqlSchema) and `minimalSchema_${name}` (MinimalSchema)
4. New exports: `__fullSchema_${name}` alongside `__schema_${name}`
5. `__inputTypeMethods_${name}` export removed

### 2.7 Fixture catalog updates

**Files to update:**
- `fixture-catalog/graphql-system/_defs/objects.ts` — unchanged (still needed for full schema)
- `fixture-catalog/graphql-system/_defs/enums.ts` — unchanged
- `fixture-catalog/graphql-system/_defs/inputs.ts` — unchanged
- `fixture-catalog/graphql-system/_defs/unions.ts` — unchanged

**Files to ADD:**
- `fixture-catalog/graphql-system/_defs/type-names.ts` — MinimalSchema typeNames
- ~~`_defs/graph.ts`~~ — NOT generated (see Section 2.4)

**Files to update:**
- `fixture-catalog/graphql-system/_internal.ts` — dual schema assembly, remove inputTypeMethods

---

## Step 3: Typegen Changes

### 3.1 `packages/builder/src/schema-loader.ts`

**Change how schemas are loaded for typegen:**

Current flow: `loadSchemasFromBundle` → `gql.${name}.$schema` → `AnyGraphqlSchema`.

After MinimalSchema, `$schema` is `MinimalSchema` (no scalar/enum/input typed definitions). Typegen needs `AnyGraphqlSchema`.

**Add `loadFullSchemasFromBundle` function:**

```typescript
export const loadFullSchemasFromBundle = (
  cjsPath: string,
  schemaNames: readonly string[],
): LoadSchemasResult => {
  // Same sandbox execution as loadSchemasFromBundle
  // But access __fullSchema_* exports directly instead of gql.$schema
  const resolvedPath = resolve(cjsPath);
  // ... (file existence check, read, sandbox execution — same as existing)

  const schemas: Record<string, AnyGraphqlSchema> = {};
  for (const name of schemaNames) {
    const fullSchemaKey = `__fullSchema_${name}`;
    const schema = finalExports[fullSchemaKey];
    if (!schema || typeof schema !== "object") {
      return err({ ... });
    }
    schemas[name] = schema as AnyGraphqlSchema;
  }
  return ok(schemas);
};
```

**Note**: `finalExports` from `executeSandbox` contains ALL exports from the CJS bundle (including `__fullSchema_*`). The `__fullSchema_*` exports are top-level exports in `_internal.ts`, so they're available in `finalExports` directly.

### 3.1a `packages/builder/src/index.ts` (barrel export)

**Add `loadFullSchemasFromBundle` to the barrel export:**

```typescript
// BEFORE (line 47):
export { type LoadSchemasResult, loadSchemasFromBundle } from "./schema-loader";

// AFTER:
export { type LoadSchemasResult, loadSchemasFromBundle, loadFullSchemasFromBundle } from "./schema-loader";
```

Without this, `packages/tools/src/typegen/runner.ts` cannot import `loadFullSchemasFromBundle` from `@soda-gql/builder`.

### 3.2 `packages/tools/src/typegen/runner.ts`

**Change schema loading call:**

```typescript
// BEFORE (line 113):
const schemasResult = loadSchemasFromBundle(cjsPath, schemaNames);

// AFTER:
const schemasResult = loadFullSchemasFromBundle(cjsPath, schemaNames);
```

Import `loadFullSchemasFromBundle` instead of (or in addition to) `loadSchemasFromBundle`.

### 3.3 `packages/tools/src/typegen/emitter.ts`

#### Add `varTypes` and `fields` to `PrebuiltOperationEntry`

```typescript
// BEFORE:
type PrebuiltOperationEntry = {
  readonly key: string;
  readonly inputType: string;
  readonly outputType: string;
};

// AFTER:
type PrebuiltOperationEntry = {
  readonly key: string;
  readonly inputType: string;
  readonly outputType: string;
  readonly varTypes: string;   // NEW
  readonly fields: string;     // NEW
};
```

#### Add `generateVarTypes` function

```typescript
/**
 * Generate varTypes type string for an operation.
 * Maps each variable to its resolved TypeScript input type.
 */
const generateVarTypes = (
  schema: AnyGraphqlSchema,
  variableDefinitions: readonly VariableDefinitionNode[],
  formatters: TypeFormatters,
): string => {
  if (variableDefinitions.length === 0) {
    return "{}";
  }

  const entries = variableDefinitions.map((varDef) => {
    const varName = varDef.variable.name.value;
    const typeString = generateInputTypeFromSingleVarDef(schema, varDef, { formatters });
    return `readonly ${varName}: ${typeString}`;
  });

  return `{\n    ${entries.join(";\n    ")};\n  }`;
};
```

**Note**: `generateInputTypeFromSingleVarDef` may need to be added or extracted from `generateInputType`/`generateInputTypeFromVarDefs`. The existing `generateInputType` handles the full variable set; we need per-variable type resolution.

Alternatively, reuse existing `generateInputType` logic:
```typescript
const generateVarTypes = (
  schema: AnyGraphqlSchema,
  variableDefinitions: readonly VariableDefinitionNode[],
  formatters: TypeFormatters,
): string => {
  if (variableDefinitions.length === 0) return "{}";

  const entries: string[] = [];
  for (const varDef of variableDefinitions) {
    const name = varDef.variable.name.value;
    // Use parseTypeReference + resolveInputTypeString (internal helpers in type-calculator)
    const typeStr = generateSingleVarType(schema, varDef.type, formatters);
    entries.push(`readonly ${name}: ${typeStr}`);
  }
  return `{\n    ${entries.join(";\n    ")};\n  }`;
};
```

The exact implementation depends on what's exported from `@soda-gql/core`'s type-calculator module. `generateInputType` already handles variable type resolution; we need a per-variable version.

#### Add `generateFieldsMap` function

**IMPORTANT**: The `FieldSelectionsMap` from `extractFieldSelections` provides `AnyFieldsExtended` — alias-keyed maps where each value is an `AnyFieldSelection` with the structure:

```typescript
type AnyFieldSelection = {
  readonly parent: string;       // parent type name
  readonly field: string;        // REAL field name (may differ from alias key)
  readonly type: { spec: string; arguments?: InputTypeSpecifiers };
  readonly args: AnyAssignableInput;
  readonly directives: AnyDirectiveAttachments;
  readonly object: AnyNestedObjectExtended | null;  // nested object fields (alias-keyed)
  readonly union: { selections: AnyNestedUnion; __typename: boolean } | null;
};
```

The traversal must:
- Use `selection.field` for the real field name (not the alias key)
- Recurse into `selection.object` for nested object fields
- Recurse into `selection.union.selections[memberName]` for union member fields
- Skip `__typename` entries (they are implicit)
- Use `selection.type.spec` to determine return type kind

Reference: `type-calculator.ts`'s `calculateFieldsType` traverses the same structure correctly and can be used as a model.

```typescript
const generateFieldsMap = (
  schema: AnyGraphqlSchema,
  fields: AnyFieldsExtended,
  rootTypeName: string,
  formatters: TypeFormatters,
): string => {
  const typeMap = new Map<string, Map<string, { args: string; returns: string | null }>>();

  const walkFields = (fieldsObj: AnyFieldsExtended, parentTypeName: string) => {
    if (!typeMap.has(parentTypeName)) {
      typeMap.set(parentTypeName, new Map());
    }
    const typeFields = typeMap.get(parentTypeName)!;

    for (const [alias, fieldValue] of Object.entries(fieldsObj)) {
      // Skip shorthand (true) values — they don't carry type info
      if (fieldValue === true) continue;

      const selection = fieldValue as AnyFieldSelection;
      const realFieldName = selection.field;

      // Skip __typename
      if (realFieldName === "__typename") continue;

      // Parse spec for return type
      const specStr = typeof selection.type === "string" ? selection.type : selection.type.spec;
      const parsed = parseOutputSpecifier(specStr);

      // Get argument types from schema (not from selection)
      const objectDef = schema.object[parentTypeName];
      const fieldDef = objectDef?.fields?.[realFieldName];
      const argDefs = typeof fieldDef === "object" && fieldDef !== null && "arguments" in fieldDef
        ? fieldDef.arguments
        : {};
      const argsType = Object.keys(argDefs).length === 0
        ? "never"
        : generateArgsType(schema, argDefs, formatters);

      const returnsType = parsed.kind === "object" || parsed.kind === "union"
        ? `"${parsed.name}"`
        : "null";

      typeFields.set(realFieldName, { args: argsType, returns: returnsType });

      // Recurse into nested object selections
      if (selection.object && parsed.kind === "object") {
        walkFields(selection.object as AnyFieldsExtended, parsed.name);
      }

      // Recurse into union member selections
      if (selection.union && parsed.kind === "union") {
        for (const [memberName, memberFields] of Object.entries(selection.union.selections)) {
          if (memberFields) {
            walkFields(memberFields as AnyFieldsExtended, memberName);
          }
        }
      }
    }
  };

  walkFields(fields, rootTypeName);

  // ... render typeMap to string (same as before)
};
```

#### Update `groupBySchema` to populate `varTypes` and `fields`

In the operation branch (~line 172):

```typescript
// After existing inputType and outputType generation:
const varTypesType = generateVarTypes(schema, selection.variableDefinitions, inputFormatters);
const fieldsMapType = generateFieldsMap(schema, selection, inputFormatters);

group.operations.push({
  key: selection.operationName,
  inputType,
  outputType,
  varTypes: varTypesType,     // NEW
  fields: fieldsMapType,      // NEW
});
```

#### Update `generateTypesCode` template

Change the operation entry template (~line 413):

```typescript
// BEFORE:
.map((o) => `    readonly "${o.key}": { readonly input: ${o.inputType}; readonly output: ${o.outputType} };`);

// AFTER:
.map((o) => `    readonly "${o.key}": { readonly input: ${o.inputType}; readonly output: ${o.outputType}; readonly varTypes: ${o.varTypes}; readonly fields: ${o.fields} };`);
```

### 3.4 `packages/core/src/prebuilt/types.ts`

Add optional `varTypes` and `fields` to `PrebuiltTypeRegistry` operation entry:

```typescript
// In PrebuiltTypeRegistry type:
readonly operations: {
  readonly [key: string]: {
    readonly input: object;
    readonly output: object;
    readonly varTypes?: unknown;   // NEW: optional for backward compat
    readonly fields?: unknown;     // NEW: optional for backward compat
  };
};
```

### 3.5 Fixture catalog update

Update `fixture-catalog/graphql-system/types.prebuilt.ts` to include `varTypes` and `fields` entries for each operation.

---

## Step 7: Formatter Changes

### 7.1 `packages/tools/src/formatter/detection.ts`

**No changes needed.** The `isFieldSelectionObject` function checks for `f` in destructured parameters `({ f })`. After `f.fieldName()` → `f("fieldName")`, `f` is still present in `{ f, $ }` destructuring. Detection logic is syntax-agnostic.

### 7.2 `packages/tools/src/formatter/format.ts`

**New formatting rules to add:**

1. **Template literal enforcement for `variables` in options objects**: When the formatter encounters `variables: "..."` (regular string literal), it should either:
   - Flag as a warning/error, OR
   - Convert to template literal: `variables: \`...\``

   Implementation: In the traversal, detect `variables` property in operation options objects. Check if the value is a `StringLiteral` vs `TemplateLiteral`. This requires detecting the options object path: `query("Name")({ variables: ... })`.

2. **2+ items = forced line break rule**: This is already partially implemented for field selection objects. Extend to:
   - Variables in tagged templates: if 2+ variable declarations, force multiline
   - Fields in tagged templates: if 2+ root fields, force multiline (already done)
   - Fields in options object callback: same as current field selection formatting

**Detection of options object path:**
The formatter currently only handles field selection objects (`({ f }) => ({ ... })`). The options object path `query("Name")({ variables: ..., fields: ... })` is a different AST shape — it's a direct object expression passed to a function call, not a field selection object.

For this RFC, the formatter changes are minimal:
- The existing field selection object formatting continues to work for `fields: ({ f, $ }) => ({ ... })` callbacks
- Template literal enforcement can be a lint rule rather than formatter rule (implementation detail)

**Recommended approach**: Defer complex formatter changes to a follow-up. The core formatter (field selection newline insertion) works unchanged. Template literal enforcement and variable line break rules are nice-to-haves that can be added incrementally.

### 7.3 Formatter test fixtures

All formatter fixtures that use `f.fieldName()` syntax need updating to `f("fieldName")`:

**Files to update:**
- `fixture-catalog/fixtures/formatting/valid/needs-format.ts`
- `fixture-catalog/fixtures/formatting/valid/already-formatted.ts`
- `fixture-catalog/fixtures/formatting/valid/config-arrays.ts`
- `fixture-catalog/fixtures/formatting/valid/multi-schema.ts`
- `fixture-catalog/fixtures/formatting/valid/multi-schema-formatted.ts`
- `fixture-catalog/fixtures/formatting/valid/mixed-syntax.ts`

These should also update `.operation()` calls to options object syntax and remove `$var`.

---

## Step 8: Mechanical Test/Fixture Rewrite Rules

### 8.1 `$var` Elimination Rules

**Pattern 1: Variable declaration**
```typescript
// BEFORE:
variables: { ...$var("id").ID("!"), ...$var("limit").Int("?") }

// AFTER (in options object):
variables: `($id: ID!, $limit: Int)`

// AFTER (in tagged template — already correct):
// Variables are inline in the template string
```

**Pattern 2: `$var.getNameAt` / `$var.getValueAt`**
```typescript
// BEFORE:
$var.getNameAt($.id, "some", "path")
$var.getValueAt($.id, "some", "path")

// AFTER:
getNameAt($.id, "some", "path")
getValueAt($.id, "some", "path")
// Import from "@soda-gql/core" or "../../src/composer/var-ref-tools"
```

**Pattern 3: `$var` in destructuring**
```typescript
// BEFORE:
gql.default(({ query, $var }) => ...)
gql.default(({ query, $var, $colocate }) => ...)

// AFTER:
gql.default(({ query }) => ...)
gql.default(({ query, $colocate }) => ...)
```

### 8.2 `f.fieldName()` → `f("fieldName")` Rules

**Pattern 1: Leaf field (no args)**
```typescript
// BEFORE:
...f.id(),
...f.name(),

// AFTER:
...f("id")(),
...f("name")(),
```

**Pattern 2: Field with arguments**
```typescript
// BEFORE:
...f.employee({ id: $.userId })(...)
...f.tasks({ completed: true, limit: $.taskLimit })(...)

// AFTER:
...f("employee", { id: $.userId })(...)
...f("tasks", { completed: true, limit: $.taskLimit })(...)
```

**Pattern 3: Field with alias**
```typescript
// BEFORE:
...f.employee(null, { alias: "emp" })(...)
...f.employee({ id: $.id }, { alias: "emp" })(...)

// AFTER:
...f("employee", null, { alias: "emp" })(...)
...f("employee", { id: $.id }, { alias: "emp" })(...)
```

**Pattern 4: Shorthand fields (no spread)**
```typescript
// BEFORE: (shorthand syntax already uses f.fieldName: true — NOT f.fieldName())
id: true,
name: true,

// AFTER: unchanged — shorthand is independent of f accessor
```

### 8.3 `.operation()` → Options Object Rules

**Pattern 1: Simple operation**
```typescript
// BEFORE:
query.operation({
  name: "GetEmployee",
  variables: { ...$var("id").ID("!") },
  fields: ({ f, $ }) => ({ ...f.employee({ id: $.id })(({ f }) => ({ ...f.id(), ...f.name() })) }),
})

// AFTER:
query("GetEmployee")({
  variables: `($id: ID!)`,
  fields: ({ f, $ }) => ({ ...f("employee", { id: $.id })(({ f }) => ({ ...f("id")(), ...f("name")() })) }),
})()
```

**Pattern 2: Operation with metadata**
```typescript
// BEFORE:
query.operation({
  name: "GetEmployee",
  variables: { ...$var("id").ID("!") },
  fields: ({ f, $ }) => ({ ... }),
  metadata: ({ $ }) => ({ ... }),
})

// AFTER:
query("GetEmployee")({
  variables: `($id: ID!)`,
  fields: ({ f, $ }) => ({ ... }),
})({
  metadata: ({ $ }) => ({ ... }),
})
```

**Pattern 3: Operation with transformDocument**
```typescript
// BEFORE:
query.operation({
  name: "GetEmployee",
  variables: { ...$var("id").ID("!") },
  fields: ({ f, $ }) => ({ ... }),
  transformDocument: (doc) => transform(doc),
})

// AFTER:
query("GetEmployee")({
  variables: `($id: ID!)`,
  fields: ({ f, $ }) => ({ ... }),
})({
  transformDocument: (doc) => transform(doc),
})
```

### 8.4 graphql-compat Emitter (`emitter.ts`)

**Major change**: The emitter switches from generating callback compat code (`query.compat({...})`) to tagged template compat code (`query.compat("Name")\`...\``). This aligns with the decision to delete callback compat (`createCompatComposer`) entirely.

The emitter already has access to the original GraphQL source (it parses `.graphql` files). Instead of transforming the AST into callback builder code, it now emits the GraphQL source directly as a tagged template:

```typescript
// BEFORE:
export const GetUsersCompat = gql.default(({ query, $var }) =>
  query.compat({
    name: "GetUsers",
    variables: { ...$var("limit").Int("!") },
    fields: ({ f, $ }) => ({ ...f.users({ limit: $.limit })(({ f }) => ({ ...f.id(), ...f.name() })) }),
  }),
);

// AFTER:
export const GetUsersCompat = gql.default(({ query }) =>
  query.compat("GetUsers")`($limit: Int!) { users(limit: $limit) { id name } }`,
);
```

**Changes to `emitOperation`:**
1. Remove `$var` from destructuring
2. Replace entire `.compat({...})` block with `.compat("Name")\`<graphql source>\``
3. The GraphQL source is the original parsed operation body (already available in the emitter's `EnrichedOperation`)
4. Delete `emitVariables`, `emitFieldSelection`, and related functions that constructed callback builder code

**Changes to `emitFragment`:**
Similarly, fragment emission switches to tagged template format.

**Test updates:**
All emitter test expectations must be updated to match the new tagged template output format. This significantly simplifies the emitter tests since the output is just the GraphQL source wrapped in a tagged template.

**Benefit**: This dramatically simplifies the emitter — it no longer needs to transform GraphQL AST into callback builder syntax. The transformation is now just "wrap the GraphQL source in a tagged template call".

For the emitter:
```typescript
// Leaf field (no args, no selections):
// BEFORE: ...f.name(),
// AFTER:  ...f("name")(),

// Field with args and selections:
// BEFORE: ...f.employee({ id: $.id })(({ f }) => ({ ... })),
// AFTER:  ...f("employee", { id: $.id })(({ f }) => ({ ... })),
```

Updated `emitFieldSelection`:
```typescript
// BEFORE:
let line = `${padding}...f.${field.name}(`;

// AFTER:
let line = `${padding}...f(${JSON.stringify(field.name)}`;
if (hasArgs) {
  line += `, ${argsResult.value}`;
}
if (field.alias) {
  if (!hasArgs) line += `, null`;
  line += `, { alias: ${JSON.stringify(field.alias)} }`;
}
line += ")(";  // close f() call, open result call

// For nested selections:
if (hasSelections) {
  line += "({ f }) => ({\n";
  // ... nested fields ...
  line += `${padding}}))`;  // close callback, close result call
} else {
  line += ")";  // close result call (leaf field)
}
```

Wait, looking at the existing emitter more carefully. The current output is:
```typescript
...f.employee({ id: $.id })(({ f }) => ({ ... })),
```

Which means `f.employee(args)` returns a function, and that function is called with a callback. After reform:
```typescript
...f("employee", { id: $.id })(({ f }) => ({ ... })),
```

So the structure is the same — just the initial accessor changes from property to function call. The emitter changes are:

```typescript
// Line 347, BEFORE:
let line = `${padding}...f.${field.name}(`;
// ... args handling ...
line += ")";  // close f.fieldName(args) call

// AFTER:
let line = `${padding}...f(${JSON.stringify(field.name)}`;
if (hasArgs) {
  const argsResult = emitArguments(...);
  line += `, ${argsResult.value}`;
}
if (field.alias) {
  if (!hasArgs) line += `, null`;
  line += `, { alias: ${JSON.stringify(field.alias)} }`;
}
line += ")";  // close f(fieldName, args) call
```

The rest of the nested selection handling stays the same.

### 8.5 Test Files — Scope of Changes

Total files requiring mechanical rewrite:

| Category | Files | Key patterns |
|----------|-------|-------------|
| Core unit tests | ~8 files | `$var` + `f.field()` + `.operation()` |
| Core integration tests | ~8 files | `$var` + `f.field()` + `.operation()` |
| Core type tests | ~13 files | `$var` + `f.field()` + `.operation()` |
| Builder integration tests | ~3 files | `$var` + `f.field()` + `.operation()` |
| SDK tests | 1 file | `$var` + `f.field()` + `.operation()` |
| Codegen emitter tests | 2 files | Expected output has `$var` + `f.field()` |
| Formatter tests | 2 files + fixtures | `f.field()` + `.operation()` |
| Fixture catalog | ~20 files | Various |
| Core test fixtures | ~5 files | `createVarMethodFactory` + `inputTypeMethods` |

**Files to DELETE:**
- `packages/core/test/types/variable-builder.test.ts` — tests `$var()` API directly
- `packages/core/test/fixtures/input-type-methods.ts` — `createVarMethodFactory` fixture

### 8.6 Recommended Rewrite Order

See `plan-core.md` "Implementation Order (Cross-Plan, Single PR)" for the full dependency graph.

Within this plan's scope:

1. **Step 2: Codegen** — add `_defs/type-names.ts` generation, update `_internal.ts` dual assembly, remove `inputTypeMethods`
2. **Step 3: Typegen** — add `loadFullSchemasFromBundle` + barrel export, add `varTypes`/`fields` generation
3. **Step 8.4: graphql-compat emitter** — switch to tagged template compat output
4. **Fixture catalog rewrite** — update all fixture files for new syntax
5. **Step 7: Formatter** — update formatter detection and test fixtures
6. **Step 8: Test mechanical rewrite** — apply patterns from 8.1-8.3 across all test files
7. **Delete obsolete files** — var-builder.test.ts, input-type-methods.ts, compat.test.ts callback tests

---

## Risk Assessment

### Risk 1: `__fullSchema_*` export adds bundle size

**Mitigation**: The CJS bundle is dev-only (not shipped to production). `treeShaking: false` already includes everything. Adding `__fullSchema_*` is zero cost.

### Risk 2: Dual schema assembly complexity in `_internal.ts`

**Mitigation**: The full schema assembly is the existing code (unchanged). The MinimalSchema assembly is new but simple — just object/union/typeNames references. The two are independent.

### Risk 3: `generateFieldsMap` needs field selection data from builder

**Mitigation**: The `FieldSelectionsMap` from `extractFieldSelections` already contains `fields` (the nested selection map) and `variableDefinitions`. The typegen emitter has access to this data in `groupBySchema`. No new data flow needed.

### Risk 4: Formatter test fixtures use callback builder syntax

Per memory: "Formatting fixtures must stay as callback builders." After this RFC, callback builders use `f("field")` syntax. Fixtures need syntax update but remain callback-builder style.

### Risk 5: graphql-compat emitter migration

**Resolved**: The emitter now generates tagged template compat code (`query.compat("Name")\`...\``) instead of callback compat code. This eliminates all `$var` and `f.fieldName` references in emitter output. The emitter is significantly simplified — it wraps original GraphQL source in tagged template calls rather than transforming AST into callback builder syntax. Callback compat (`createCompatComposer`) is deleted entirely.

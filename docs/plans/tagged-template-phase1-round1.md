# Phase 1 Round 1: Shared GraphQL Analysis Infrastructure

## Purpose

Establish shared GraphQL analysis infrastructure in `packages/core/src/graphql/`. This round moves and consolidates GraphQL parsing, transformation, and preprocessing utilities from `packages/codegen/` and `packages/lsp/` into `packages/core/`, creating a canonical location for GraphQL analysis code that both the tagged template API and existing codegen pipeline can share.

**Parent plan**: [Phase 1 Implementation Plan](./tagged-template-unification-phase1.md)
**Implementation strategy**: [Tagged Template Unification Strategy](./tagged-template-unification.md)

## Prerequisites

- Clean git status (`git status` shows no uncommitted changes)
- All tests pass: `bun run test`
- Quality checks pass: `bun quality`

## Scope

| Directory | Status | Description |
|-----------|--------|-------------|
| `packages/core/src/graphql/` | **New** | All files created in this round |
| `packages/codegen/src/graphql-compat/` | **Read-only** | Source of parser + transformer logic (not modified in this round) |
| `packages/lsp/src/` | **Read-only** | Source of fragment args preprocessor (not modified in this round) |

No existing files are modified. All 5 tasks produce new files in `packages/core/src/graphql/`.

---

## Shared Context

The following types, patterns, and conventions are referenced across multiple tasks. They are included inline so this document survives context compaction.

### VarSpecifier type

From `packages/core/src/composer/var-builder.ts` (lines 48-64):

```typescript
export type GenericVarSpecifier<
  TKind extends CreatableInputTypeKind,
  TTypeName extends string,
  TModifier extends TypeModifier,
  TDefaultFn extends (() => unknown) | null,
  TDirectives extends AnyConstDirectiveAttachments,
> = {
  kind: TKind;
  name: TTypeName;
  modifier: TModifier;
  defaultValue: TDefaultFn extends null
    ? null
    : {
        default: ReturnType<NonNullable<TDefaultFn>>;
      };
  directives: TDirectives;
};
```

The runtime shape (what `var-specifier-builder.ts` in Task 1.4 must produce) is:

```typescript
{
  kind: "scalar" | "enum" | "input";
  name: string;       // e.g. "ID", "Status", "UserFilter"
  modifier: string;   // e.g. "!", "?", "![]!", "?[]?"
  defaultValue: null | { default: <value> };
  directives: {};
}
```

`CreatableInputTypeKind` is defined in `packages/core/src/types/type-foundation/type-specifier.ts` as `"scalar" | "enum" | "input"`.

`TypeModifier` is defined in `packages/core/src/types/type-foundation/type-modifier-core.generated.ts` as `string`.

### Error handling convention

- **Composer layer** (code executed inside VM sandbox within user callbacks): uses `throw new Error()` / try-catch. NOT neverthrow.
- **Parser utilities** (outside the composer layer): uses neverthrow `Result` types (`ok()`, `err()`).
- The new `packages/core/src/graphql/` files are parser utilities, so they use **neverthrow** Result types.
- Exception: `var-specifier-builder.ts` (Task 1.4) will be called from the composer layer, so it uses **throw** for errors.

### GraphqlCompatError type

From `packages/codegen/src/graphql-compat/types.ts` (lines 176-249). This is the error union used by parser and transformer. It must be moved/copied to the new `packages/core/src/graphql/` location:

```typescript
export type GraphqlCompatError =
  | { readonly code: "GRAPHQL_FILE_NOT_FOUND"; readonly message: string; readonly filePath: string }
  | { readonly code: "GRAPHQL_PARSE_ERROR"; readonly message: string; readonly filePath: string; readonly line?: number; readonly column?: number }
  | { readonly code: "GRAPHQL_INVALID_OPERATION"; readonly message: string; readonly operationName?: string }
  | { readonly code: "GRAPHQL_UNKNOWN_TYPE"; readonly message: string; readonly typeName: string }
  | { readonly code: "GRAPHQL_FRAGMENT_NOT_FOUND"; readonly message: string; readonly fragmentName: string }
  | { readonly code: "GRAPHQL_OUTPUT_ERROR"; readonly message: string; readonly outputPath: string }
  | { readonly code: "GRAPHQL_INLINE_FRAGMENT_ON_INTERFACE"; readonly message: string; readonly onType: string }
  | { readonly code: "GRAPHQL_UNDECLARED_VARIABLE"; readonly message: string; readonly variableName: string }
  | { readonly code: "GRAPHQL_INLINE_FRAGMENT_WITHOUT_TYPE"; readonly message: string }
  | { readonly code: "GRAPHQL_VARIABLE_TYPE_MISMATCH"; readonly message: string; readonly variableName: string }
  | { readonly code: "GRAPHQL_VARIABLE_MODIFIER_INCOMPATIBLE"; readonly message: string; readonly variableName: string }
  | { readonly code: "GRAPHQL_FRAGMENT_CIRCULAR_DEPENDENCY"; readonly message: string; readonly fragmentNames: readonly string[] }
  | { readonly code: "GRAPHQL_UNKNOWN_FIELD"; readonly message: string; readonly typeName: string; readonly fieldName: string }
  | { readonly code: "GRAPHQL_UNKNOWN_ARGUMENT"; readonly message: string; readonly fieldName: string; readonly argumentName: string };
```

### SchemaIndex type

From `packages/codegen/src/generator.ts` (lines 68-76). The transformer depends on this type. In Round 1, the transformer in `packages/core/src/graphql/` must define its own `SchemaIndex` type (or accept it as a generic parameter) rather than importing from codegen:

```typescript
type SchemaIndex = {
  readonly objects: Map<string, ObjectRecord>;
  readonly inputs: Map<string, InputRecord>;
  readonly enums: Map<string, EnumRecord>;
  readonly unions: Map<string, UnionRecord>;
  readonly scalars: Map<string, ScalarRecord>;
  readonly directives: Map<string, DirectiveRecord>;
  readonly operationTypes: OperationTypeNames;
};
```

Where the record types are:

```typescript
type ObjectRecord = { readonly name: string; readonly fields: Map<string, FieldDefinitionNode>; directives: ConstDirectiveNode[] };
type InputRecord = { readonly name: string; readonly fields: Map<string, InputValueDefinitionNode>; directives: ConstDirectiveNode[] };
type EnumRecord = { readonly name: string; readonly values: Map<string, EnumValueDefinitionNode>; directives: ConstDirectiveNode[] };
type UnionRecord = { readonly name: string; readonly members: Map<string, NamedTypeNode>; directives: ConstDirectiveNode[] };
type ScalarRecord = { readonly name: string; directives: ConstDirectiveNode[] };
type DirectiveRecord = { readonly name: string; readonly locations: readonly string[]; readonly args: Map<string, InputValueDefinitionNode>; readonly isRepeatable: boolean };
type OperationTypeNames = { query?: string; mutation?: string; subscription?: string };
```

### Test pattern

Bun test, `describe`/`it` structure, colocated test files (`.test.ts` beside source). Example from existing codebase (`packages/codegen/src/graphql-compat/parser.test.ts`):

```typescript
import { describe, expect, it } from "bun:test";
import { parseGraphqlSource, parseTypeNode } from "./parser";

describe("parseTypeNode", () => {
  it("parses simple nullable type: ID -> ?", () => {
    const result = parseTypeNode(makeNamedType("ID"));
    expect(result).toEqual({ typeName: "ID", modifier: "?" });
  });
});

describe("parseGraphqlSource", () => {
  it("parses a simple query", () => {
    const source = `query GetUser { user { id name } }`;
    const result = parseGraphqlSource(source, "test.graphql");
    expect(result.isOk()).toBe(true);
    const { operations } = result._unsafeUnwrap();
    expect(operations).toHaveLength(1);
  });
});
```

---

## Tasks

### Task 1.1: GraphQL Parser Utilities

Move core parsing logic from `packages/codegen/src/graphql-compat/parser.ts` (306 lines) and types from `packages/codegen/src/graphql-compat/types.ts` (250 lines) into `packages/core/src/graphql/`.

**Commit message**: `feat(core): add GraphQL parser utilities to shared graphql module`

#### Files

| File | Action | Rationale |
|------|--------|-----------|
| `packages/core/src/graphql/types.ts` | Create | Shared type definitions used by parser, transformer, and var-specifier-builder |
| `packages/core/src/graphql/parser.ts` | Create | Core GraphQL parsing: `parseGraphqlSource`, `parseTypeNode`, and AST traversal helpers |
| `packages/core/src/graphql/parser.test.ts` | Create | Colocated unit tests for parser |

#### Type signatures

**`packages/core/src/graphql/types.ts`** -- Move these types from `packages/codegen/src/graphql-compat/types.ts`:

```typescript
// Domain types (move as-is, drop GraphqlCompatOptions and GeneratedFile which are codegen-specific)
export type ParsedOperation = { readonly kind: "query" | "mutation" | "subscription"; readonly name: string; readonly variables: readonly ParsedVariable[]; readonly selections: readonly ParsedSelection[]; readonly sourceFile: string };
export type ParsedFragment = { readonly name: string; readonly onType: string; readonly selections: readonly ParsedSelection[]; readonly sourceFile: string };
export type TypeInfo = { readonly typeName: string; readonly modifier: string };
export type InferredVariable = { readonly name: string; readonly typeName: string; readonly modifier: string; readonly typeKind: "scalar" | "enum" | "input" };
export type ParsedVariable = { readonly name: string; readonly typeName: string; readonly modifier: string; readonly typeKind: "scalar" | "enum" | "input"; readonly defaultValue?: ParsedValue };
export type ParsedSelection = ParsedFieldSelection | ParsedFragmentSpread | ParsedInlineFragment;
export type ParsedFieldSelection = { readonly kind: "field"; readonly name: string; readonly alias?: string; readonly arguments?: readonly ParsedArgument[]; readonly selections?: readonly ParsedSelection[] };
export type ParsedFragmentSpread = { readonly kind: "fragmentSpread"; readonly name: string };
export type ParsedInlineFragment = { readonly kind: "inlineFragment"; readonly onType: string; readonly selections: readonly ParsedSelection[] };
export type ParsedArgument = { readonly name: string; readonly value: ParsedValue };
export type ParsedValue = /* 9-variant union, same as original */;
export type ParsedObjectField = { readonly name: string; readonly value: ParsedValue };
export type ParseResult = { readonly operations: readonly ParsedOperation[]; readonly fragments: readonly ParsedFragment[] };

// Error type -- same union as codegen, renamed for clarity
export type GraphqlAnalysisError = /* same 14-variant union as GraphqlCompatError */;
```

**`packages/core/src/graphql/parser.ts`** -- Public API:

```typescript
import type { TypeNode } from "graphql";
import type { Result } from "neverthrow";
import type { GraphqlAnalysisError, ParseResult, TypeInfo } from "./types";

/** Parse GraphQL source string directly. No file I/O. */
export const parseGraphqlSource = (
  source: string,
  sourceFile: string,
): Result<ParseResult, GraphqlAnalysisError>;

/** Parse a GraphQL TypeNode into type name and modifier. */
export const parseTypeNode = (node: TypeNode): TypeInfo;
```

#### Implementation pattern

Copy the functions from `packages/codegen/src/graphql-compat/parser.ts` with these changes:

1. **Remove `parseGraphqlFile`** -- it uses `fs` and `path` and is file-I/O specific. Only `parseGraphqlSource` is needed.
2. **Remove `import { existsSync, readFileSync } from "node:fs"` and `import { resolve } from "node:path"`** -- no file I/O.
3. **Import types from local `./types`** instead of `./types` in codegen.
4. **Rename error type reference**: `GraphqlCompatError` to `GraphqlAnalysisError`.
5. **Keep all internal functions**: `extractFromDocument`, `extractOperation`, `extractFragment`, `extractVariable`, `parseTypeNode`, `extractSelections`, `extractSelection`, `extractFieldSelection`, `extractFragmentSpread`, `extractInlineFragment`, `extractArgument`, `extractValue`, `assertUnreachable`.

Key code example for `parseGraphqlSource`:

```typescript
export const parseGraphqlSource = (source: string, sourceFile: string): Result<ParseResult, GraphqlAnalysisError> => {
  try {
    const document = parse(source);
    return ok(extractFromDocument(document, sourceFile));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return err({
      code: "GRAPHQL_PARSE_ERROR",
      message: `GraphQL parse error: ${message}`,
      filePath: sourceFile,
    });
  }
};
```

#### Dependencies

- **Requires**: `graphql` package (already a dependency of `@soda-gql/core`), `neverthrow`
- **Produces**: `parseGraphqlSource`, `parseTypeNode`, and all parsed types consumed by Tasks 1.2, 1.4, and 1.5

#### Validation

```bash
bun run test packages/core/src/graphql/parser.test.ts
```

Expected: All tests pass. Tests should cover:
- `parseTypeNode` with all modifier combinations (nullable, non-null, lists, nested lists) -- 7 cases
- `parseGraphqlSource` for operations (query, mutation, subscription, variables, arguments, nested selections) -- 10+ cases
- `parseGraphqlSource` for fragments (definition, spread, inline fragment) -- 3+ cases
- Error handling (invalid syntax) -- 1+ case
- Complex values (enum, list, object, null) -- 4+ cases

Port tests from `packages/codegen/src/graphql-compat/parser.test.ts` (474 lines) with import path adjustments.

#### Subagent eligibility

**Eligible** -- No dependencies on other Round 1 tasks. Self-contained copy+adapt from codegen with type rename.

---

### Task 1.2: GraphQL Transformer Utilities

Move schema enrichment logic from `packages/codegen/src/graphql-compat/transformer.ts` (817 lines) into `packages/core/src/graphql/`.

**Commit message**: `feat(core): add GraphQL transformer utilities to shared graphql module`

#### Files

| File | Action | Rationale |
|------|--------|-----------|
| `packages/core/src/graphql/schema-index.ts` | Create | SchemaIndex type and `createSchemaIndex` factory, extracted from `packages/codegen/src/generator.ts` |
| `packages/core/src/graphql/transformer.ts` | Create | Schema enrichment: variable inference, modifier merging, fragment dependency sorting |
| `packages/core/src/graphql/transformer.test.ts` | Create | Colocated unit tests |

#### Type signatures

**`packages/core/src/graphql/schema-index.ts`** -- Extract from `packages/codegen/src/generator.ts`:

```typescript
import type {
  ConstDirectiveNode,
  DocumentNode,
  EnumValueDefinitionNode,
  FieldDefinitionNode,
  InputValueDefinitionNode,
  NamedTypeNode,
} from "graphql";

export type OperationTypeNames = { query?: string; mutation?: string; subscription?: string };
export type ObjectRecord = { readonly name: string; readonly fields: Map<string, FieldDefinitionNode>; directives: ConstDirectiveNode[] };
export type InputRecord = { readonly name: string; readonly fields: Map<string, InputValueDefinitionNode>; directives: ConstDirectiveNode[] };
export type EnumRecord = { readonly name: string; readonly values: Map<string, EnumValueDefinitionNode>; directives: ConstDirectiveNode[] };
export type UnionRecord = { readonly name: string; readonly members: Map<string, NamedTypeNode>; directives: ConstDirectiveNode[] };
export type ScalarRecord = { readonly name: string; directives: ConstDirectiveNode[] };
export type DirectiveRecord = { readonly name: string; readonly locations: readonly string[]; readonly args: Map<string, InputValueDefinitionNode>; readonly isRepeatable: boolean };

export type SchemaIndex = {
  readonly objects: Map<string, ObjectRecord>;
  readonly inputs: Map<string, InputRecord>;
  readonly enums: Map<string, EnumRecord>;
  readonly unions: Map<string, UnionRecord>;
  readonly scalars: Map<string, ScalarRecord>;
  readonly directives: Map<string, DirectiveRecord>;
  readonly operationTypes: OperationTypeNames;
};

/** Build a schema index from a parsed GraphQL schema document. */
export const createSchemaIndex = (document: DocumentNode): SchemaIndex;
```

**`packages/core/src/graphql/transformer.ts`** -- Public API:

```typescript
import type { Result } from "neverthrow";
import type { SchemaIndex } from "./schema-index";
import type { GraphqlAnalysisError, InferredVariable, ParsedFragment, ParsedSelection, ParseResult, TypeInfo } from "./types";

// Modifier utilities
export const isModifierAssignable = (source: string, target: string): boolean;
export const mergeModifiers = (a: string, b: string): { ok: true; value: string } | { ok: false; reason: string };

// Schema lookups
export const getArgumentType = (schema: SchemaIndex, parentTypeName: string, fieldName: string, argumentName: string): TypeInfo | null;
export const getInputFieldType = (schema: SchemaIndex, inputTypeName: string, fieldName: string): TypeInfo | null;
export const getFieldReturnType = (schema: SchemaIndex, parentTypeName: string, fieldName: string): string | null;

// Variable inference
export const collectVariableUsages = (selections: readonly ParsedSelection[], parentTypeName: string, schema: SchemaIndex): Result<VariableUsage[], GraphqlAnalysisError>;
export const mergeVariableUsages = (variableName: string, usages: readonly VariableUsage[]): Result<InferredVariable, GraphqlAnalysisError>;
export const inferVariablesFromUsages = (usages: readonly VariableUsage[]): Result<InferredVariable[], GraphqlAnalysisError>;

// Fragment dependency sorting
export const sortFragmentsByDependency = (fragments: readonly ParsedFragment[]): Result<ParsedFragment[], GraphqlAnalysisError>;

// Full transformation pipeline
export const transformParsedGraphql = (parsed: ParseResult, options: TransformOptions): Result<TransformResult, GraphqlAnalysisError>;

// Exported types
export type VariableUsage = { readonly name: string; readonly typeName: string; readonly expectedModifier: string; readonly minimumModifier: string; readonly typeKind: "scalar" | "enum" | "input" };
export type EnrichedOperation = Omit<ParsedOperation, "variables"> & { readonly variables: readonly EnrichedVariable[]; readonly fragmentDependencies: readonly string[] };
export type EnrichedFragment = ParsedFragment & { readonly fragmentDependencies: readonly string[]; readonly variables: readonly InferredVariable[] };
export type EnrichedVariable = Omit<ParsedVariable, "typeKind"> & { readonly typeKind: "scalar" | "enum" | "input" };
export type TransformResult = { readonly operations: readonly EnrichedOperation[]; readonly fragments: readonly EnrichedFragment[] };
export type TransformOptions = { readonly schemaDocument: DocumentNode };
```

#### Implementation pattern

Copy the functions from `packages/codegen/src/graphql-compat/transformer.ts` with these changes:

1. **Replace `import { createSchemaIndex } from "../generator"` with `import { createSchemaIndex, type SchemaIndex } from "./schema-index"`**.
2. **Replace `type SchemaIndex = ReturnType<typeof createSchemaIndex>`** with the explicit import.
3. **Import `parseTypeNode` from `"./parser"`** (same relative path, new location).
4. **Import types from local `"./types"`**.
5. **Rename**: `GraphqlCompatError` to `GraphqlAnalysisError`.
6. **Move `createSchemaIndex`** and its record types into the new `schema-index.ts` file. This is an extraction from `packages/codegen/src/generator.ts` lines 18-300 approximately (the `createSchemaIndex` function, helper functions, and record types). The extraction includes: `ensureRecord`, `addObjectFields`, `addInputFields`, `addEnumValues`, `addUnionMembers`, `addDirectiveArgs`, `mergeDirectives`, `updateOperationTypes`, and `builtinScalarTypes` (only the scalar name Set, not the input/output mapping -- the codegen version maps to TS types which is not needed here).

Key code for `schema-index.ts` `builtinScalarTypes`:

```typescript
// Only the name set is needed; the codegen version maps to TS types which is codegen-specific
const builtinScalarTypes = new Set(["ID", "String", "Int", "Float", "Boolean"]);
```

Note: The `builtinScalarTypes` in `transformer.ts` (line 31 in the original) is the same Set. After extraction, `transformer.ts` should import or re-use the one from `schema-index.ts`, or keep its own local copy for simplicity. Keeping a local copy is simpler and avoids coupling.

#### Dependencies

- **Requires**: Task 1.1 (`parseTypeNode` import from `./parser`, types from `./types`)
- **Produces**: `transformParsedGraphql`, `SchemaIndex`, modifier utilities, variable inference -- consumed by Tasks 1.4, 1.5, and Round 2 tasks

#### Validation

```bash
bun run test packages/core/src/graphql/transformer.test.ts
```

Expected: All tests pass. Port tests from `packages/codegen/src/graphql-compat/transformer.test.ts` (1080 lines) with import path adjustments. Tests cover:
- `transformParsedGraphql`: variable type resolution (scalar, enum, input, custom scalar, unknown type error), fragment dependencies, fragment transformation, fragment variable inference, inline fragments
- `collectVariableUsages`: direct field arguments, nested input objects, multiple variables, error cases
- `mergeVariableUsages`: single usage, multiple usages, type mismatch, List Coercion
- `inferVariablesFromUsages`: basic inference, grouping/merging, sorting
- `sortFragmentsByDependency`: independent, dependent, chain, diamond, circular, self-reference, external
- `mergeModifiers`: simple, lists, nested lists, incompatible
- `isModifierAssignable`: same depth, List Coercion, invalid depths, complex nullability

Test needs `createSchemaIndex` from `./schema-index` (instead of `../generator`).

#### Subagent eligibility

**Eligible** -- Self-contained copy+adapt. Depends on Task 1.1 types at import level, but the types file content is fully specified in this document. If running in parallel with 1.1, the subagent can create the types it needs from the shared context above.

---

### Task 1.3: Fragment Arguments Preprocessor

Copy from `packages/lsp/src/fragment-args-preprocessor.ts` (131 lines). Pure algorithm, no changes needed.

**Commit message**: `feat(core): add fragment arguments preprocessor to shared graphql module`

#### Files

| File | Action | Rationale |
|------|--------|-----------|
| `packages/core/src/graphql/fragment-args-preprocessor.ts` | Create | Pure string preprocessing for Fragment Arguments RFC syntax |
| `packages/core/src/graphql/fragment-args-preprocessor.test.ts` | Create | Colocated unit tests |

#### Type signatures

```typescript
/** Result of fragment arguments preprocessing. */
export type PreprocessResult = {
  /** Content with Fragment Arguments syntax replaced by whitespace. */
  readonly preprocessed: string;
  /** Whether any preprocessing was applied. */
  readonly modified: boolean;
};

/**
 * Preprocess Fragment Arguments RFC syntax by replacing argument lists with spaces.
 *
 * Transforms:
 * - `fragment UserProfile($showEmail: Boolean = false) on User`
 *   -> `fragment UserProfile                               on User`
 * - `...UserProfile(showEmail: true)` -> `...UserProfile                  `
 */
export const preprocessFragmentArgs = (content: string): PreprocessResult;
```

#### Implementation pattern

Exact copy of `packages/lsp/src/fragment-args-preprocessor.ts`. No modifications needed. The file is a pure algorithm with no external dependencies (no imports).

Internal functions (all private):
- `findMatchingParen(content: string, openIndex: number): number` -- balanced paren matching
- `replaceWithSpaces(content: string, start: number, end: number): string` -- whitespace replacement preserving newlines
- `FRAGMENT_DEF_PATTERN` regex -- matches `fragment Name(`
- `FRAGMENT_SPREAD_PATTERN` regex -- matches `...FragmentName(`

The algorithm does two passes:
1. Fragment definition arguments: match `fragment Name(`, find matching `)`, verify followed by `on`, replace with spaces
2. Fragment spread arguments: match `...FragmentName(`, find matching `)`, replace with spaces

#### Dependencies

- **Requires**: Nothing (zero dependencies)
- **Produces**: `preprocessFragmentArgs` -- consumed by Round 2 tagged template implementation

#### Validation

```bash
bun run test packages/core/src/graphql/fragment-args-preprocessor.test.ts
```

Expected: All tests pass. Port tests from `packages/lsp/src/fragment-args-preprocessor.test.ts` (115 lines) with import path adjustments. Tests cover:
- No-op for standard GraphQL (no fragment arguments)
- Strips fragment definition arguments
- Strips fragment spread arguments
- Preserves line/column alignment
- Handles nested parens in default values
- Handles multiple fragments
- Handles fragment with multiple arguments
- Does not strip field arguments
- Does not strip directive arguments

#### Subagent eligibility

**Eligible** -- Zero dependencies. Pure copy operation with test port. No interaction with any other task.

---

### Task 1.4: VarSpecifier Builder from GraphQL AST

New file that converts `VariableDefinitionNode` from graphql-js AST into VarSpecifier objects compatible with the composer's `GenericVarSpecifier` type.

**Commit message**: `feat(core): add VarSpecifier builder for GraphQL AST variable definitions`

#### Files

| File | Action | Rationale |
|------|--------|-----------|
| `packages/core/src/graphql/var-specifier-builder.ts` | Create | Converts VariableDefinitionNode -> VarSpecifier, resolving kind from schema |
| `packages/core/src/graphql/var-specifier-builder.test.ts` | Create | Colocated unit tests |

#### Type signatures

```typescript
import type { DocumentNode, VariableDefinitionNode } from "graphql";
import type { SchemaIndex } from "./schema-index";

/**
 * Runtime VarSpecifier shape produced by this builder.
 * Compatible with GenericVarSpecifier from var-builder.ts.
 */
export type BuiltVarSpecifier = {
  readonly kind: "scalar" | "enum" | "input";
  readonly name: string;
  readonly modifier: string;
  readonly defaultValue: null | { readonly default: unknown };
  readonly directives: Record<string, never>;
};

/**
 * Convert a VariableDefinitionNode to a VarSpecifier.
 * Resolves `kind` (scalar/enum/input) from the schema index.
 *
 * @throws Error if type name cannot be resolved in schema
 */
export const buildVarSpecifier = (
  node: VariableDefinitionNode,
  schema: SchemaIndex,
): BuiltVarSpecifier;

/**
 * Convert all variable definitions from a list of VariableDefinitionNodes
 * into a record keyed by variable name.
 *
 * @throws Error if any type name cannot be resolved in schema
 */
export const buildVarSpecifiers = (
  nodes: readonly VariableDefinitionNode[],
  schema: SchemaIndex,
): Record<string, BuiltVarSpecifier>;
```

#### Implementation pattern

This is a **new file** (not a copy). It bridges the graphql-js AST with the composer's VarSpecifier type.

Key implementation:

```typescript
import { Kind, type VariableDefinitionNode } from "graphql";
import type { SchemaIndex } from "./schema-index";
import { parseTypeNode } from "./parser";

const builtinScalarTypes = new Set(["ID", "String", "Int", "Float", "Boolean"]);

const resolveTypeKind = (schema: SchemaIndex, typeName: string): "scalar" | "enum" | "input" => {
  if (builtinScalarTypes.has(typeName) || schema.scalars.has(typeName)) return "scalar";
  if (schema.enums.has(typeName)) return "enum";
  if (schema.inputs.has(typeName)) return "input";
  throw new Error(`Cannot resolve type kind for "${typeName}": not found in schema as scalar, enum, or input`);
};

const extractDefaultValue = (node: VariableDefinitionNode): null | { readonly default: unknown } => {
  if (!node.defaultValue) return null;
  return { default: extractConstValue(node.defaultValue) };
};

/**
 * Extract a constant value from a ValueNode (for default values).
 * Similar to graphql-js valueFromAST but without type coercion.
 */
const extractConstValue = (node: import("graphql").ValueNode): unknown => {
  switch (node.kind) {
    case Kind.INT: return Number.parseInt(node.value, 10);
    case Kind.FLOAT: return Number.parseFloat(node.value);
    case Kind.STRING: return node.value;
    case Kind.BOOLEAN: return node.value;
    case Kind.NULL: return null;
    case Kind.ENUM: return node.value;
    case Kind.LIST: return node.values.map(extractConstValue);
    case Kind.OBJECT: {
      const obj: Record<string, unknown> = {};
      for (const field of node.fields) {
        obj[field.name.value] = extractConstValue(field.value);
      }
      return obj;
    }
    case Kind.VARIABLE:
      throw new Error("Variable references are not allowed in default values");
    default:
      throw new Error(`Unexpected value kind: ${(node as { kind: string }).kind}`);
  }
};

export const buildVarSpecifier = (node: VariableDefinitionNode, schema: SchemaIndex): BuiltVarSpecifier => {
  const { typeName, modifier } = parseTypeNode(node.type);
  const kind = resolveTypeKind(schema, typeName);
  const defaultValue = extractDefaultValue(node);

  return { kind, name: typeName, modifier, defaultValue, directives: {} as Record<string, never> };
};

export const buildVarSpecifiers = (
  nodes: readonly VariableDefinitionNode[],
  schema: SchemaIndex,
): Record<string, BuiltVarSpecifier> => {
  const result: Record<string, BuiltVarSpecifier> = {};
  for (const node of nodes) {
    result[node.variable.name.value] = buildVarSpecifier(node, schema);
  }
  return result;
};
```

Note: This uses `throw` (not neverthrow) because it will be called from the composer layer. The error is unrecoverable -- if a variable type is not in the schema, the tagged template definition is invalid.

#### Dependencies

- **Requires**: `parseTypeNode` from Task 1.1, `SchemaIndex` from Task 1.2
- **Produces**: `buildVarSpecifier`, `buildVarSpecifiers` -- consumed by Round 2 tagged template implementation

#### Validation

```bash
bun run test packages/core/src/graphql/var-specifier-builder.test.ts
```

Expected: All tests pass. Tests cover:
- Scalar type resolution (ID, String, Int, Float, Boolean, custom scalar)
- Enum type resolution
- Input type resolution
- Modifier parsing (non-null, nullable, lists)
- Default value extraction (int, float, string, boolean, null, enum, list, object)
- Error on unknown type name (throws)
- `buildVarSpecifiers` produces correct record keyed by variable name
- Error on variable reference in default value (throws)

Test setup requires a schema with scalars, enums, and input types:

```typescript
import { parse } from "graphql";
import { createSchemaIndex } from "./schema-index";

const schema = createSchemaIndex(parse(`
  scalar CustomScalar
  enum Status { ACTIVE INACTIVE }
  input UserFilter { name: String, status: Status }
  type Query { dummy: String }
`));
```

To get `VariableDefinitionNode` objects for testing, parse a GraphQL operation and extract from the AST:

```typescript
import { parse as parseGql, type VariableDefinitionNode } from "graphql";

const getVarDefs = (source: string): readonly VariableDefinitionNode[] => {
  const doc = parseGql(source);
  const op = doc.definitions[0];
  if (op.kind !== "OperationDefinition") throw new Error("Expected operation");
  return op.variableDefinitions ?? [];
};
```

#### Subagent eligibility

**Eligible** -- New file with well-defined inputs and outputs. Depends on Task 1.1 and 1.2 at import level, but can be developed in parallel using the type signatures specified in this document.

---

### Task 1.5: Index File

Create the barrel export for `packages/core/src/graphql/`.

**Commit message**: `feat(core): add graphql module index with re-exports`

#### Files

| File | Action | Rationale |
|------|--------|-----------|
| `packages/core/src/graphql/index.ts` | Create | Barrel re-export for all graphql utilities |

#### Type signatures

```typescript
// Re-export all public types and functions
export { parseGraphqlSource, parseTypeNode } from "./parser";
export { preprocessFragmentArgs, type PreprocessResult } from "./fragment-args-preprocessor";
export {
  collectVariableUsages,
  getArgumentType,
  getFieldReturnType,
  getInputFieldType,
  inferVariablesFromUsages,
  isModifierAssignable,
  mergeModifiers,
  mergeVariableUsages,
  sortFragmentsByDependency,
  transformParsedGraphql,
  type EnrichedFragment,
  type EnrichedOperation,
  type EnrichedVariable,
  type TransformOptions,
  type TransformResult,
  type VariableUsage,
} from "./transformer";
export {
  createSchemaIndex,
  type DirectiveRecord,
  type EnumRecord,
  type InputRecord,
  type ObjectRecord,
  type OperationTypeNames,
  type ScalarRecord,
  type SchemaIndex,
  type UnionRecord,
} from "./schema-index";
export {
  buildVarSpecifier,
  buildVarSpecifiers,
  type BuiltVarSpecifier,
} from "./var-specifier-builder";
export type {
  GraphqlAnalysisError,
  InferredVariable,
  ParsedArgument,
  ParsedFieldSelection,
  ParsedFragment,
  ParsedFragmentSpread,
  ParsedInlineFragment,
  ParsedObjectField,
  ParsedOperation,
  ParsedSelection,
  ParsedValue,
  ParsedVariable,
  ParseResult,
  TypeInfo,
} from "./types";
```

#### Implementation pattern

Standard barrel export file. No logic, just re-exports. The exact set of exports depends on what Tasks 1.1-1.4 produce, so this task runs last.

#### Dependencies

- **Requires**: All of Tasks 1.1, 1.2, 1.3, 1.4 to be completed
- **Produces**: Single import point `packages/core/src/graphql/` for Round 2 consumers

#### Validation

```bash
bun typecheck
```

Expected: Type check passes. The index file should not introduce any new type errors. Verify all exports resolve correctly.

#### Subagent eligibility

**Main-context** -- Depends on all other tasks completing first. Must verify actual exports match what was created.

---

## Subagent Parallelization Map

```
[1.1 parser+types]  [1.2 transformer+schema-index]  [1.3 preprocessor]  [1.4 var-builder]
     |                         |                           |                    |
     |    (all can run in parallel as subagent tasks)      |                    |
     v                         v                           v                    v
                        [1.5 index.ts]
                    (main context, after all complete)
```

All four implementation tasks (1.1-1.4) are subagent-eligible and can run in parallel. Each task:
- Creates new files only (no modifications to existing code)
- Has well-defined type signatures specified in this document
- Can use the shared context section for any cross-task type references

Task 1.5 must run in main context after all others complete, because it needs to verify actual file exports.

## Round 1 Verification

After all 5 tasks are complete, verify:

1. **All unit tests pass**:
   ```bash
   bun run test packages/core/src/graphql/
   ```

2. **Type check passes**:
   ```bash
   bun typecheck
   ```

3. **Full test suite passes** (no regressions):
   ```bash
   bun run test
   ```

4. **Quality checks pass**:
   ```bash
   bun quality
   ```

5. **No integration with existing composer code yet** -- Round 1 only creates the shared infrastructure. Round 2 will wire these utilities into the tagged template composers.

## File Inventory

After Round 1, `packages/core/src/graphql/` should contain:

```
packages/core/src/graphql/
  index.ts                              (Task 1.5)
  types.ts                              (Task 1.1)
  parser.ts                             (Task 1.1)
  parser.test.ts                        (Task 1.1)
  schema-index.ts                       (Task 1.2)
  transformer.ts                        (Task 1.2)
  transformer.test.ts                   (Task 1.2)
  fragment-args-preprocessor.ts         (Task 1.3)
  fragment-args-preprocessor.test.ts    (Task 1.3)
  var-specifier-builder.ts              (Task 1.4)
  var-specifier-builder.test.ts         (Task 1.4)
```

Total: 11 files (5 source + 5 test + 1 index).

## References

- [Phase 1 Implementation Plan](./tagged-template-unification-phase1.md) -- parent plan with round structure
- [Implementation Strategy](./tagged-template-unification.md) -- overall strategy document
- Source: `packages/codegen/src/graphql-compat/parser.ts` (306 lines)
- Source: `packages/codegen/src/graphql-compat/types.ts` (250 lines)
- Source: `packages/codegen/src/graphql-compat/transformer.ts` (817 lines)
- Source: `packages/codegen/src/generator.ts` (createSchemaIndex, ~200 lines)
- Source: `packages/lsp/src/fragment-args-preprocessor.ts` (131 lines)
- VarSpecifier reference: `packages/core/src/composer/var-builder.ts` (281 lines)

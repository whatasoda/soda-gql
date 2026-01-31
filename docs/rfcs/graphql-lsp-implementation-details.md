# GraphQL LSP Implementation Details Report

## Purpose

This document supplements the [GraphQL LSP Multi-Schema RFC](./graphql-lsp-multi-schema.md) with deeper technical analysis of what building an LSP from scratch entails, what existing libraries provide, and what opportunities exist for soda-gql-specific extensions beyond standard GraphQL LSP features.

## Table of Contents

- [1. LSP Protocol Requirements](#1-lsp-protocol-requirements)
- [2. graphql-language-service Interface Layer Analysis](#2-graphql-language-service-interface-layer-analysis)
- [3. What Must Be Built from Scratch](#3-what-must-be-built-from-scratch)
- [4. soda-gql-Specific Extension Opportunities](#4-soda-gql-specific-extension-opportunities)
- [5. Risk Analysis](#5-risk-analysis)

---

## 1. LSP Protocol Requirements

### 1.1 Server lifecycle

Every LSP server must implement the following lifecycle:

| Phase | Request/Notification | Description |
|-------|---------------------|-------------|
| Handshake | `initialize` | Client sends capabilities, server responds with its own |
| Ready | `initialized` | Client confirms initialization |
| Running | (various) | Handle requests and notifications |
| Shutdown | `shutdown` | Client requests graceful shutdown |
| Exit | `exit` | Client notifies server to terminate |

The `initialize` response declares which capabilities the server supports. This is where the server selectively opts into features:

```typescript
connection.onInitialize((params: InitializeParams): InitializeResult => {
  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      completionProvider: { triggerCharacters: ['.', '{', '(', ':', '@', '$', '\n', ' '] },
      hoverProvider: true,
      definitionProvider: true,
      referencesProvider: true,
      documentSymbolProvider: true,
      codeActionProvider: true,
      // Advanced (see section 4)
      codeLensProvider: { resolveProvider: true },
      inlayHintProvider: true,
      semanticTokensProvider: { /* ... */ },
    },
  };
});
```

### 1.2 Document synchronization (mandatory)

The server must track document state. Three notifications are required:

| Notification | Trigger | Purpose |
|-------------|---------|---------|
| `textDocument/didOpen` | File opened in editor | Register document, run initial diagnostics |
| `textDocument/didChange` | User edits file | Update cached content, re-parse tagged templates, re-run diagnostics |
| `textDocument/didClose` | File closed | Clean up cached state |

`vscode-languageserver` provides a `TextDocuments` manager that handles this automatically:

```typescript
import { TextDocuments } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';

const documents = new TextDocuments(TextDocument);
documents.listen(connection);
```

### 1.3 Feature categories by priority

**Tier 1 — Core (MVP)**

| LSP Method | Purpose | Provided by graphql-language-service? |
|-----------|---------|---------------------------------------|
| `textDocument/completion` | Field, argument, type, directive autocomplete | ✅ `getAutocompleteSuggestions()` |
| `textDocument/publishDiagnostics` | Syntax errors, validation errors, deprecation warnings | ✅ `getDiagnostics()` |
| `textDocument/hover` | Type information, field descriptions, deprecation notices | ✅ `getHoverInformation()` |

**Tier 2 — Navigation**

| LSP Method | Purpose | Provided by graphql-language-service? |
|-----------|---------|---------------------------------------|
| `textDocument/definition` | Jump to type definition in schema, fragment definition | ✅ `getDefinitionQueryResultFor*()` (multiple variants) |
| `textDocument/references` | Find all usages of a fragment or type | ❌ Custom implementation needed |
| `textDocument/documentSymbol` | Outline view (operations, fragments) | ✅ `getOutline()` |

**Tier 3 — Productivity**

| LSP Method | Purpose | Provided by graphql-language-service? |
|-----------|---------|---------------------------------------|
| `textDocument/codeAction` | Quick fixes, extract fragment | ❌ Custom implementation needed |
| `textDocument/rename` | Rename fragment, rename variable | ❌ Custom implementation needed |
| `textDocument/signatureHelp` | Show argument signatures for fields | ❌ Custom implementation needed |
| `textDocument/formatting` | Format GraphQL content in tagged templates | ❌ Custom (could delegate to prettier) |
| `completionItem/resolve` | Lazy-load detailed completion info | Partial (data already available) |

**Tier 4 — Advanced (soda-gql extensions)**

| LSP Method | Purpose | Standard GraphQL LSP? |
|-----------|---------|----------------------|
| `textDocument/codeLens` | Show operation metadata, schema info | ❌ Not in existing GraphQL LSPs |
| `textDocument/inlayHint` | Inline type annotations, argument names | ❌ Not in existing GraphQL LSPs |
| `textDocument/semanticTokens` | Enhanced syntax highlighting | ❌ Not in existing GraphQL LSPs |
| Custom notifications | Schema reload, build status, multi-schema context | N/A (non-standard) |

---

## 2. graphql-language-service Interface Layer Analysis

### 2.1 Package overview

The `graphql-language-service` package (v5.5.0) is the official, runtime-independent interface layer. Previously split into `graphql-language-service-interface`, `-parser`, `-utils`, and `-types`, now consolidated into a single package.

**Key characteristic**: All functions are **stateless**. They take a `GraphQLSchema`, query text, and position as input and return results. No server lifecycle, no file management, no config loading. This makes them ideal for embedding in a custom LSP server.

### 2.2 Core function signatures

#### `getAutocompleteSuggestions`

```typescript
function getAutocompleteSuggestions(
  schema: GraphQLSchema,
  queryText: string,
  cursor: IPosition,          // { line: number, character: number }
  contextToken?: ContextTokenForCodeMirror,
  fragmentDefs?: FragmentDefinitionNode[] | string,
  options?: AutocompleteSuggestionOptions,
): CompletionItem[];
```

- `schema`: The GraphQL schema to suggest against. **For soda-gql: must be the correct schema for the tagged template's import path.**
- `queryText`: The raw GraphQL string extracted from the tagged template.
- `cursor`: Position within the GraphQL string (not the TS file — offset mapping required).
- `fragmentDefs`: External fragment definitions that can be referenced. **For soda-gql: fragments from other files need to be collected.**
- Returns `CompletionItem[]` with `label`, `kind`, `documentation`, `insertText`, `detail`.

#### `getDiagnostics`

```typescript
function getDiagnostics(
  query: string,
  schema?: GraphQLSchema | null,
  customRules?: ValidationRule[],
  isRelayCompatMode?: boolean,
  externalFragments?: FragmentDefinitionNode[] | string,
): Diagnostic[];
```

- Works without a schema (syntax-only validation), but full validation requires one.
- `customRules`: Allows injecting soda-gql-specific validation rules (see section 4).
- `externalFragments`: Same as autocomplete — fragments from other files.

#### `getHoverInformation`

```typescript
function getHoverInformation(
  schema: GraphQLSchema,
  queryText: string,
  cursor: IPosition,
  contextToken?: ContextToken,
  config?: GraphQLConfig,
): Hover['contents'];
```

- Returns markdown-formatted hover content.
- Shows type name, field description, deprecation reason.

#### `getOutline`

```typescript
function getOutline(queryText: string): OutlineTree;
```

- Pure parsing, no schema needed.
- Returns a tree structure usable for `textDocument/documentSymbol`.

#### Definition helpers

```typescript
function getDefinitionQueryResultForField(
  fieldName: string, typeName: string, sourceDocument: DocumentNode, filePath: string
): DefinitionQueryResult;

function getDefinitionQueryResultForFragmentSpread(
  fragmentName: string, sourceDocument: DocumentNode, filePath: string
): DefinitionQueryResult;

function getDefinitionQueryResultForNamedType(
  typeName: string, sourceDocument: DocumentNode, filePath: string
): DefinitionQueryResult;
```

- These return position ranges within GraphQL documents.
- For soda-gql, schema-level definitions would need the schema SDL file path.

#### Utility functions

```typescript
// Position conversion
function offsetToPosition(text: string, offset: number): IPosition;
function pointToOffset(text: string, point: IPosition): number;

// AST helpers
function getASTNodeAtPosition(query: string, ast: DocumentNode, point: IPosition): ASTNode | undefined;
function getContextAtPosition(query: string, schema: GraphQLSchema, point: IPosition): { token, state, typeInfo, mode };
function getTypeInfo(schema: GraphQLSchema, tokenState: State): TypeInfo;

// Fragment analysis
function getFragmentDependencies(query: string, fragmentDefinitions?: Map<string, FragmentDefinitionNode>): FragmentDefinitionNode[];

// Variable schema
function getVariablesJSONSchema(variableToType: Record<string, GraphQLInputType>): JSONSchema6;
```

### 2.3 What the interface layer does NOT provide

| Concern | Status | What you must build |
|---------|--------|---------------------|
| LSP protocol handling | ❌ | Server setup, connection, message routing (`vscode-languageserver`) |
| Document synchronization | ❌ | Track open files, incremental updates (`TextDocuments` manager) |
| File parsing | ❌ | Extract GraphQL from tagged templates in TypeScript files |
| Position mapping | ❌ | Convert TS file positions to GraphQL document positions and back |
| Config loading | ❌ | Read `soda-gql.config.ts`, resolve schemas |
| Schema loading | ❌ | Load `.graphql` files, build `GraphQLSchema` objects |
| Schema caching | ❌ | Cache schemas, invalidate on file change |
| Multi-schema routing | ❌ | Resolve which schema applies to each tagged template |
| Cross-file fragments | ❌ | Collect fragment definitions from other files for completion/validation |
| File watching | ❌ | Watch schema files and config for changes |
| `textDocument/references` | ❌ | Find all usages of a fragment/type across workspace |
| `textDocument/codeAction` | ❌ | Quick fixes, refactorings |
| `textDocument/rename` | ❌ | Symbol renaming |
| `textDocument/formatting` | ❌ | Format GraphQL in templates |

---

## 3. What Must Be Built from Scratch

### 3.1 Tagged template extractor

The most critical custom component. It must:

1. **Parse TypeScript AST** to find tagged template expressions
2. **Identify the tag**: Match against known patterns (`gql.{schemaName}`, `graphql`, etc.)
3. **Trace imports**: Follow the tag identifier back to its import declaration
4. **Extract content**: Get the raw GraphQL string from the template
5. **Compute offset map**: Map between TS file positions and GraphQL content positions

Complexity factors:
- Template literals can span multiple lines with varying indentation
- The GraphQL content starts after the opening backtick, possibly with leading whitespace
- Must handle re-exports and aliased imports (`import { graphql as gql } from ...`)
- Must handle TypeScript path aliases (`@/graphql-system/...` → actual file path)

**Reuse opportunity**: soda-gql's `@soda-gql/builder` already has a TypeScript AST analyzer (`packages/builder/src/discovery/`) that finds `gql.{schemaName}()` calls. The tagged template extractor can follow the same pattern.

### 3.2 Position mapping

When the user's cursor is at line 8, column 12 in a TypeScript file, and the tagged template starts at line 5, column 28, the LSP needs to translate this to the corresponding position within the GraphQL string.

```
TS file position (8, 12) → GraphQL position (3, 12)
```

This mapping must be bidirectional:
- **TS → GraphQL**: For forwarding editor requests (completion, hover) to `graphql-language-service`
- **GraphQL → TS**: For converting diagnostics and definition locations back to the editor

Edge cases:
- Indentation stripping (common in tagged templates)
- The backtick character itself (not part of GraphQL content)
- Escaped characters in template strings (rare but possible)

### 3.3 Schema management

```typescript
type SchemaCache = Map<string, {
  schema: GraphQLSchema;
  documentNode: DocumentNode;
  hash: string;          // For change detection
  loadedAt: number;      // For TTL-based invalidation
}>;
```

Requirements:
- Load schemas from paths specified in `soda-gql.config.ts`
- Build `GraphQLSchema` objects using `graphql-js`'s `buildSchema()` or `buildASTSchema()`
- Cache schemas and invalidate when source files change
- Support multiple schemas simultaneously (one per config entry)

**Reuse opportunity**: `@soda-gql/codegen` already has `loadSchema()` (`packages/codegen/src/schema.ts`) and `hashSchema()` functions.

### 3.4 Cross-file fragment resolution

When a tagged template references a fragment defined in another file:

```typescript
// user-fields.ts
export const UserFields = gql.default`
  fragment UserFields on User { id name email }
`;

// get-user.ts
import { UserFields } from './user-fields';
const GetUser = gql.default`
  query GetUser($id: ID!) {
    user(id: $id) { ...UserFields }
  }
`;
```

The LSP must:
1. Detect `...UserFields` in the query
2. Resolve the TypeScript import `'./user-fields'`
3. Find the `UserFields` tagged template in that file
4. Extract the fragment's `DocumentNode`
5. Pass it to `getAutocompleteSuggestions()` and `getDiagnostics()` as `externalFragments`

This requires a **workspace-level index** of all fragment definitions and their locations.

### 3.5 LSP handler wiring

Each LSP method requires a handler that:
1. Receives the LSP request (with TS file URI and position)
2. Finds the tagged template at that position
3. Maps the position to GraphQL coordinates
4. Calls the appropriate `graphql-language-service` function
5. Maps the result back to TS file coordinates
6. Returns the LSP response

Example for completion:

```typescript
connection.onCompletion((params: CompletionParams): CompletionItem[] => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc) return [];

  const state = documentManager.getState(doc.uri);
  const template = state.findTemplateAtPosition(params.position);
  if (!template) return [];

  const graphqlPosition = positionMapper.tsToGraphql(
    params.position,
    template.range,
  );

  const schema = schemaResolver.getSchema(template.schemaName);
  if (!schema) return [];

  const fragments = fragmentIndex.getFragmentsForSchema(template.schemaName);

  return getAutocompleteSuggestions(
    schema,
    template.content,
    graphqlPosition,
    undefined,
    fragments,
  );
});
```

---

## 4. soda-gql-Specific Extension Opportunities

This section describes features that go beyond what any existing GraphQL LSP provides. Building a custom LSP opens the door to these soda-gql-specific enhancements.

### 4.1 Inlay hints for inferred types

LSP 3.17 introduced `textDocument/inlayHint`. No existing GraphQL LSP implements this.

soda-gql could show inferred return types and variable types inline:

```typescript
const GetUser = gql.default`
  query GetUser($id: ID!) {
    user(id: $id) {           // ← inlay: ": User"
      id                      // ← inlay: ": ID!"
      name                    // ← inlay: ": String!"
      posts(first: 10) {      // ← inlay: ": [Post!]!"
        title                 // ← inlay: ": String!"
      }
    }
  }
`;
```

This eliminates the need to hover each field individually — the type information is always visible.

**Implementation**: Use `getTypeInfo()` from `graphql-language-service` to resolve types at each field position, then emit `InlayHint[]` with type annotations.

### 4.2 Code lens for operation metadata

`textDocument/codeLens` can show actionable information above operations:

```typescript
// ▸ Schema: admin | Fields: 12 | Depth: 3 | Est. complexity: 24
const GetAdmin = gql.admin`
  query GetAdmin { ... }
`;
```

Possible code lens items:
- **Schema name**: Which schema this operation targets (critical for multi-schema projects)
- **Field count**: Total number of selected fields
- **Query depth**: Nesting depth of the selection set
- **Estimated complexity**: Based on schema-defined complexity weights
- **Run query**: Open in GraphiQL or execute against a dev server (command-based)

**Implementation**: Parse the operation, walk the selection set, compute metrics, return `CodeLens[]` with custom commands.

### 4.3 Custom diagnostics: soda-gql validation rules

`getDiagnostics()` accepts `customRules: ValidationRule[]`. soda-gql can inject its own rules:

| Rule | Description | Severity |
|------|-------------|----------|
| `NoExcludedTypes` | Warn when querying types excluded by `typeFilter` in config | Warning |
| `InputDepthLimit` | Warn when input nesting exceeds `defaultInputDepth` or overrides | Warning |
| `FragmentSchemaMatch` | Error when spreading a fragment from a different schema | Error |
| `OperationNaming` | Enforce naming conventions for operations | Info |
| `DeprecatedFieldUsage` | Enhanced deprecation warnings with migration hints | Warning |
| `UnusedFragment` | Warn about fragments defined but not spread anywhere | Warning |

Example implementation:

```typescript
import { ValidationContext, ASTVisitor } from 'graphql';

const NoExcludedTypesRule = (
  excludedTypes: Set<string>,
) => (context: ValidationContext): ASTVisitor => ({
  NamedType(node) {
    if (excludedTypes.has(node.name.value)) {
      context.reportError(
        new GraphQLError(
          `Type "${node.name.value}" is excluded by typeFilter in soda-gql config.`,
          { nodes: [node] },
        ),
      );
    }
  },
});
```

### 4.4 Schema-aware semantic tokens

`textDocument/semanticTokens` provides enhanced syntax highlighting beyond TextMate grammars.

soda-gql could provide schema-aware token types:

| Token | Semantic Type | Modifier |
|-------|--------------|----------|
| Query field name | `property` | `declaration` |
| Deprecated field | `property` | `deprecated` |
| Scalar type | `type` | — |
| Enum value | `enumMember` | — |
| Fragment name | `function` | `declaration` |
| Variable | `variable` | — |
| Directive | `decorator` | — |

This would enable visual differentiation between, e.g., deprecated and non-deprecated fields directly in the editor's color scheme, without requiring a hover.

**Implementation**: Walk the GraphQL AST, resolve types via schema, emit semantic token ranges mapped back to TS file positions.

### 4.5 Multi-schema context indicator

A custom LSP notification to inform the editor which schema is active for the current cursor position:

```typescript
// Custom notification: soda-gql/activeSchema
connection.sendNotification('soda-gql/activeSchema', {
  uri: document.uri,
  schemaName: 'admin',
  schemaPath: './schemas/admin/schema.graphql',
});
```

The VSCode extension could display this in the status bar:

```
[GraphQL: admin] ← shown in status bar when cursor is inside a gql.admin tagged template
```

This is particularly valuable in multi-schema projects where different parts of the same file may target different schemas.

### 4.6 Automatic compat migration

A code action that converts `.graphql` file content to a tagged template:

```
// Before (in .graphql file):
query GetUser($id: ID!) {
  user(id: $id) { id name }
}

// Code action: "Convert to soda-gql tagged template"

// After (in .ts file):
import { gql } from "@/graphql-system";

export const GetUserCompat = gql.default`
  query GetUser($id: ID!) {
    user(id: $id) { id name }
  }
`;
```

This leverages the existing graphql-compat parser (`packages/codegen/src/graphql-compat/parser.ts`) but runs it interactively via LSP code actions instead of CLI codegen.

### 4.7 `workspace/executeCommand` for build integration

Custom commands executable via the LSP:

| Command | Description |
|---------|-------------|
| `soda-gql.reloadSchemas` | Force reload all schemas from disk |
| `soda-gql.generateLspConfig` | Generate `.graphqlrc.generated.json` |
| `soda-gql.showSchemaInfo` | Display schema statistics in a panel |
| `soda-gql.switchSchema` | Change the default schema for new templates |
| `soda-gql.validateWorkspace` | Run full workspace validation |

These integrate with the existing `@soda-gql/cli` and `@soda-gql/sdk` packages.

### 4.8 Variables JSON schema generation

`graphql-language-service` exports `getVariablesJSONSchema()` which generates a JSON Schema from operation variables. soda-gql could expose this to provide:

- **Variable completion**: When typing variable values in tests or playground
- **Variable validation**: Ensure variable values match expected types
- **Documentation generation**: Auto-generate variable documentation for operations

---

## 5. Risk Analysis

### 5.1 Complexity risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Position mapping bugs (off-by-one, indentation) | High | Medium | Extensive unit tests with edge cases; snapshot testing |
| Cross-file fragment resolution performance | Medium | High | Lazy indexing; file-level caching; incremental updates |
| TypeScript parser maintenance burden | Medium | Medium | Use `@swc/core` for speed; keep parser minimal (tagged template extraction only) |
| `graphql-language-service` API changes | Low | Medium | Pin version; review changelogs on update |
| Large schema performance (1000+ types) | Medium | High | Lazy schema loading; index only reachable types (reuse `reachability.ts`) |

### 5.2 Scope risks

The biggest risk is scope creep. Tier 4 features (section 4) are exciting but should not delay the MVP. Recommended approach:

1. **MVP**: Tier 1 (completion, diagnostics, hover) + basic multi-schema routing
2. **V1**: Add Tier 2 (definition, document symbols, references)
3. **V2**: Add Tier 3 (code actions, rename, formatting) + select Tier 4 features
4. **V3+**: Full Tier 4 (inlay hints, code lens, semantic tokens, custom commands)

### 5.3 Dependencies

For the hybrid approach, the dependency chain is:

```
@soda-gql/lsp
├── vscode-languageserver (~200KB)
├── vscode-languageserver-textdocument (~15KB)
├── graphql-language-service (~150KB, depends on graphql)
├── graphql (~800KB, already a project dependency)
├── @soda-gql/config (internal)
└── typescript or @swc/core (for TS AST parsing)
```

Total new dependencies: `vscode-languageserver`, `vscode-languageserver-textdocument`, `graphql-language-service`. The `graphql` package is already used by `@soda-gql/codegen`.

---

## References

- [LSP Specification 3.17](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/)
- [vscode-languageserver-node](https://github.com/microsoft/vscode-languageserver-node)
- [VSCode Language Server Extension Guide](https://code.visualstudio.com/api/language-extensions/language-server-extension-guide)
- [graphql-language-service TypeDoc](https://graphiql-test.netlify.app/typedoc/modules/graphql_language_service)
- [graphql-language-service-server README](https://github.com/graphql/graphiql/blob/main/packages/graphql-language-service-server/README.md)
- [graphql-language-service npm](https://www.npmjs.com/package/graphql-language-service)
- [@0no-co/GraphQLSP](https://github.com/0no-co/GraphQLSP)

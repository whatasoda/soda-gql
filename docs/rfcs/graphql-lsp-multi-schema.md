# RFC: GraphQL LSP with Multi-Schema Support

## Status

**Accepted**

## Summary

This RFC defines the design for an independent GraphQL Language Server Protocol (LSP) implementation for soda-gql. The LSP provides IDE features (autocomplete, diagnostics, hover, go-to-definition) for GraphQL operations written as tagged template literals in TypeScript files.

The design commits to these key decisions:

1. **Callback + Tagged Template API**: `gql.{schemaName}` always receives a callback. Inside the callback, `query`/`mutation`/`subscription`/`fragment` serve as tagged template tags. The tagged template result is callable for metadata chaining.
2. **Fragment Arguments RFC syntax**: Fragment variables are declared using the [GraphQL Fragment Arguments proposal](https://github.com/graphql/graphql-spec/pull/1081) syntax directly in GraphQL.
3. **Hybrid LSP Architecture**: Custom LSP server using `vscode-languageserver` for protocol handling and `graphql-language-service` (interface layer only) for completion/diagnostics/hover algorithms. SWC for TypeScript AST parsing.

## Motivation

### Multi-schema conflicts with `.graphql` files

The unified codegen pipeline enables reuse of existing `.graphql` assets by generating `.compat.ts` files. However, when a project uses multiple schemas (e.g., `default` and `admin`), there is no ergonomic way to associate each `.graphql` file with its corresponding schema.

Tools like `graphql-config` solve this with path-based schema routing:

```yaml
# .graphqlrc.yaml
projects:
  default:
    schema: ./schemas/default/schema.graphql
    documents: ./src/default/**/*.graphql
  admin:
    schema: ./schemas/admin/schema.graphql
    documents: ./src/admin/**/*.graphql
```

This approach is **implicit and fragile**: the schema association depends on directory structure rather than explicit declaration. Moving a file silently breaks validation. Developers must remember which directories map to which schemas.

### TypeScript Language Service Plugin deprecation

`@0no-co/graphqlsp` (the TypeScript LSP plugin powering `gql.tada`) provides excellent IDE support for GraphQL in TypeScript. However, TypeScript 7 (tsgo/Corsa) will not support the Language Service Plugin API. The existing JS-based plugin architecture fundamentally does not translate to the new Go-based implementation. Building on TS Language Service Plugins is not future-proof.

References:
- [Transformer Plugin or Compiler API - typescript-go #516](https://github.com/microsoft/typescript-go/issues/516) (proposal removed)
- [What will happen to the existing TypeScript/JavaScript codebase? - Discussion #454](https://github.com/microsoft/typescript-go/discussions/454)

### No IDE support for the existing composer API

The current `gql.{schemaName}(() => ...)` API provides type-safe field selection at the TypeScript level but has no GraphQL-aware IDE features (no schema-driven autocomplete, no GraphQL validation diagnostics, no hover documentation for fields).

### Goals

1. **Explicit schema association**: Each GraphQL document explicitly declares which schema it targets
2. **IDE features**: Autocomplete, diagnostics, hover, and go-to-definition for GraphQL in TypeScript
3. **Editor-agnostic**: Works with any LSP-compatible editor (VSCode, Neovim, Sublime, etc.)
4. **Future-proof**: Independent of TypeScript Language Service Plugin API
5. **Zero-runtime preserved**: All IDE features are dev-time only; no runtime overhead

## Background & Context

### Current soda-gql architecture

```
soda-gql.config.ts
  schemas: { default: {...}, admin: {...} }
      │
      ├─► [Codegen] ─► graphql-system/index.ts (typed composer + runtime)
      │                   exports: gql.default(), gql.admin()
      │
      ├─► [GraphQL Compat] ─► .compat.ts files (from .graphql files)
      │
      └─► [Builder] ─► Static analysis of gql.{schema}() calls
              │
              └─► [Plugin] ─► Build-time transformation to runtime artifacts
```

Key packages:
- `@soda-gql/config`: Configuration loading (`soda-gql.config.ts`)
- `@soda-gql/codegen`: Schema code generation with reachability filtering
- `@soda-gql/builder`: Static analysis engine (TypeScript AST and SWC)
- `@soda-gql/core`: Runtime types, composer, fragment/operation definitions

### GraphQL LSP ecosystem

Two main approaches exist for providing GraphQL IDE features:

1. **graphql-language-service-server** (official): A standalone LSP server built on `graphql-config`. Supports tagged templates in JS/TS files. Part of the [graphql/graphiql](https://github.com/graphql/graphiql) monorepo.

2. **@0no-co/graphqlsp**: A TypeScript Language Service Plugin. Hooks into tsserver for tighter TS integration. Powers `gql.tada`. Not viable for tsgo/TS7.

### Why tagged template literals

Tagged template literals provide a natural syntax for embedding GraphQL in TypeScript. By combining the existing `gql.{schemaName}(callback)` pattern with tagged templates inside the callback, the API gains GraphQL-aware IDE support while preserving soda-gql's architecture:

```typescript
import { gql } from "@/graphql-system";

// operation: query tagged template inside callback
const GetUser = gql.default(({ query }) => query`
  query GetUser($id: ID!) {
    user(id: $id) { id name }
  }
`);

// fragment: with Fragment Arguments RFC syntax for variables
const UserFields = gql.default(({ fragment }) => fragment`
  fragment UserFields($showEmail: Boolean = false) on User {
    id
    email @include(if: $showEmail)
  }
`);

// existing callback API (unchanged, coexists)
const GetUser2 = gql.default(({ query, $var }) =>
  query.operation({
    name: "GetUser",
    variables: { ...$var("id").ID("!") },
    fields: ({ f, $ }) => ({
      ...f.user({ id: $.id })(({ f }) => ({ id: true, name: true })),
    }),
  })
);
```

Advantages:
- **Schema explicit via `gql.{schemaName}`**: `gql.default` vs `gql.admin` — unambiguous schema association
- **Operation kind explicit via tag name**: `query`, `fragment`, `mutation`, `subscription` — type-level distinction
- **Callback preserves intermediate module compatibility**: `gql.{schemaName}` always receives a function
- **Parser-friendly**: LSP extracts tagged templates from callback bodies via SWC AST analysis
- **Syntax highlighting**: Editor extensions (e.g., vscode-graphql-syntax) already support GraphQL in tagged templates via TextMate grammar injection

## Design Decisions

### 4.1 Tagged Template API

The tagged template API extends the existing `gql.{schemaName}(callback)` composer pattern. The callback context provides `query`/`mutation`/`subscription`/`fragment` that serve as both tagged template tags (new) and existing API method hosts. Both styles produce the same build-time artifacts and runtime behavior.

#### API design

```typescript
import { gql } from "@/graphql-system";

// --- Operations ---

// query
const GetUser = gql.default(({ query }) => query`
  query GetUser($id: ID!) {
    user(id: $id) { id name email }
  }
`);

// mutation
const UpdateUser = gql.default(({ mutation }) => mutation`
  mutation UpdateUser($id: ID!, $name: String!) {
    updateUser(id: $id, name: $name) { id name }
  }
`);

// subscription
const OnMessage = gql.default(({ subscription }) => subscription`
  subscription OnMessage($roomId: ID!) {
    messageAdded(roomId: $roomId) { id text sender }
  }
`);

// --- Fragments ---

// basic fragment
const UserFields = gql.default(({ fragment }) => fragment`
  fragment UserFields on User {
    id
    name
    email
  }
`);

// fragment with variables (Fragment Arguments RFC syntax)
const UserProfile = gql.default(({ fragment }) => fragment`
  fragment UserProfile($showEmail: Boolean = false) on User {
    id
    name
    email @include(if: $showEmail)
  }
`);

// fragment with metadata chaining
const PostList = gql.default(({ fragment }) => fragment`
  fragment PostList($first: Int!) on Query {
    posts(first: $first) { id title }
  }
`({
  metadata: { pagination: true },
}));

// --- Existing callback API (unchanged, coexists) ---

const GetUser2 = gql.default(({ query, $var }) =>
  query.operation({
    name: "GetUser",
    variables: { ...$var("id").ID("!") },
    fields: ({ f, $ }) => ({
      ...f.user({ id: $.id })(({ f }) => ({ id: true, name: true })),
    }),
  })
);
```

#### Design rationale

- **`gql.{schemaName}` always receives a callback**: Required by the intermediate module system. The builder's static analysis depends on `gql.{schemaName}(callback)` call expressions.
- **Tag names encode operation kind**: `query`/`mutation`/`subscription`/`fragment` in the callback distinguish the element type at both the TypeScript type level and the AST level. This eliminates ambiguity that a bare `gql.default`...`` would have.
- **Metadata chaining via call**: The tagged template result is callable, enabling metadata attachment (e.g., `fragment`...`({ metadata: ... })`). This is extensible for future metadata needs without changing the GraphQL syntax.

#### Fragment Arguments RFC syntax

This RFC adopts the [Fragment Arguments proposal (graphql-spec #1081)](https://github.com/graphql/graphql-spec/pull/1081) for declaring fragment variables. This is a Stage 2 GraphQL spec proposal that adds variable declarations to fragment definitions:

```graphql
# Standard GraphQL: no fragment variables
fragment UserFields on User {
  id
  name
}

# Fragment Arguments RFC: variables declared on the fragment
fragment UserProfile($showEmail: Boolean = false) on User {
  id
  name
  email @include(if: $showEmail)
}

# Usage with arguments
query GetUser($id: ID!) {
  user(id: $id) {
    ...UserProfile(showEmail: true)
  }
}
```

This syntax is chosen because:
- **Natural**: Variable declarations look identical to operation variable declarations
- **Self-contained**: Fragment variables are declared in the GraphQL string itself, no TypeScript-level API needed
- **Future-proof**: If the spec proposal is accepted, soda-gql's syntax becomes standard GraphQL

**`graphql-js` compatibility**: The current `graphql-js` parser does not accept Fragment Arguments syntax. The LSP preprocesses fragment definitions by stripping argument declarations before passing to `graphql-language-service` functions (`getDiagnostics()`, `getAutocompleteSuggestions()`). Fragment argument validation is handled by custom soda-gql validation rules.

#### Type structure

```typescript
// query/mutation/subscription: tagged template tag + existing API methods
type QueryTag = {
  // Tagged template (new)
  (strings: TemplateStringsArray, ...values: never[]): ChainableOperation;
  // Existing callback API
  operation: (...) => AnyOperation;
  compat: (...) => AnyGqlDefine;
};

// fragment: tagged template tag + existing per-type builders
type FragmentTag = {
  // Tagged template (new)
  (strings: TemplateStringsArray, ...values: never[]): ChainableFragment;
  // Existing callback API (fragment.User, fragment.Post, ...)
  readonly [TypeName in keyof Schema["object"]]: FragmentBuilderFor<...>;
};

// Tagged template results are callable for metadata chaining
type ChainableOperation = AnyOperation & {
  (options: { metadata?: Record<string, unknown> }): AnyOperation;
};

type ChainableFragment = AnyFragment & {
  (options: { metadata?: Record<string, unknown> }): AnyFragment;
};
```

`FragmentTag` has dual nature: it is callable as a tagged template tag, and it has properties for the existing `fragment.User(...)` builder API. At runtime, this is implemented via `Object.assign(tagFn, fragmentBuilders)` or `Proxy`.

#### Runtime behavior

Key constraints:
- **`gql.{schemaName}` always receives a callback**: The callback is invoked with a context containing `query`/`mutation`/`subscription`/`fragment` tags plus existing API members (`$var`, `$dir`, `$colocate`, etc.).
- **No interpolation**: `` query`...${expr}...` `` is a type error (`never[]` enforces this). Interpolation would break static analysis and LSP autocomplete.
- **Build-time extraction**: The builder plugin detects tagged templates inside `gql.{schemaName}(callback)` calls via SWC AST analysis and transforms them into the same artifact format as existing callback API calls.
- **Runtime transformation**: At build time, tagged templates are replaced with `createRuntimeOperation` / `createRuntimeFragment` calls (same codepath as existing API).

#### Type inference (Open Question)

Two approaches for type-safe results from tagged templates:

**Approach 1: Codegen-generated TypedDocumentNode** (graphql-codegen pattern)
```typescript
const GetUser = gql.default(({ query }) => query`
  query GetUser($id: ID!) { user(id: $id) { id name } }
`);
// Type: TypedDocumentNode<GetUserQuery, GetUserQueryVariables>
```

**Approach 2: soda-gql $infer pattern**
```typescript
const GetUser = gql.default(({ query }) => query`
  query GetUser($id: ID!) { user(id: $id) { id name } }
`);
type Data = typeof GetUser.$infer.output;
type Vars = typeof GetUser.$infer.input;
```

This decision is deferred to implementation phase. See [Open Questions](#open-questions).

### 4.2 Schema association mechanism

Schema association is resolved through `gql.{schemaName}` and its import path:

1. **Codegen generates per-schema entries**: The `gql` object exposes schema-specific members (`gql.default`, `gql.admin`)
2. **LSP resolves tag to schema name**: When the LSP encounters `gql.{name}(callback)`, it extracts `{name}` as the schema identifier
3. **Config provides the mapping**: The existing `schemas: Record<string, SchemaConfig>` in `soda-gql.config.ts` defines available schemas. The existing `graphqlSystemAliases` config (e.g., `["@/graphql-system"]`) provides alias resolution.

Resolution algorithm:
```
1. Find gql.{name}(callback) call expression via SWC AST
2. Extract schema name from member expression (e.g., gql.default → "default")
3. Validate that the gql import resolves to the graphql-system output:
   - outdir (e.g., "./graphql-system")
   - graphqlSystemAliases[i] (e.g., "@/graphql-system")
   - Handle tsconfig paths aliases if tsconfigPath is configured
4. Match schema name against config schemas: Record<string, SchemaConfig>
5. Inside the callback body, find tagged templates (query`...`, fragment`...`, etc.)
6. For each tagged template, associate with the resolved schema
```

### 4.3 LSP architecture: Hybrid approach

The LSP server uses a hybrid architecture that combines existing battle-tested algorithms from `graphql-language-service` with custom infrastructure for soda-gql's specific needs.

```
soda-gql LSP Server
├── vscode-languageserver (LSP protocol handling)
├── graphql-language-service (completion/diagnostics/hover logic only)
│   └── getAutocompleteSuggestions(), getDiagnostics(), getHoverInformation()
├── SWC-based TS parser (tagged template extraction from callbacks)
├── Fragment Arguments preprocessor (strip before graphql-js validation)
├── soda-gql config loader (reads soda-gql.config.ts directly)
└── Schema resolver (gql.{schemaName} → schema mapping)
```

#### Why Hybrid

The hybrid approach strikes the right balance between implementation effort and architectural control:

- **graphql-language-service interface layer** provides stateless, schema-aware completion/diagnostics/hover functions that are proven across thousands of projects. Reimplementing these algorithms from scratch would add significant effort with no benefit.
- **Custom LSP server** (not wrapping `graphql-language-service-server`) avoids the forced dependency on `graphql-config`, which would create config duplication with `soda-gql.config.ts`. Reading soda-gql config directly ensures a single source of truth.
- **SWC-based TS parser** provides fast AST analysis for extracting tagged templates from callback bodies. SWC is already used by soda-gql's builder and offers significantly better parse performance than the TypeScript compiler API, which matters for an always-on LSP server.
- **Fragment Arguments preprocessor** is required regardless of LSP approach, since `graphql-js` does not support the Fragment Arguments syntax. The preprocessor strips argument declarations before passing to `graphql-language-service` functions.

#### Characteristics

**What graphql-language-service provides** (stateless functions, no server lifecycle):
- `getAutocompleteSuggestions()`: Field, argument, type, directive autocomplete
- `getDiagnostics()`: Syntax and validation errors with custom rule injection
- `getHoverInformation()`: Type information, field descriptions, deprecation notices
- `getOutline()`: Document symbols (operations, fragments)
- `getDefinitionQueryResultFor*()`: Go-to-definition helpers

**What we build ourselves**:
- LSP server lifecycle and protocol handling (`vscode-languageserver`)
- SWC-based TypeScript file parsing and tagged template extraction from callbacks
- Fragment Arguments preprocessing (strip before `graphql-js` validation)
- Position mapping (TS file coordinates ↔ GraphQL document coordinates)
- Multi-schema resolution (`gql.{schemaName}` → schema lookup)
- Config loading from `soda-gql.config.ts`
- Schema caching and reload
- Cross-file fragment resolution
- `.graphql` file support

### 4.4 Configuration integration

The LSP reads `soda-gql.config.ts` directly using the existing `@soda-gql/config` package. No separate LSP-specific configuration file is needed.

For external tool compatibility (graphql-eslint, GraphiQL), a `.graphqlrc.generated.json` can be auto-generated:

```bash
bun run soda-gql codegen lsp-config
```

This generates a `graphql-config`-compatible file from `soda-gql.config.ts`:

```json
{
  "projects": {
    "default": {
      "schema": "./schemas/default/schema.graphql",
      "documents": "src/**/*.{ts,tsx}"
    },
    "admin": {
      "schema": "./schemas/admin/schema.graphql",
      "documents": "src/**/*.{ts,tsx}"
    }
  }
}
```

The generated file should be gitignored. The LSP itself does **not** read this file — it exists solely for third-party tool compatibility.

## Detailed Design

### Package structure

A new package `@soda-gql/lsp` will be created in `packages/lsp/`:

```
packages/lsp/
├── src/
│   ├── server.ts              # LSP server entry point
│   ├── document-manager.ts    # SWC-based TS parsing, tagged template extraction
│   ├── schema-resolver.ts     # gql.{schemaName} → schema resolution
│   ├── fragment-args.ts       # Fragment Arguments preprocessor
│   ├── handlers/
│   │   ├── completion.ts      # textDocument/completion
│   │   ├── diagnostics.ts     # textDocument/publishDiagnostics
│   │   ├── hover.ts           # textDocument/hover
│   │   └── definition.ts      # textDocument/definition
│   └── utils/
│       └── position-mapping.ts # TS offset ↔ GraphQL offset conversion
├── test/
└── package.json
```

Dependencies:
- `vscode-languageserver` / `vscode-languageserver-textdocument`: LSP protocol
- `graphql-language-service`: Completion, diagnostics, hover algorithms
- `graphql`: Parsing and validation
- `@swc/core`: TypeScript AST parsing for tagged template extraction
- `@soda-gql/config`: Config loading

### Core components

#### Document Manager

Parses TypeScript files via SWC to extract tagged templates from `gql.{schemaName}(callback)` calls:

```typescript
type ExtractedTemplate = {
  /** Range within the TS file (for offset mapping) */
  range: { start: number; end: number };
  /** Resolved schema name (from gql.{schemaName}) */
  schemaName: string;
  /** Operation kind (from tag name: query/mutation/subscription/fragment) */
  kind: "query" | "mutation" | "subscription" | "fragment";
  /** Raw GraphQL content (without template tag) */
  content: string;
  /** GraphQL content with Fragment Arguments stripped (for graphql-js) */
  preprocessedContent: string;
};

type DocumentState = {
  uri: string;
  version: number;
  templates: ExtractedTemplate[];
};
```

The document manager:
1. Parses the TypeScript file into an SWC AST
2. Finds all `gql.{name}(callback)` call expressions
3. Extracts the schema name from the member expression (`gql.default` → `"default"`)
4. Inside the callback body, finds tagged template expressions where the tag is `query`, `mutation`, `subscription`, or `fragment`
5. Extracts the GraphQL string content
6. Preprocesses Fragment Arguments syntax (strips argument declarations for `graphql-js` compatibility)
7. Caches results per document (invalidated on change)

#### Schema Resolver

Maps schema names to `GraphQLSchema` objects using the soda-gql config:

```typescript
type SchemaEntry = {
  name: string;
  schema: GraphQLSchema;
  documentNode: DocumentNode;
  matchPaths: string[];  // All import paths that resolve to this schema's gql object
};
```

Builds `matchPaths` from config:
- `{outdir}` (e.g., `./graphql-system`) — the `gql` import source
- `{alias}` for each `graphqlSystemAliases` entry (e.g., `@/graphql-system`)
- Handles tsconfig `paths` resolution if `tsconfigPath` is configured

#### Fragment Arguments Preprocessor

Transforms Fragment Arguments RFC syntax into standard GraphQL for `graphql-js` compatibility:

```
Input:  fragment UserProfile($showEmail: Boolean = false) on User { ... }
Output: fragment UserProfile on User { ... }

Input:  ...UserProfile(showEmail: true)
Output: ...UserProfile
```

The preprocessor:
1. Strips variable declarations from fragment definitions: `($showEmail: Boolean = false)` → removed
2. Strips arguments from fragment spreads: `(showEmail: true)` → removed
3. Preserves all position information for offset mapping back to the original source

Custom soda-gql validation rules handle fragment argument validation separately (see Implementation Details report, section 4.3).

#### Position Mapping

Converts between positions in the TypeScript file and positions within the GraphQL document:

```
TypeScript file:
  Line 5: const q = gql.default(({ query }) => query`
  Line 6:   query GetUser {    ← cursor at (6, 8)
  Line 7:     user { id }
  Line 8:   }
  Line 9: `);

GraphQL document (extracted):
  Line 1:   query GetUser {    ← mapped to (1, 8)
  Line 2:     user { id }
  Line 3:   }
```

The mapping accounts for:
- Template literal start offset (after backtick)
- Leading whitespace / indentation
- Multi-line template strings

### CLI integration

New CLI command for starting the LSP server:

```bash
# Start LSP server (typically invoked by editor, not manually)
bun run soda-gql lsp

# Generate graphql-config for external tools
bun run soda-gql codegen lsp-config
```

### Editor integration

#### VSCode

A dedicated extension (`soda-gql-vscode`) that:
1. Bundles the LSP server
2. Starts the server when a `soda-gql.config.ts` is detected in the workspace
3. Injects GraphQL syntax highlighting into TypeScript files (via TextMate grammar)

```jsonc
// Extension activation
{
  "activationEvents": [
    "workspaceContains:**/soda-gql.config.{ts,mts,js,mjs}"
  ],
  "contributes": {
    "grammars": [{
      "scopeName": "inline.graphql",
      "path": "./syntaxes/graphql.tmLanguage.json",
      "injectTo": ["source.ts", "source.tsx"]
    }]
  }
}
```

#### Neovim

Configuration via `nvim-lspconfig`:

```lua
require('lspconfig.configs').soda_gql = {
  default_config = {
    cmd = { 'soda-gql', 'lsp' },
    filetypes = { 'typescript', 'typescriptreact' },
    root_dir = require('lspconfig.util').root_pattern('soda-gql.config.ts'),
  }
}
require('lspconfig').soda_gql.setup{}
```

## Implementation Plan

### Phase 0: Schema resolver and config extension

- Implement `schema-resolver.ts`: `gql.{schemaName}` → schema resolution using soda-gql config
- Extend config types if needed (e.g., per-schema `importPaths` overrides)
- Add `codegen lsp-config` CLI command to generate `.graphqlrc.generated.json`
- Unit tests for schema resolution with aliases and tsconfig paths

### Phase 1: LSP server core

- Set up `@soda-gql/lsp` package
- Implement SWC-based document manager (find `gql.{name}(callback)` → extract tagged templates from callback body)
- Implement Fragment Arguments preprocessor
- Implement position mapping (TS offset ↔ GraphQL offset)
- Wire up LSP handlers using `graphql-language-service` interface functions:
  - `textDocument/completion` → `getAutocompleteSuggestions()`
  - `textDocument/publishDiagnostics` → `getDiagnostics()`
- Integration tests with sample multi-schema projects

### Phase 2: VSCode extension

- Scaffold VSCode extension project
- Bundle LSP server
- Add GraphQL syntax highlighting injection for tagged templates
- Test activation, completion, and diagnostics end-to-end

### Phase 3: Advanced LSP features

- `textDocument/hover` → `getHoverInformation()`
- `textDocument/definition` (navigate to schema type definitions)
- Schema file watching and auto-reload
- Fragment cross-file resolution
- Fragment Arguments validation (custom rules)

### Phase 4: Ecosystem integration

- Neovim / Sublime integration guides
- `.graphql` file support (in addition to tagged templates)
- Migration guide from `.graphql` files to tagged templates
- graphql-eslint compatibility via generated `.graphqlrc`

## Backward Compatibility

This proposal introduces **no breaking changes**:

- **Existing `gql.{schemaName}(callback)` API**: Fully preserved, no changes required
- **`.graphql` files with graphql-compat**: Continue to work via `codegen graphql` command
- **Existing config**: `soda-gql.config.ts` schema is extended with optional fields only; old configs work without LSP features

All styles can coexist in the same project:

```typescript
// Style 1: Callback composer with field builders (existing)
const q1 = gql.default(({ query, $var }) =>
  query.operation({
    name: "GetUser",
    variables: { ...$var("id").ID("!") },
    fields: ({ f, $ }) => ({ ...f.user({ id: $.id })(...) }),
  })
);

// Style 2: Callback with tagged template (new)
const q2 = gql.default(({ query }) => query`
  query GetUser($id: ID!) { user(id: $id) { id name } }
`);

// Style 3: .graphql file with compat (existing)
// → auto-generated .compat.ts
```

## Alternatives Considered

### Bare tagged template without callback

```typescript
const GetUser = gql.default`query GetUser { user { id } }`;
```

**Rejected**: `gql.{schemaName}` must always receive a callback for intermediate module compatibility. Additionally, bare tagged templates cannot distinguish between fragments and operations at the TypeScript type level, and cannot provide context members like `$var` or `$dir`.

### Tagged template: Schema-specific subpath imports (Pattern A)

```typescript
import { graphql } from "@/graphql-system/default";
import { graphql as adminGraphql } from "@/graphql-system/admin";

const GetUser = graphql`query GetUser { user { id } }`;
```

**Rejected**: Requires separate imports per schema, leading to import proliferation and aliasing. Does not preserve the callback pattern required by the intermediate module system.

### Tagged template: Separate `graphql` identifier (Pattern B)

```typescript
import { graphql } from "@/graphql-system";

const GetUser = graphql.default`query GetUser { user { id } }`;
```

**Rejected**: Introduces a separate `graphql` identifier that doesn't integrate with the existing `gql.{schemaName}(callback)` API. Does not preserve the callback requirement.

### Fragment variables via Relay-style directives

```graphql
fragment UserFields on User
  @argumentDefinitions(showEmail: { type: "Boolean", defaultValue: false }) {
  id
  email @include(if: $showEmail)
}
```

**Rejected**: Verbose syntax. Type names must be written as strings (`"Boolean"` instead of `Boolean`). The Fragment Arguments RFC syntax is cleaner and has a path to standardization.

### Fragment variables via TypeScript API (callback metadata)

```typescript
const UserFields = gql.default(({ fragment, $var }) => fragment`
  fragment UserFields on User { ... }
`({
  variables: { showEmail: $var("showEmail").Boolean() },
}));
```

**Rejected**: Splits variable declarations between GraphQL (usage via `$showEmail`) and TypeScript (declaration via `$var`). Fragment Arguments RFC syntax keeps everything in GraphQL, making the code self-contained and enabling LSP validation of the complete fragment definition.

### LSP: Wrap graphql-language-service-server

Use `graphql-language-service-server`'s `startServer()` with custom `parseDocument` for tagged template extraction.

**Rejected**: Forces dependency on `graphql-config` for schema management, creating config duplication with `soda-gql.config.ts`. The hybrid approach gets the same completion/diagnostics quality by using the interface layer directly, without the server-layer constraints.

### LSP: Full from-scratch implementation

Use only `vscode-languageserver` + `graphql-js`, implementing all completion/diagnostics/hover logic from scratch.

**Rejected**: The `graphql-language-service` interface layer provides stateless, battle-tested algorithms. Reimplementing from scratch would be significant effort with no architectural benefit.

### TypeScript Language Service Plugin

Build as a TS plugin (like `@0no-co/graphqlsp`) instead of a standalone LSP server.

**Rejected**: TypeScript 7 (tsgo/Corsa) drops Language Service Plugin support. This approach has no future.

### Enhanced `.graphqlrc.yaml` with path-based routing

**Rejected**: Fundamentally implicit — schema association depends on directory structure, not explicit declaration.

### Comment-based schema directives in `.graphql` files

```graphql
# @soda-gql schema: admin
query GetAdmin { ... }
```

**Rejected**: Comments are not first-class constructs. Easy to forget, no compile-time validation.

## Open Questions (Resolved)

### Type inference strategy → Option C: No type inference

How should tagged templates provide TypeScript types?

- **Option A**: Codegen-generated `TypedDocumentNode` (like graphql-codegen client-preset)
- **Option B**: Build-time type inference via the builder plugin (preserving soda-gql's `$infer` pattern)
- **Option C**: No type inference from tagged templates (users choose callback API for type safety)

**Decision**: Option C. soda-gql already provides type safety through the callback API with `$infer`. Tagged templates serve IDE ergonomics (completion, diagnostics, hover), not type inference. Adding a second type inference path adds complexity with no clear payoff at the pre-release stage. This can be revisited post-1.0 if users request it.

### Fragment cross-file resolution → Option A: Import tracking

When a tagged template references a fragment defined in another file:

```typescript
// fragments.ts
export const UserFields = gql.default(({ fragment }) => fragment`
  fragment UserFields on User { id name }
`);

// queries.ts
import { UserFields } from "./fragments";
const GetUser = gql.default(({ query }) => query`
  query GetUser { user { ...UserFields } }
`);
```

How should the LSP resolve `...UserFields`?
- **Option A**: Follow TypeScript imports to find fragment definitions
- **Option B**: Workspace-wide scan for all fragment definitions
- **Option C**: Hybrid (follow imports first, fall back to workspace scan)

**Decision**: Option A. The LSP follows TypeScript import declarations to find fragment definitions. SWC parses import statements and resolves relative paths to locate imported files. This approach is explicit and predictable — fragments are resolved through the same dependency graph that TypeScript uses. The MVP supports relative path imports; tsconfig paths and barrel re-exports are deferred to future enhancements.

### Schema reload strategy → Option A: File watcher with auto-reload

When schema files change during development:
- **Option A**: File watcher with auto-reload
- **Option B**: Manual reload via editor command
- **Option C**: Both (auto-reload with manual override)

**Decision**: Option A. Already implemented in the MVP via `onDidChangeWatchedFiles` in `server.ts`. The LSP watches `.graphql` files for changes and automatically reloads schemas, then re-publishes diagnostics for all open documents.

## References

### soda-gql internals
- Config types: `packages/config/src/types.ts`
- GQL composer: `packages/core/src/composer/gql-composer.ts`
- GraphQL compat emitter: `packages/codegen/src/graphql-compat/emitter.ts`
- Builder flow: `docs/guides/builder-flow.md`

### GraphQL ecosystem
- [graphql-language-service-server](https://github.com/graphql/graphiql/tree/main/packages/graphql-language-service-server)
- [graphql-language-service (interface)](https://github.com/graphql/graphiql/tree/main/packages/graphql-language-service)
- [Fragment Arguments RFC (graphql-spec #1081)](https://github.com/graphql/graphql-spec/pull/1081)
- [graphql-tag-pluck](https://the-guild.dev/graphql/tools/docs/graphql-tag-pluck)
- [@0no-co/GraphQLSP](https://github.com/0no-co/GraphQLSP)
- [gql.tada multi-schema mode](https://gql-tada.0no.co/devlog/2024-04-26)

### LSP protocol
- [LSP Specification](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/)
- [vscode-languageserver-node](https://github.com/microsoft/vscode-languageserver-node)

### TypeScript future
- [typescript-go](https://github.com/microsoft/typescript-go)
- [Transformer Plugin issue #516](https://github.com/microsoft/typescript-go/issues/516) (removed)
- [Progress on TypeScript 7 - December 2025](https://devblogs.microsoft.com/typescript/progress-on-typescript-7-december-2025/)

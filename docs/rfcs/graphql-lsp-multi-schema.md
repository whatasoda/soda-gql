# RFC: GraphQL LSP with Multi-Schema Support

## Status

**Draft** - Design in progress

## Summary

This RFC proposes building an independent GraphQL Language Server Protocol (LSP) implementation for soda-gql that provides IDE features (autocomplete, diagnostics, hover) for GraphQL operations written as tagged template literals in TypeScript files. Unlike traditional `.graphqlrc.yaml` path-based schema routing, this approach uses explicit schema association through import paths or tag names, solving multi-schema conflicts while maintaining soda-gql's zero-runtime philosophy.

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

Tagged template literals provide a natural syntax for embedding GraphQL in TypeScript:

```typescript
import { graphql } from "@/graphql-system/default";

const GetUser = graphql`
  query GetUser($id: ID!) {
    user(id: $id) {
      id
      name
      email
    }
  }
`;
```

Advantages:
- **Import path encodes the schema**: `@/graphql-system/default` vs `@/graphql-system/admin`
- **Industry-standard pattern**: Used by Apollo Client, urql, Relay, gql.tada
- **Parser-friendly**: LSP can extract GraphQL content from tagged templates via AST analysis
- **Syntax highlighting**: Editor extensions (e.g., vscode-graphql-syntax) already support GraphQL in tagged templates via TextMate grammar injection

## Design Decisions

### 4.1 Tagged Template API

The tagged template API coexists with the existing `gql.{schemaName}(callback)` composer API. Both styles produce the same build-time artifacts and runtime behavior.

#### API pattern candidates

**Pattern A: Schema-specific subpath imports**

```typescript
import { graphql } from "@/graphql-system/default";
import { graphql as adminGraphql } from "@/graphql-system/admin";

const GetUser = graphql`query GetUser($id: ID!) { user(id: $id) { id name } }`;
const GetAdmin = adminGraphql`query GetAdmin { admins { id } }`;
```

**Pattern B: Single import with member access**

```typescript
import { graphql } from "@/graphql-system";

const GetUser = graphql.default`query GetUser($id: ID!) { user(id: $id) { id name } }`;
const GetAdmin = graphql.admin`query GetAdmin { admins { id } }`;
```

**Pattern C: Extend existing `gql` with tagged template support**

```typescript
import { gql } from "@/graphql-system";

// Existing: callback style (unchanged)
const GetUser1 = gql.default(({ query, $var }) =>
  query.operation({
    name: "GetUser",
    variables: { ...$var("id").ID("!") },
    fields: ({ f, $ }) => ({
      ...f.user({ id: $.id })(({ f }) => ({
        id: true,
        name: true,
      })),
    }),
  })
);

// New: tagged template style
const GetUser2 = gql.default`
  query GetUser($id: ID!) {
    user(id: $id) { id name }
  }
`;
```

#### Comparison

| Aspect | Pattern A (subpath) | Pattern B (member) | Pattern C (gql extension) |
|--------|---------------------|--------------------|---------------------------|
| Tag recognition by `graphql-tag-pluck` | ✅ Supported via `modules` config (path + identifier) | ❌ `graphql.default` not supported. Custom parser required | ❌ `gql.default` not supported. Custom parser required |
| External tool compatibility | High (`graphql` is a standard identifier) | Low | Low |
| Integration with existing API | Clear separation (different import paths) | Two usage patterns from same import | Most natural, but ambiguity between `gql.default(callback)` and `` gql.default`tag` `` |
| Multi-schema explicitness | Explicit via import statement | Explicit via member name | Explicit via member name |

#### Decision criteria

- **If relying on external tools** (graphql-eslint, existing graphql-config ecosystem): **Pattern A** is the safest choice, as `graphql` is a universally recognized tag identifier.
- **If building a custom LSP** (which this RFC proposes): **Pattern C** provides the best DX by unifying the import and allowing both callback and tagged template styles through the same `gql.{schemaName}` interface. The custom LSP can recognize `gql.{schemaName}` as a tagged template tag regardless of external tool support.

The RFC presents both options. The final choice depends on how much weight is given to external tool compatibility vs. internal API cohesion.

#### Runtime behavior

```typescript
// Generated by codegen (in graphql-system output)
// Tagged template function signature:
export function graphql(
  strings: TemplateStringsArray,
  ...values: never[]  // Interpolation is prohibited
): TypedDocumentNode<unknown, unknown>;
```

Key constraints:
- **No interpolation**: `` graphql`...${expr}...` `` is a type error (`never[]` enforces this). Interpolation would break static analysis and LSP autocomplete.
- **Build-time extraction**: The builder plugin detects tagged templates via AST analysis and transforms them into the same artifact format as `gql.{schemaName}(callback)` calls.
- **Runtime transformation**: At build time, tagged templates are replaced with `createRuntimeOperation` / `createRuntimeFragment` calls (same codepath as existing API).

#### Type inference (Open Question)

Two approaches for type-safe results from tagged templates:

**Approach 1: Codegen-generated TypedDocumentNode** (graphql-codegen pattern)
```typescript
const GetUser = graphql`query GetUser($id: ID!) { user(id: $id) { id name } }`;
// Type: TypedDocumentNode<GetUserQuery, GetUserQueryVariables>
// Types generated by a separate codegen step
```

**Approach 2: soda-gql $infer pattern**
```typescript
const GetUser = gql.default`query GetUser($id: ID!) { user(id: $id) { id name } }`;
type Data = typeof GetUser.$infer.output;
type Vars = typeof GetUser.$infer.input;
// Types inferred from the tagged template content at build time
```

This decision is deferred to implementation phase. See [Open Questions](#open-questions).

### 4.2 Schema association mechanism

Schema association is resolved through import paths:

1. **Codegen generates per-schema subpaths**: `graphql-system/default/`, `graphql-system/admin/`
2. **LSP resolves imports to schema names**: When the LSP encounters a tagged template, it traces the tag function's import path back to a schema subpath
3. **Config provides the mapping**: The existing `schemas: Record<string, SchemaConfig>` in `soda-gql.config.ts` defines available schemas. The existing `graphqlSystemAliases` config (e.g., `["@/graphql-system"]`) provides alias resolution.

Resolution algorithm:
```
1. Find tagged template at cursor position
2. Trace tag identifier to its import declaration
3. Resolve import path (handle tsconfig paths aliases)
4. Match against config:
   - outdir + "/" + schemaName (e.g., "./graphql-system/default")
   - graphqlSystemAliases[i] + "/" + schemaName (e.g., "@/graphql-system/default")
5. Return matched schemaName, or report diagnostic if unresolved
```

### 4.3 LSP base: build vs. buy analysis

Three approaches were evaluated for the LSP server implementation:

#### Option 1: Wrap graphql-language-service-server

```
soda-gql LSP Server
├── startServer() from graphql-language-service-server
├── Custom parseDocument (tagged template extraction)
├── graphql-config integration (auto-generated .graphqlrc)
└── Multi-schema resolver (soda-gql.config.ts → project mapping)
```

**Extension points available**:
- `parseDocument`: Injectable custom parser for extracting GraphQL from `.ts` files
- `startServer({ method, loadConfigOptions, parser })`: Customizable parser and config loading
- `graphql-config` projects: Per-schema project isolation
- Babel-based parser (`src/parsers/babel.ts`) handles tag recognition with configurable tag names

**Pros**:
- Autocomplete (`getAutocompleteSuggestions`), diagnostics (`getDiagnostics`), hover, go-to-definition already implemented
- GraphQL spec-compliant validation
- Built-in `.graphql` file support
- Compatible with `graphql-config` ecosystem (graphql-eslint, etc.)

**Cons**:
- Forces dependency on `graphql-config` (soda-gql has its own config system)
- Multi-schema resolution depends on `graphql-config` projects mechanism — import path analysis still needs custom implementation
- Large dependency footprint (part of graphiql monorepo)
- Offset mapping (cursor position in TS file → position in GraphQL document) needs custom implementation regardless

#### Option 2: Full from-scratch (vscode-languageserver + graphql-js)

```
soda-gql LSP Server
├── vscode-languageserver (LSP protocol handling)
├── Custom TS parser (tagged template extraction)
├── graphql-js (parse, validate, buildSchema)
└── soda-gql config loader (reads soda-gql.config.ts directly)
```

**Pros**:
- Reads `soda-gql.config.ts` directly (no config duplication)
- Full control over multi-schema resolution
- Minimal dependency footprint
- Complete freedom in tagged template parsing (supports Pattern A/B/C)
- Can reuse soda-gql's existing TypeScript AST / SWC parsers

**Cons**:
- Must implement all LSP handlers (completion, hover, diagnostics, definition)
- Must implement GraphQL position calculation, error recovery
- Must implement `.graphql` file support from scratch
- Higher testing and maintenance burden

#### Option 3: Hybrid (recommended candidate)

```
soda-gql LSP Server
├── vscode-languageserver (LSP protocol handling)
├── graphql-language-service (completion/diagnostics/hover logic only)
│   └── getAutocompleteSuggestions(), getDiagnostics(), getHoverInformation()
├── Custom TS parser (tagged template extraction, import analysis)
├── soda-gql config loader (reads soda-gql.config.ts directly)
└── Schema resolver (import path → schema mapping)
```

Uses `graphql-language-service` (the **interface package**, not the server package) for the core GraphQL intelligence algorithms, but handles LSP protocol, config management, and file parsing independently.

**Pros**:
- Battle-tested completion and diagnostics algorithms (from interface layer)
- Reads `soda-gql.config.ts` directly (no `graphql-config` dependency)
- Full control over multi-schema resolution
- Freedom in tagged template parsing design
- Moderate dependency footprint (interface package only, not the full server)

**Cons**:
- Must implement LSP handlers (but simpler than from-scratch since core logic is borrowed)
- Must implement `.graphql` file support
- Depends on `graphql-language-service` interface package for updates

#### Comparison matrix

| Aspect | Option 1: Wrap server | Option 2: From scratch | Option 3: Hybrid |
|--------|-----------------------|------------------------|------------------|
| Initial implementation cost | Low | High | Medium |
| Completion/diagnostics quality | High (proven) | Needs implementation | High (interface layer) |
| Multi-schema control | Constrained by graphql-config | Full freedom | Full freedom |
| Config management | Requires graphql-config | soda-gql.config direct | soda-gql.config direct |
| Tagged template support | parseDocument customization | Custom parser | Custom parser |
| `.graphql` file support | Built-in | Custom implementation | Custom implementation |
| Dependency count | High | Minimal | Moderate |
| Long-term maintenance | Depends on upstream | Fully self-managed | Interface layer only |
| soda-gql-specific features | Constrained | Full freedom | Full freedom |

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
│   ├── document-manager.ts    # TS file parsing, tagged template extraction
│   ├── schema-resolver.ts     # Import path → schema name resolution
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

Dependencies (for hybrid approach):
- `vscode-languageserver` / `vscode-languageserver-textdocument`: LSP protocol
- `graphql-language-service`: Completion, diagnostics, hover algorithms
- `graphql`: Parsing and validation
- `@soda-gql/config`: Config loading
- `typescript` (or `@swc/core`): TS AST parsing for tagged template extraction

### Core components

#### Document Manager

Parses TypeScript files to extract tagged templates and their schema associations:

```typescript
type ExtractedTemplate = {
  /** Range within the TS file (for offset mapping) */
  range: { start: number; end: number };
  /** Resolved schema name */
  schemaName: string;
  /** Raw GraphQL content (without template tag) */
  content: string;
};

type DocumentState = {
  uri: string;
  version: number;
  templates: ExtractedTemplate[];
};
```

The document manager:
1. Parses the TypeScript file into an AST
2. Finds all tagged template expressions matching `gql.{name}` or `graphql` identifiers
3. Resolves the tag's import to a schema name via the schema resolver
4. Extracts the GraphQL string content
5. Caches results per document (invalidated on change)

#### Schema Resolver

Maps import paths to schema names using the soda-gql config:

```typescript
type SchemaEntry = {
  name: string;
  schema: GraphQLSchema;
  documentNode: DocumentNode;
  matchPaths: string[];  // All paths that resolve to this schema
};
```

Builds `matchPaths` from config:
- `{outdir}/{schemaName}` (e.g., `./graphql-system/default`)
- `{alias}/{schemaName}` for each `graphqlSystemAliases` entry (e.g., `@/graphql-system/default`)
- Handles tsconfig `paths` resolution if `tsconfigPath` is configured

#### Position Mapping

Converts between positions in the TypeScript file and positions within the GraphQL document:

```
TypeScript file:
  Line 5: const q = gql.default`
  Line 6:   query GetUser {    ← cursor at (6, 8)
  Line 7:     user { id }
  Line 8:   }
  Line 9: `;

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

- Implement `schema-resolver.ts`: import path → schema name resolution
- Extend config types if needed (e.g., per-schema `importPaths` overrides)
- Add `codegen lsp-config` CLI command to generate `.graphqlrc.generated.json`
- Unit tests for schema resolution with aliases and tsconfig paths

### Phase 1: LSP server core

- Set up `@soda-gql/lsp` package
- Implement document manager (TS AST → tagged template extraction)
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

All three styles can coexist in the same project:

```typescript
// Style 1: Callback composer (existing)
const q1 = gql.default(({ query }) => query.operation({ ... }));

// Style 2: Tagged template (new)
const q2 = gql.default`query GetUser { user { id } }`;

// Style 3: .graphql file with compat (existing)
// → auto-generated .compat.ts
```

## Alternatives Considered

### TypeScript Language Service Plugin

Build as a TS plugin (like `@0no-co/graphqlsp`) instead of a standalone LSP server.

**Rejected**: TypeScript 7 (tsgo/Corsa) drops Language Service Plugin support. This approach has no future.

### Enhanced `.graphqlrc.yaml` with path-based routing

Improve the existing `graphql-config` path-based approach with better DX.

**Rejected**: Fundamentally implicit — schema association depends on directory structure, not explicit declaration. Moving files silently breaks validation.

### Comment-based schema directives in `.graphql` files

```graphql
# @soda-gql schema: admin
query GetAdmin { ... }
```

**Rejected**: Comments are not first-class constructs. Easy to forget, no compile-time validation, requires custom tooling anyway.

### Multiple `graphqlCompat` config entries

```typescript
graphqlCompat: [
  { input: ["./src/default/**/*.graphql"], schema: "default" },
  { input: ["./src/admin/**/*.graphql"], schema: "admin" },
]
```

**Rejected**: This is the same path-based routing problem as `.graphqlrc.yaml`. Config embeds assumptions about directory structure.

### Separate file extensions (`.admin.graphql`)

Encode schema name in file extension.

**Rejected**: Poor scalability, clutters the file system, requires editor reconfiguration for each new schema.

## Open Questions

### Type inference strategy

How should tagged templates provide TypeScript types?

- **Option A**: Codegen-generated `TypedDocumentNode` (like graphql-codegen client-preset)
- **Option B**: Build-time type inference via the builder plugin (preserving soda-gql's `$infer` pattern)
- **Option C**: No type inference from tagged templates (users choose callback API for type safety)

### Fragment cross-file resolution

When a tagged template references a fragment defined in another file:

```typescript
// fragments.ts
export const UserFields = gql.default`fragment UserFields on User { id name }`;

// queries.ts
import { UserFields } from "./fragments";
const GetUser = gql.default`query GetUser { user { ...UserFields } }`;
```

How should the LSP resolve `...UserFields`?
- **Option A**: Follow TypeScript imports to find fragment definitions
- **Option B**: Workspace-wide scan for all fragment definitions
- **Option C**: Hybrid (follow imports first, fall back to workspace scan)

### Schema reload strategy

When schema files change during development:
- **Option A**: File watcher with auto-reload
- **Option B**: Manual reload via editor command
- **Option C**: Both (auto-reload with manual override)

## References

### soda-gql internals
- Config types: `packages/config/src/types.ts`
- GQL composer: `packages/core/src/composer/gql-composer.ts`
- GraphQL compat emitter: `packages/codegen/src/graphql-compat/emitter.ts`
- Builder flow: `docs/guides/builder-flow.md`

### GraphQL ecosystem
- [graphql-language-service-server](https://github.com/graphql/graphiql/tree/main/packages/graphql-language-service-server)
- [graphql-language-service (interface)](https://github.com/graphql/graphiql/tree/main/packages/graphql-language-service)
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

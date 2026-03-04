# @soda-gql/lsp

GraphQL Language Server Protocol (LSP) implementation for soda-gql. Provides real-time diagnostics, completions, hover information, and other IDE features for soda-gql tagged template queries.

## Features

- **Diagnostics** — Real-time validation of GraphQL field selections against your schema
- **Completion** — Field name suggestions based on parent type and schema
- **Hover** — Type information for fields, arguments, and variables
- **Go to Definition** — Navigate to fragment definitions and schema type locations
- **Find References** — Locate all usages of a fragment across the workspace
- **Rename** — Rename fragment definitions and all their spread references
- **Document Formatting** — Format GraphQL content within tagged templates
- **Document Symbols** — Outline view of queries, mutations, and fragments in a file
- **Code Actions** — Extract selections into fragments
- **Multi-schema** — Supports multiple GraphQL schemas in a single project
- **Monorepo multi-config** — Discovers and loads multiple `soda-gql.config.ts` files across workspace folders

## Installation

```bash
bun add @soda-gql/lsp
```

## Usage

### Standalone CLI

Run the LSP server directly via the bundled binary:

```bash
npx soda-gql-lsp --stdio
```

### Programmatic API

```typescript
import { createLspServer } from "@soda-gql/lsp";

const server = createLspServer();
server.start();
```

Pass a custom connection for testing or embedding:

```typescript
import { createConnection, ProposedFeatures } from "vscode-languageserver/node";
import { createLspServer } from "@soda-gql/lsp";

const connection = createConnection(ProposedFeatures.all);
const server = createLspServer({ connection });
server.start();
```

## Supported Editors

- **VS Code / Cursor** — Via the [soda-gql VS Code extension](../vscode-extension)
- **Any LSP-compatible editor** — Neovim, Emacs, Sublime Text, etc. using the standalone CLI

## Related Packages

- [@soda-gql/core](../core) — Core GraphQL query generation
- [soda-gql-vscode-extension](../vscode-extension) — VS Code extension with syntax highlighting and LSP integration
- [@soda-gql/builder](../builder) — Build-time transformation pipeline

## Guides

- [LSP-Integrated Development Workflow](../../docs/guides/lsp-workflow.md) — How to use the LSP for daily development
- [Tagged Template Syntax Guide](../../docs/guides/tagged-template-syntax.md) — Syntax reference for tagged templates

## License

MIT

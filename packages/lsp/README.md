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

## Claude Code Integration

soda-gql LSP integrates with [Claude Code](https://claude.com/claude-code) as a plugin, providing GraphQL diagnostics, completion, and code intelligence directly in the AI coding assistant.

### How it works

The integration uses a separate **proxy package** ([`@soda-gql/protocol-proxy`](../protocol-proxy)) that resolves the project-local `@soda-gql/lsp` at runtime. This ensures version consistency between the LSP server and the project's soda-gql dependencies — similar to how `typescript-language-server` delegates to the project-local TypeScript.

### Setup for users

1. Install the proxy binary globally:

```bash
npm install -g @soda-gql/protocol-proxy
```

2. Ensure `@soda-gql/lsp` is a project dependency (the proxy resolves it from `node_modules`):

```bash
bun add -D @soda-gql/lsp
```

3. The Claude Code plugin is defined in the project's `.claude-plugin/marketplace.json`. Install it via `/plugin` in Claude Code and restart the session.

### Setup for monorepo contributors

1. Build the packages:

```bash
bun run build
```

2. Link the proxy package globally:

```bash
cd packages/protocol-proxy && bun link
```

3. Install the plugin via `/plugin` in Claude Code, then restart.

### Coexistence with TypeScript LSP

Both soda-gql LSP and the TypeScript LSP plugin can be active simultaneously on `.ts`/`.tsx` files. The TypeScript LSP provides type checking, while soda-gql LSP provides GraphQL-specific intelligence within tagged templates and callback builders.

## Supported Editors

- **Claude Code** — Via the soda-gql plugin (see above)
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

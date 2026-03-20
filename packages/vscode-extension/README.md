# soda-gql VS Code Extension

VS Code extension for soda-gql that provides GraphQL language support for tagged template literals. Includes syntax highlighting, real-time diagnostics, completions, and other IDE features powered by the [@soda-gql/lsp](../lsp) language server.

## Features

- **Syntax Highlighting** — GraphQL syntax highlighting inside tagged template literals
- **Real-time Diagnostics** — Validates field selections against your GraphQL schema
- **Field Completion** — Suggests fields, arguments, and types based on schema context
- **Hover Information** — Shows type details for fields and arguments
- **Go to Definition** — Navigate to fragment definitions and schema types
- **Find References** — Locate all usages of a fragment across the workspace
- **Rename** — Rename fragments and update all references
- **Document Formatting** — Format GraphQL content within templates
- **Code Actions** — Extract field selections into fragments

## Requirements

- A soda-gql project with a `soda-gql.config.ts` configuration file
- `@soda-gql/lsp` installed in your project (the extension resolves it at runtime for version consistency)
- `@soda-gql/builder` installed in your project (provides `@swc/core` for template extraction)
- VS Code 1.90.0 or later (also works with Cursor)

## Installation

Install from a `.vsix` file:

```bash
code --install-extension soda-gql.vsix
```

Or for Cursor:

```bash
cursor --install-extension soda-gql.vsix
```

## Getting Started

1. Ensure your project has a `soda-gql.config.ts` (at the workspace root or in a nested package for monorepos)
2. Install the extension
3. Open a TypeScript file containing soda-gql tagged templates
4. The LSP server starts automatically and provides diagnostics, completions, and hover

> **Note:** The extension requires workspace trust for LSP features. In untrusted workspaces, only syntax highlighting is available.

## Supported Syntax

The extension recognizes soda-gql tagged template patterns:

```typescript
import { gql } from "@/graphql-system";

export const GetUser = gql.default(({ query }) =>
  query("GetUser")`($id: ID!) {
    user(id: $id) {
      id
      name
      email
    }
  }`()
);
```

## Troubleshooting

### "@swc/core not found" Error

The LSP server requires `@swc/core` to parse TypeScript files. This is provided as a transitive dependency of `@soda-gql/builder`. Ensure it is installed:

```bash
bun add @soda-gql/builder
```

### "@soda-gql/lsp not found" Error

The extension resolves the LSP server from your project's dependencies at runtime. Install it as a project dependency:

```bash
bun add @soda-gql/lsp
```

### No Diagnostics or Completions

1. Check that `soda-gql.config.ts` exists in your workspace root
2. Verify your GraphQL schema files are accessible at the paths configured in the config
3. Check the Output panel (View > Output > soda-gql) for error messages

## Related Packages

- [@soda-gql/lsp](../lsp) — The language server that powers this extension
- [@soda-gql/core](../core) — Core GraphQL query generation
- [@soda-gql/builder](../builder) — Build-time transformation pipeline

## License

MIT

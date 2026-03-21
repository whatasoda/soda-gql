# @soda-gql/protocol-proxy

Thin proxy binary for integrating soda-gql's LSP server with [Claude Code](https://claude.com/claude-code).

## What it does

`@soda-gql/protocol-proxy` resolves the project-local `@soda-gql/lsp` package at runtime, similar to how `typescript-language-server` delegates to the project-local TypeScript. This ensures version consistency between the server and your project's soda-gql dependencies.

### Binaries

- **`soda-gql-lsp-proxy`** — LSP proxy. Handles the LSP connection and `initialize` handshake, then delegates all language features to project-local `@soda-gql/lsp`.

## Installation

```bash
npm install -g @soda-gql/protocol-proxy
```

Your project must also have `@soda-gql/lsp` as a dependency:

```bash
bun add -D @soda-gql/lsp
```

## Claude Code Plugin

The proxy binary is configured in the soda-gql Claude Code plugin:
- LSP server via `.claude-plugin/marketplace.json`

After installing the plugin via `/plugin` in Claude Code, restart the session to activate.

## Related Packages

- [@soda-gql/lsp](../lsp) — Full LSP server with all language features
- [@soda-gql/core](../core) — Core GraphQL query generation

## License

MIT

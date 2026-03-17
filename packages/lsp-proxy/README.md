# @soda-gql/lsp-proxy

Thin proxy binary for integrating soda-gql's GraphQL LSP with [Claude Code](https://claude.com/claude-code).

## What it does

`soda-gql-lsp-proxy` resolves the project-local `@soda-gql/lsp` package at runtime, similar to how `typescript-language-server` delegates to the project-local TypeScript. This ensures version consistency between the LSP server and your project's soda-gql dependencies.

The proxy handles only the LSP connection and `initialize` handshake. All language features (diagnostics, completion, hover, etc.) are provided by the project-local `@soda-gql/lsp`.

## Installation

```bash
npm install -g @soda-gql/lsp-proxy
```

Your project must also have `@soda-gql/lsp` as a dependency:

```bash
bun add -D @soda-gql/lsp
```

## Claude Code Plugin

The proxy is configured as an LSP server in the soda-gql Claude Code plugin via `.claude-plugin/marketplace.json`. After installing the plugin via `/plugin` in Claude Code, restart the session to activate the LSP server.

## Related Packages

- [@soda-gql/lsp](../lsp) — Full LSP server with all language features
- [@soda-gql/core](../core) — Core GraphQL query generation

## License

MIT

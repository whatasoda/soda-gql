# @soda-gql/protocol-proxy

Thin proxy binaries for integrating soda-gql's LSP and MCP servers with [Claude Code](https://claude.com/claude-code).

## What it does

`@soda-gql/protocol-proxy` resolves the project-local `@soda-gql/lsp` package at runtime, similar to how `typescript-language-server` delegates to the project-local TypeScript. This ensures version consistency between the servers and your project's soda-gql dependencies.

### Binaries

- **`soda-gql-lsp-proxy`** — LSP proxy. Handles the LSP connection and `initialize` handshake, then delegates all language features to project-local `@soda-gql/lsp`.
- **`soda-gql-mcp-proxy`** — MCP proxy. Resolves project-local `@soda-gql/lsp` and starts its MCP server, exposing GraphQL intelligence as MCP tools for Claude Code.

## Installation

```bash
npm install -g @soda-gql/protocol-proxy
```

Your project must also have `@soda-gql/lsp` as a dependency:

```bash
bun add -D @soda-gql/lsp
```

## Claude Code Plugin

The proxy binaries are configured in the soda-gql Claude Code plugin:
- LSP server via `.claude-plugin/marketplace.json`
- MCP server via `claude-code-plugin/.mcp.json`

After installing the plugin via `/plugin` in Claude Code, restart the session to activate.

## Related Packages

- [@soda-gql/lsp](../lsp) — Full LSP and MCP server with all language features
- [@soda-gql/core](../core) — Core GraphQL query generation

## License

MIT

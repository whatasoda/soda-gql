# Claude Code Plugin

soda-gql provides a [Claude Code](https://claude.com/claude-code) plugin with specialized skills for GraphQL development. The plugin understands your schema and project configuration, enabling AI-assisted code generation, diagnostics, and exploration.

## Installation

Register the marketplace and install the plugin:

```bash
claude plugin marketplace add whatasoda/soda-gql-skills
claude plugin install soda-gql-skills@soda-gql-skills
```

Restart your Claude Code session to activate the skills.

## Available Skills

| Skill | Description | Example |
|-------|-------------|---------|
| `/gql:codegen` | Generate GraphQL system from schema | `/gql:codegen` |
| `/gql:scaffold` | Generate fragments and operations from schema | `/gql:scaffold get user profile with posts` |
| `/gql:doctor` | Run diagnostics and health checks | `/gql:doctor` |
| `/gql:inspect` | Inspect fragments and operations via LSP | `/gql:inspect src/graphql/fragments.ts` |
| `/gql:guide` | API documentation and examples | `/gql:guide tagged-template` |

### `/gql:codegen` — Generate GraphQL System

Runs `soda-gql codegen schema` to generate type-safe GraphQL system files from your schema. Optionally runs typegen and type checking for validation.

**When to use**: Initial project setup, after modifying your schema, or when you see type errors related to GraphQL types.

### `/gql:scaffold` — Generate Fragments and Operations

Generates type-safe GraphQL fragments and operations with intelligent syntax selection. Automatically chooses between tagged template and callback builder syntax based on what you need.

**When to use**: Creating new queries, mutations, or reusable fragment definitions.

### `/gql:doctor` — Diagnostics and Health Checks

Runs comprehensive checks: version consistency, duplicate packages, config validation, codegen freshness, typegen, type checking, and formatting. Offers automated fixes for identified issues.

**When to use**: Debugging build or type errors, before committing changes, after upgrading packages.

### `/gql:inspect` — Inspect GraphQL Symbols

Lists all GraphQL symbols (fragments, operations) in a file with their types and line numbers. Runs LSP diagnostics to detect field errors, type mismatches, and unused fragments.

**When to use**: Exploring GraphQL definitions in a file, checking for errors, looking up schema type details.

### `/gql:guide` — Documentation and Examples

Provides topic-based guidance and code examples. Topics include: `tagged-template`, `fragment`, `operation`, `union`, `directive`, `metadata`, `setup`, `lsp`, `codegen`, `colocation`.

**When to use**: Learning soda-gql features, understanding syntax patterns, finding code examples.

## Prerequisites

- [Claude Code](https://claude.com/claude-code) installed
- Bun runtime available
- A soda-gql project with `soda-gql.config.{ts,js,mjs}`

## Further Reading

- [Plugin README](https://github.com/whatasoda/soda-gql-skills) for full documentation and troubleshooting
- [Getting Started](/guide/getting-started) for initial project setup

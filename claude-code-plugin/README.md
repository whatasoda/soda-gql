# soda-gql Claude Code Plugin

A Claude Code marketplace plugin that provides developer skills for working with soda-gql projects, including code generation, diagnostics, scaffolding, and API guidance.

## Overview

This plugin enhances the Claude Code experience for soda-gql developers by providing specialized skills that understand your GraphQL schema and project configuration. The plugin works for both external users (via `node_modules`) and monorepo contributors (via workspace links) through a dual module resolution pattern.

## Installation

### For External Users

1. **Install soda-gql in your project:**

```bash
bun add @soda-gql/core @soda-gql/runtime
bun add -D @soda-gql/cli @soda-gql/config
```

2. **Enable the marketplace plugin in Claude Code:**

The plugin is distributed as part of the soda-gql repository. Claude Code will automatically detect the `.claude-plugin/marketplace.json` file and make the skills available when you work in a soda-gql project.

### For Monorepo Contributors

The plugin is already available when working in the soda-gql monorepo. All skills work out of the box via workspace package links.

## Prerequisites

- **Bun installed**: All scripts and commands use Bun as the runtime
- **soda-gql project**: You must have a `soda-gql.config.{ts,js,mjs}` file in your project root
- **Dependencies installed**: Run `bun install` to ensure all packages are available

## Available Skills

### `/gql:codegen` - Generate GraphQL System from Schema

Generates the GraphQL system files from your schema using the `soda-gql codegen schema` command.

**What it does:**
- Detects your project configuration
- Runs `bun run soda-gql codegen schema` to generate GraphQL system files
- Optionally runs `bun run soda-gql typegen` to generate prebuilt types
- Validates results with `bun typecheck`
- Reports errors and suggests fixes

**When to use:**
- Initial project setup after creating your schema file
- After modifying your GraphQL schema
- When you see type errors related to GraphQL types

**Example:**
```
/gql:codegen
```

### `/gql:scaffold` - Generate GraphQL Fragments and Operations

Generates type-safe GraphQL fragments and operations from your schema with intelligent syntax selection.

**What it does:**
- Reads your GraphQL schema files
- Asks what you want to query
- Intelligently chooses between tagged template and callback builder syntax
- Generates code with proper imports and type safety
- Validates the generated code with `bun run soda-gql typegen` and `bun typecheck`
- Retries up to 3 times on errors

**Syntax selection (automatic):**
- **Tagged template** (`fragment\`...\``, `query\`...\``) for simple fragments and operations
- **Callback builder** (`.fragment({...})`, `.operation({...})`) when you need:
  - Fragment spreads in operations (`...fragment.spread()`)
  - Field aliases
  - `$colocate` metadata
  - Fragment metadata callbacks

**When to use:**
- Creating new GraphQL queries or mutations
- Building reusable fragment definitions
- Need help understanding which syntax to use

**Example:**
```
/gql:scaffold get user profile with posts
```

### `/gql:doctor` - Run Diagnostics and Health Checks

Runs comprehensive diagnostics on your soda-gql project and offers automated fixes.

**What it does:**
- Runs `bun run soda-gql doctor` for core checks:
  - version-consistency: Verifies all `@soda-gql/*` packages are on the same version
  - duplicate-packages: Detects duplicate package installations
  - config-validation: Validates your `soda-gql.config.{ts,js,mjs}` file
  - codegen-freshness: Checks if generated files are up-to-date with schema
- Runs extended checks:
  - `bun run soda-gql typegen` for template validation
  - `bun typecheck` for type errors
  - `bun run soda-gql format --check` for formatting issues
- Presents actionable fix suggestions for each issue
- Offers to auto-fix problems (codegen, formatting, etc.)

**When to use:**
- Debugging build or type errors
- Before committing changes
- After upgrading soda-gql packages
- When you suspect configuration issues

**Example:**
```
/gql:doctor
```

### `/gql:guide` - API Documentation and Examples

Provides topic-based guidance and code examples for soda-gql features.

**Topics covered:**
- `tagged-template`: Tagged template syntax for fragments and operations
- `fragment`: Fragment definition and composition
- `operation`: Query, mutation, and subscription operations
- `union`: Union type handling and member selection
- `directive`: GraphQL directive usage (`@include`, `@skip`)
- `metadata`: Fragment metadata and `$colocate` functionality
- `setup`: Initial project configuration
- `lsp`: LSP integration and VS Code extension
- `codegen`: Code generation workflow
- `colocation`: Fragment-level data colocation patterns

**What it provides:**
- Links to relevant playground examples and documentation
- References to playground examples (`playgrounds/vite-react/src/graphql/*.ts`)
- Tagged-template vs callback-builder decision tree
- Code examples for common patterns

**When to use:**
- Learning soda-gql features
- Understanding when to use different syntax patterns
- Finding code examples
- Looking up API documentation

**Example:**
```
/gql:guide tagged-template
/gql:guide How do I handle union types?
```

## Dual Module Resolution

The plugin scripts use a `bun -e` pattern that allows them to work in both environments:

**For external users**: `@soda-gql/*` packages are resolved from `node_modules/` in your project directory.

**For contributors**: `@soda-gql/*` packages are resolved via workspace links defined in the monorepo root.

This pattern is implemented by running inline scripts from the project's `cwd`:

```typescript
const INLINE_SCRIPT = `
  const { loadConfig } = await import('@soda-gql/config');
  // ... code that needs @soda-gql packages
`;

const result = Bun.spawnSync({
  cmd: ['bun', '-e', INLINE_SCRIPT],
  cwd: process.cwd(),  // Resolves from user's project directory
  // ...
});
```

## Troubleshooting

### `detect-project.ts` reports "No soda-gql project found"

**Possible causes:**
1. Not running from a directory with `soda-gql.config.{ts,js,mjs}`
2. Dependencies not installed (`bun install` not run)
3. Config file has syntax errors

**Solutions:**
- Verify you're in the correct directory: `ls soda-gql.config.*`
- Run `bun install` to ensure dependencies are available
- Check config file syntax: `bun run soda-gql doctor`
- See [Getting Started](../README.md#quick-start) for initial setup

### `validate-templates.ts` fails with import errors

**Possible causes:**
1. LSP package (`@soda-gql/lsp`) not installed
2. Running from wrong directory
3. Config file not found

**Solutions:**
- The script falls back to CLI validation when LSP is unavailable
- Ensure you're running from your project root
- Run `bun install` to install all dependencies
- Check CLI fallback output for detailed error messages

### Skills don't appear in Claude Code

**Possible causes:**
1. Marketplace plugin not detected
2. SKILL.md files have invalid YAML frontmatter
3. Plugin directory structure incorrect

**Solutions:**
- Verify `.claude-plugin/marketplace.json` exists at repo root
- Validate YAML frontmatter: `python3 -m json.tool < .claude-plugin/marketplace.json`
- Check plugin structure: `ls -R claude-code-plugin/skills/`
- Restart Claude Code to refresh plugin detection

### Type errors after code generation

**Possible causes:**
1. Generated files out of sync with schema
2. Missing or incorrect inject file
3. Schema file has errors

**Solutions:**
- Run `/gql:codegen` to regenerate GraphQL system
- Check that inject file exists and exports required scalars
- Validate schema file syntax (should be valid GraphQL SDL)
- Run `/gql:doctor` for comprehensive diagnostics

### Template validation errors (unknown fields)

**Possible causes:**
1. Field name typo
2. Schema not up-to-date
3. Using field from wrong type

**Solutions:**
- Check field name spelling against schema
- Regenerate GraphQL system: `/gql:codegen`
- Verify you're querying the correct type
- Use `/gql:scaffold` to generate valid code from schema

## Links to Main Documentation

### User Guides
- [Main README](../README.md) - Project overview and quick start
- [Config Package README](../packages/config/README.md) - Configuration API

### Examples
- [Vite React Playground](../playgrounds/vite-react/) - Complete example project
  - [Fragments](../playgrounds/vite-react/src/graphql/fragments.ts) - Fragment examples
  - [Operations](../playgrounds/vite-react/src/graphql/operations.ts) - Operation examples
  - [Callback Builder Features](../playgrounds/vite-react/src/graphql/callback-builder-features.ts) - Advanced patterns
  - [Fragment Spread Patterns](../playgrounds/vite-react/src/graphql/fragment-spread-patterns.md) - Spreading documentation

## Plugin Development

This plugin is maintained as part of the soda-gql monorepo. Contributions are welcome!

**Directory structure:**
```
claude-code-plugin/
├── .claude-plugin/
│   └── plugin.json          # Plugin metadata
├── package.json             # Plugin package.json
├── scripts/
│   ├── detect-project.ts    # Project detection script
│   └── validate-templates.ts # LSP-based template validation
└── skills/
    ├── gql-codegen/
    │   └── SKILL.md         # Codegen skill definition
    ├── gql-doctor/
    │   └── SKILL.md         # Doctor skill definition
    ├── gql-guide/
    │   └── SKILL.md         # Guide skill definition
    └── gql-scaffold/
        └── SKILL.md         # Scaffold skill definition
```

**Testing changes:**
1. Modify skill or script files
2. Test from repo root: `bun claude-code-plugin/scripts/detect-project.ts`
3. Test from playground: `cd playgrounds/vite-react && bun ../../claude-code-plugin/scripts/detect-project.ts`
4. Verify skills work in Claude Code

## License

MIT - See [LICENSE](../LICENSE) for details.

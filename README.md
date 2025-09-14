# @soda-gql - Zero-runtime GraphQL Query Generation

A zero-runtime GraphQL query generation system that brings PandaCSS's approach to GraphQL. Write type-safe queries in TypeScript that are statically analyzed and transformed at build time into optimized GraphQL documents.

## Features

- 🚀 **Zero Runtime Overhead**: All GraphQL queries are generated at build time
- 🔍 **Full Type Safety**: Complete TypeScript inference from schema to query results
- 🎯 **No Code Generation Loop**: Unlike traditional GraphQL codegen, no constant regeneration needed
- 🔧 **Transform Functions**: Built-in data normalization at the model level
- 📦 **Modular Architecture**: Compose queries from reusable models
- ⚡ **Instant Feedback**: Type errors appear immediately in your IDE

## Project Structure

```
packages/
├── core/           # Runtime GraphQL utilities
├── codegen/        # Schema code generation  
├── builder/        # Static analysis & doc generation
├── plugin-babel/   # Babel transformation plugin
├── plugin-bun/     # Bun plugin
└── cli/            # Command-line interface
```

## Quick Start

### For Users

```bash
# Install packages
bun add @soda-gql/core
bun add -D @soda-gql/cli @soda-gql/plugin-babel

# Initialize project
bunx soda-gql init

# Generate GraphQL system from schema
bunx soda-gql generate
```

### Basic Example

```typescript
import { gql } from "@/graphql-system";

// Define a reusable model
const userModel = gql.model(
  "User",
  ({ fields }) => ({
    ...fields.id(),
    ...fields.name(),
    ...fields.email(),
  }),
  (data) => ({
    id: data.id,
    displayName: data.name,
    email: data.email.toLowerCase(),
  })
);

// Create a query
const getUserQuery = gql.query(
  ["GetUser", { id: gql.input.scalar("ID", "!") }],
  ({ query, variables }) => ({
    user: query.user({ id: variables.id }, userModel),
  }),
  (data) => data.user
);
```

### For Contributors

```bash
# Install dependencies
bun install

# Run tests
bun test

# Type check all packages
bun typecheck

# Run quality checks (Biome + TypeScript)
bun quality
```

## Development

This is a monorepo using Bun workspaces. Each package is independently versioned and can be developed in isolation.

### Available Scripts

- `bun quality` - Run Biome linting/formatting and TypeScript checks
- `bun typecheck` - Type check all packages
- `bun biome:check` - Run Biome with auto-fix

### Testing Approach

We follow TDD (Test-Driven Development) with the t_wada methodology:
1. Write test first (RED phase)
2. Make it pass (GREEN phase)
3. Refactor (REFACTOR phase)

### Code Conventions

- **TypeScript**: Strict mode enabled, no `any` types
- **Error Handling**: Using `neverthrow` for type-safe Results
- **Validation**: Using `zod` v4 for external data validation
- **Formatting**: Biome v2 with automatic import sorting

## Implementation Status

### Phase 1: Type System Foundation ✅
- [x] GraphqlSchema type system (schema.ts)
- [x] Document structure types (document.ts)
- [x] Model API interface (model.ts)
- [x] Type inference utilities

### Phase 2: Codegen - Schema Parser 🚧
- [ ] GraphQL schema file parsing
- [ ] GraphqlSchema object generation
- [ ] TypeScript code generation with factories

### Phase 3: Core Implementation
- [ ] gql.model() function implementation
- [ ] gql.inlineModel() function
- [ ] Query/mutation builders
- [ ] Document generation from models

### Phase 4: Codegen - gql Instance
- [ ] graphql-system directory structure
- [ ] Configured gql instance export
- [ ] Type inference helpers

### Phase 5: Builder - Static Analysis
- [ ] TypeScript AST analysis
- [ ] Model extraction from source
- [ ] Document optimization

### Phase 6: Plugin Integration
- [ ] Babel plugin for transformation
- [ ] Zero-runtime code generation
- [ ] Source map support

### Phase 7: CLI & DevEx
- [ ] init, generate, watch commands
- [ ] Configuration management
- [ ] Error reporting with context

## License

MIT
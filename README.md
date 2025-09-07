# soda-gql

Zero-runtime GraphQL query generation system similar to PandaCSS's CSS-in-JS approach. Write GraphQL queries in TypeScript with full type safety, which are then statically analyzed and transformed at build time into optimized GraphQL documents.

## Features

- 🚀 **Zero Runtime Overhead**: All transformations happen at build time
- 🔒 **Full Type Safety**: Complete TypeScript inference without code generation loops
- 🔧 **Build Tool Agnostic**: Works with Babel, Bun, Vite, and more
- 🎯 **Smart Composition**: Cross-module query composition with automatic deduplication
- ⚡ **Developer Experience**: Instant type feedback during development

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

### Phase A: Runtime Implementation ✅
- [x] Project setup with Bun workspaces
- [x] TypeScript configuration
- [x] Biome v2 for linting/formatting
- [x] Core dependencies installed
- [ ] Type definitions (RemoteModel, QuerySlice, etc.)
- [ ] createGql factory function
- [ ] Runtime document generation

### Phase B: Code Generation System
- [ ] GraphQL schema parsing
- [ ] TypeScript type generation
- [ ] graphql-system directory generation

### Phase C: Static Analysis & Builder
- [ ] AST analysis with TypeScript Compiler API
- [ ] Dependency resolution
- [ ] Executable code generation

### Phase D: Build Tool Integration
- [ ] Babel plugin implementation
- [ ] Bun plugin implementation
- [ ] Code transformation

### Phase E: CLI & Developer Experience
- [ ] CLI commands (init, generate, check)
- [ ] Configuration management
- [ ] Error handling and reporting

## License

MIT
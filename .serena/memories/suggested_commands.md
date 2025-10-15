# Suggested Commands

## Development Commands

### Code Generation
```bash
# Generate typed runtime entry from schema
bun run soda-gql codegen --schema ./schema.graphql --out packages/graphql-system/src/index.ts

# Produce runtime GraphQL documents
bun run soda-gql builder --mode runtime --entry ./src/pages/**/*.ts --out ./.cache/soda-gql/runtime.json
```

### Testing
```bash
# Run tests
bun run test

# Run specific test file
bun run test <path/to/test.ts>s
```

### Quality Checks
```bash
# Quality checks (linting + type check)
bun quality

# Type check only
bun typecheck

# Type check tests only
bun typecheck:tests

# Biome check
bun biome:check
```

### Package Management
```bash
# Install dependencies
bun install

# Add package
bun add <package>

# Add dev package
bun add -d <package>
```

## Task Completion Checklist
When completing a task:
1. Run `bun run test` - ensure all tests pass
2. Run `bun quality` - ensure linting and type checks pass
3. Commit changes with descriptive message

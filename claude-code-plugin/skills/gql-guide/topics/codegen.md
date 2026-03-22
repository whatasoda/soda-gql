# Topic: Codegen

## Concept

soda-gql codegen generates TypeScript types from GraphQL schemas (schema codegen) and validates/generates types from tagged templates (typegen). These two steps work together to give you end-to-end type safety.

### Codegen Commands

1. **Schema codegen:**
   ```bash
   bun run soda-gql codegen schema
   ```
   - Reads schema files from config (`schemaFiles`)
   - Generates runtime type system in `outdir`
   - Creates fragment and query builder types

2. **Type generation (typegen):**
   ```bash
   bun run soda-gql typegen
   ```
   - Scans codebase for tagged templates
   - Validates field selections against schema
   - Generates TypeScript types for fragments/operations

## Code Examples

**Standard development workflow:**
```bash
# 1. Schema changes
vim schema.graphql

# 2. Regenerate types
bun run soda-gql codegen schema

# 3. Write fragments/operations — build plugin auto-runs typegen
```

**Watch mode (if supported):**
```bash
bun run soda-gql codegen schema --watch
```

**Manual typegen run:**
```bash
bun run soda-gql typegen
```

**Config showing outdir and schemaFiles:**
```typescript
// soda-gql.config.ts
import { defineConfig } from '@soda-gql/config';

export default defineConfig({
  outdir: './src/graphql/generated',  // where codegen writes
  schemas: {
    default: {
      schemaFiles: ['./schema.graphql'],  // source schema files
    },
  },
});
```

**Importing from generated output:**
```typescript
import { gql } from './src/graphql/generated';  // matches outdir
```

## Common Patterns

✅ **Always run schema codegen after schema changes:**
```bash
# Schema changed → regenerate
bun run soda-gql codegen schema
```

✅ **Let the build plugin handle typegen:**
- Install `@soda-gql/vite-plugin` or `@soda-gql/next-plugin`
- The plugin runs typegen automatically during builds

✅ **Check generated types are in .gitignore if they are large:**
```
# .gitignore
src/graphql/generated/
```

❌ **Editing generated files manually:**
```
# Never edit files in outdir — they are overwritten by codegen
src/graphql/generated/index.ts   ← auto-generated, do not edit
```

## Common Issues

**Issue: "Schema file not found"**
- Check `schemaFiles` paths in config are relative to the config file
- Use the Read tool to verify the file exists at the expected path

**Issue: Typegen shows "unknown field"**
- Run schema codegen first: `bun run soda-gql codegen schema`
- Check field name spelling matches the schema

**Issue: Generated types not updating**
- Delete the generated directory and re-run codegen
- Check `outdir` in config matches import paths in source files

**Issue: Build plugin not running typegen**
- Verify the plugin is added in `vite.config.ts` / `next.config.ts`
- Check build output for plugin initialization messages

## Related Topics

- **setup** — Initial codegen configuration
- **lsp** — Real-time validation vs build-time codegen
- **tagged-template** — The syntax that codegen validates

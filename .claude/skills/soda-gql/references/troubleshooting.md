# Troubleshooting Guide

Common issues and solutions when using soda-gql.

## Setup Issues

### Cannot find module '@/graphql-system'

**Cause:** The GraphQL system has not been generated.

**Solution:**
```bash
# Generate the GraphQL system
bun run soda-gql codegen
```

If the error persists, check `tsconfig.json` paths configuration:
```json
{
  "compilerOptions": {
    "paths": {
      "@/graphql-system": ["./src/graphql-system"],
      "@/graphql-system/*": ["./src/graphql-system/*"]
    }
  }
}
```

### Types not updating after schema changes

**Cause:** TypeScript's language server cache is stale.

**Solution:**
1. Regenerate the GraphQL system:
   ```bash
   bun run soda-gql codegen
   ```
2. Restart TypeScript server:
   - **VS Code:** `Cmd/Ctrl + Shift + P` → "TypeScript: Restart TS Server"
   - **WebStorm/IntelliJ:** File → Invalidate Caches → Invalidate and Restart
   - **Neovim (coc.nvim):** `:CocRestart`
   - **Other IDEs:** Restart the IDE

### Transformations not applied at runtime

**Cause:** Build plugin is not configured or not processing files.

**Solution:**
1. Verify plugin is added to build config (see plugins.md)
2. Check files match `include` patterns in `soda-gql.config.ts`
3. Ensure no `exclude` patterns filter out files
4. Enable debug mode: `debug: true` in plugin options

## CLI Error Codes

### SCHEMA_NOT_FOUND

**Message:** Schema file not found at specified path.

**Solution:**
- Verify `schema` path in `soda-gql.config.ts` is correct
- Check file exists and is readable
- Use absolute path if relative path issues occur

### SCHEMA_INVALID

**Message:** Schema file contains invalid GraphQL syntax.

**Solution:**
- Validate schema using a GraphQL linter
- Check for syntax errors in `.graphql` files
- If using introspection JSON, ensure it's valid
- Common issues:
  - Missing closing braces
  - Invalid type references
  - Duplicate type definitions

### INJECT_MODULE_NOT_FOUND

**Message:** Inject module (scalar definitions) not found.

**Solution:**
```bash
# Scaffold the inject template
bun run soda-gql codegen --emit-inject-template ./src/graphql-system/default.inject.ts
```

### INJECT_TEMPLATE_EXISTS

**Message:** Inject template already exists at the specified path.

**Solution:**
- File already exists; no action needed
- To overwrite, delete the existing file first
- Or use a different path

### EMIT_FAILED

**Message:** Failed to write generated files.

**Solution:**
- Check write permissions for output directory
- Verify `outdir` path in config is valid
- Ensure parent directory exists
- Check disk space

### CONFIG_NOT_FOUND

**Message:** Configuration file not found.

**Solution:**
- Create `soda-gql.config.ts` in project root
- Or specify path: `--config ./path/to/config.ts`

## Build Plugin Issues

### webpack-plugin: Files not being transformed

**Checklist:**
1. Both plugin AND loader are configured in `webpack.config.js`
2. Loader is applied to `.ts`/`.tsx` files
3. `configPath` matches in both plugin and loader options
4. Files are not excluded by webpack rules

### vite-plugin: HMR not working

**Solution:**
1. Ensure Vite dev server is running
2. Check browser console for errors
3. Try restarting the dev server
4. Clear browser cache
5. Check Vite version compatibility

### metro-plugin: Changes not reflected

Metro uses cache-based invalidation.

**Solution:**
```bash
# Expo
npx expo start --clear

# React Native
npx react-native start --reset-cache
```

### tsc-plugin: Plugin not running

**Checklist:**
1. Using `"builder": "tsc"` in nest-cli.json (not `"swc"`)
2. Plugin is listed in `compilerOptions.plugins`
3. `importIdentifier` matches actual import path exactly
4. NestJS CLI version is compatible

## Type Errors

### "Property 'default' does not exist on type 'typeof gql'"

**Cause:** GraphQL system is outdated or not generated.

**Solution:**
```bash
bun run soda-gql codegen
```

### "Type 'X' is not assignable to type 'Y'" in operations

**Cause:** Schema and generated types are out of sync.

**Solution:**
1. Regenerate: `bun run soda-gql codegen`
2. Restart TypeScript server
3. Clear any build caches

### "Cannot find name '$var'" or "Cannot find name 'f'"

**Cause:** Destructuring callback parameters incorrectly.

**Solution:** Ensure correct destructuring:
```typescript
// Correct
fields: ({ f, $ }) => ({ ...f.id() })

// Incorrect
fields: (f, $) => ({ ...f.id() })
```

### Fragment type mismatch when spreading

**Cause:** Fragment variable types don't match operation variables.

**Solution:** Ensure variable types are compatible:
```typescript
// Fragment expects Boolean
fragment.User({
  variables: { ...$var("includeEmail").Boolean("?") },
  // ...
})

// Operation must provide Boolean
query.operation({
  variables: { ...$var("showEmail").Boolean("?") },
  fields: ({ f, $ }) => ({
    ...f.user()(({ f }) => ({
      ...userFragment.spread({ includeEmail: $.showEmail }), // OK
    })),
  }),
})
```

## Runtime Errors

### "Operation not found" at runtime

**Cause:** Build transformation didn't run or artifact not generated.

**Solution:**
1. Ensure build plugin is configured
2. Run full build (not just type check)
3. Check that gql calls are in included files

### "Invalid operation document"

**Cause:** Generated GraphQL document is malformed.

**Solution:**
1. Check for circular fragment references
2. Verify all referenced fragments exist
3. Regenerate: `bun run soda-gql codegen`

## Debug Mode

Enable debug logging in plugin configuration:

```typescript
// Vite
sodaGqlPlugin({ debug: true })

// Webpack
new SodaGqlWebpackPlugin({ debug: true })

// Metro
withSodaGql(config, { debug: true })
```

Debug output shows:
- Which files are being processed
- What transformations are applied
- Any errors during transformation

## Getting Help

1. Enable debug mode in plugin configuration
2. Check generated files in `outdir`
3. Review TypeScript errors carefully
4. Open an issue at [GitHub](https://github.com/anthropics/soda-gql/issues) with:
   - Error message
   - Configuration files
   - Minimal reproduction

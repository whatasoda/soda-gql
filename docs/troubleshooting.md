# Troubleshooting Guide

Common issues and solutions when using soda-gql.

## Setup Issues

### Cannot find module '@/graphql-system'

**Cause**: The GraphQL system has not been generated.

**Solution**:
```bash
# Generate the GraphQL system
bun run soda-gql codegen
```

If the error persists, check your `tsconfig.json` paths configuration:
```json
{
  "compilerOptions": {
    "paths": {
      "@/graphql-system": ["./src/graphql-system"]
    }
  }
}
```

### Types not updating after schema changes

**Cause**: TypeScript's language server cache is stale.

**Solution**:
1. Regenerate the GraphQL system: `bun run soda-gql codegen`
2. Restart your IDE's TypeScript server:
   - VS Code: `Cmd/Ctrl + Shift + P` → "TypeScript: Restart TS Server"
   - Other IDEs: Restart the IDE

### Transformations not applied at runtime

**Cause**: Build plugin is not configured or not processing your files.

**Solution**:
1. Verify plugin is added to your build config (see [Plugin Selection Guide](./guides/plugin-selection.md))
2. Check that your files match the `include` patterns in `soda-gql.config.ts`
3. Ensure no `exclude` patterns are filtering out your files

## CLI Error Codes

### SCHEMA_NOT_FOUND

**Message**: Schema file not found at specified path.

**Solution**:
- Verify the `schema` path in `soda-gql.config.ts` is correct
- Check the file exists and is readable

### SCHEMA_INVALID

**Message**: Schema file contains invalid GraphQL syntax.

**Solution**:
- Validate your schema using a GraphQL linter
- Check for syntax errors in `.graphql` files
- If using introspection JSON, ensure it's valid

### INJECT_MODULE_NOT_FOUND

**Message**: Inject module (scalar definitions) not found.

**Solution**:
```bash
# Scaffold the inject template
bun run soda-gql codegen --emit-inject-template ./src/graphql-system/default.inject.ts
```

### INJECT_TEMPLATE_EXISTS

**Message**: Inject template already exists at the specified path.

**Solution**:
- The file already exists; no action needed
- To overwrite, delete the existing file first

### EMIT_FAILED

**Message**: Failed to write generated files.

**Solution**:
- Check write permissions for the output directory
- Verify the `outdir` path in config is valid
- Ensure the parent directory exists

## Build Plugin Issues

### webpack-plugin: Files not being transformed

**Checklist**:
1. Both plugin AND loader are configured in `webpack.config.js`
2. Loader is applied to `.ts`/`.tsx` files
3. `configPath` matches in both plugin and loader options

### vite-plugin: HMR not working

**Solution**:
1. Ensure Vite dev server is running
2. Check browser console for errors
3. Try restarting the dev server

### metro-plugin: Changes not reflected

Metro uses cache-based invalidation. Try:
```bash
# Expo
npx expo start --clear

# React Native
npx react-native start --reset-cache
```

### tsc-plugin: Plugin not running

**Checklist**:
1. Using `"builder": "tsc"` in nest-cli.json (not `"swc"`)
2. Plugin is listed in `compilerOptions.plugins`
3. `importIdentifier` matches your actual import path

## Type Errors

### "Property 'default' does not exist on type 'typeof gql'"

**Cause**: GraphQL system is outdated or not generated.

**Solution**:
```bash
bun run soda-gql codegen
```

### "Type 'X' is not assignable to type 'Y'" in operations

**Cause**: Schema and generated types are out of sync.

**Solution**:
1. Regenerate: `bun run soda-gql codegen`
2. Restart TypeScript server
3. Clear any build caches

## Still Having Issues?

1. Enable debug mode in your plugin configuration (`debug: true`)
2. Check the generated files in your `outdir`
3. Open an issue at [GitHub](https://github.com/anthropics/soda-gql/issues)

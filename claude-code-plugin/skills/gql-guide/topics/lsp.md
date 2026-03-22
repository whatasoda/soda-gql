# Topic: LSP

## Concept

soda-gql provides LSP (Language Server Protocol) integration for real-time diagnostics, autocomplete, and hover information in editors. The LSP validates field selections, types, and directives as you type.

### LSP Features

1. **Real-time diagnostics:** Type errors, invalid fields, syntax errors
2. **Autocomplete:** Field names, types, directives
3. **Hover information:** Type info, documentation
4. **Go to definition:** Jump to schema type definitions

## Code Examples

**VS Code workspace settings:**
```json
{
  "soda-gql.configPath": "./soda-gql.config.ts"
}
```

**Running the LSP binary directly:**
```bash
# One-shot check (lsp-cli)
bun run soda-gql lsp check

# Or via the dedicated LSP CLI package
soda-gql-lsp --config ./soda-gql.config.ts
```

### Editor Setup

**VS Code:**
1. Install the soda-gql VS Code extension (from the Marketplace or local install)
2. The extension detects `soda-gql.config.ts` automatically
3. Optionally configure the config path in workspace settings:
   ```json
   { "soda-gql.configPath": "./soda-gql.config.ts" }
   ```

**Other editors:**
- Use a language server client compatible with your editor
- Point to the soda-gql LSP server binary
- The LSP binary is available via `@soda-gql/tools`

### LSP Diagnostics

The LSP validates:
- Field existence on types
- Argument types and required args
- Fragment type compatibility
- Variable types
- Directive usage

## Common Patterns

✅ **LSP workflow:**
1. Run `bun run soda-gql codegen schema` once after schema changes
2. LSP picks up the generated types automatically
3. Errors appear in the editor in real time as you write fragments/operations

✅ **Checking LSP status:**
- Look for "soda-gql: found" in editor status bar
- Check LSP output panel for connection errors

## Common Issues

**Issue: LSP not providing diagnostics**
- Check config file is found (`found: true` in project detection)
- Restart editor/LSP server
- Check LSP logs for errors

**Issue: False positive errors**
- Run `bun run soda-gql codegen schema` to sync generated types
- Check schema files are up to date

**Issue: Extension not activating**
- Verify `soda-gql.config.ts` exists in the workspace root
- Check the extension is installed and enabled

## Related Topics

- **setup** — Initial configuration before LSP works
- **codegen** — Keeping LSP in sync with schema changes

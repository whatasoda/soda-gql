---
name: gql:doctor
description: Run comprehensive diagnostics on soda-gql project
user-invocable: true
allowed-tools: Bash(bun *), Read, Grep, Glob, Write, AskUserQuestion
---

# GraphQL Doctor Skill

This skill runs comprehensive diagnostics on your soda-gql project using the `soda-gql doctor` command and additional extended checks.

## Workflow

### 1. Detect Project Configuration

First, detect the soda-gql project configuration:

!`bun ${CLAUDE_PLUGIN_ROOT}/scripts/detect-project.ts`

The output will include:
- `found`: Whether a soda-gql project was detected
- `configPath`: Path to the config file
- `schemas`: Schema names and their file paths
- `outdir`: Output directory for generated files
- `hasLsp`: Whether LSP is available

### 2. Check Project Found

If `found: false`, inform the user:
> No soda-gql project detected in the current directory. Make sure you have a `soda-gql.config.{ts,js,mjs}` file and have run `bun install` to install dependencies.

Exit the skill.

### 3. Run Core Diagnostics

Execute the doctor command:

```bash
bun run soda-gql doctor
```

**Expected output:**
- Success: All checks pass with ✓ status
- Warnings/Errors: One or more checks fail with specific error messages

The doctor command performs 4 core checks:
1. **version-consistency**: Verify all `@soda-gql/*` packages have matching versions
2. **duplicate-packages**: Detect duplicate package installations in node_modules
3. **config-validation**: Validate soda-gql.config.{ts,js,mjs} structure
4. **codegen-freshness**: Check if generated files are up-to-date with schema

### 4. Parse and Report Core Check Results

For each check, present the status and actionable fix suggestions:

#### Check 1: version-consistency

**What it checks:**
- All `@soda-gql/*` packages in package.json have the same version
- No version mismatches between dependencies and devDependencies

**On failure:**
```
❌ version-consistency: Found version mismatches
  @soda-gql/core: 0.2.0
  @soda-gql/builder: 0.1.5
```

**Fix suggestion:**
1. Update all `@soda-gql/*` packages to the same version
2. Run `bun install` to sync lockfile
3. Recommended command:
   ```bash
   bun add @soda-gql/core@latest @soda-gql/builder@latest [other packages]
   ```

**Auto-fix offer:** Use AskUserQuestion to ask: "Would you like me to update all @soda-gql packages to the latest matching version?"

#### Check 2: duplicate-packages

**What it checks:**
- Scans node_modules for duplicate installations of the same package
- Common with monorepo setups or npm/yarn legacy resolution

**On failure:**
```
❌ duplicate-packages: Found duplicates
  @soda-gql/core appears at:
    - node_modules/@soda-gql/core
    - node_modules/@soda-gql/builder/node_modules/@soda-gql/core
```

**Fix suggestion:**
1. This often happens with npm or yarn (Bun rarely has this issue)
2. Clear node_modules and reinstall:
   ```bash
   rm -rf node_modules
   bun install
   ```
3. If using pnpm, check `.npmrc` for hoist settings
4. If using npm, consider switching to Bun for better resolution

**Auto-fix offer:** Use AskUserQuestion to ask: "Would you like me to remove node_modules and reinstall dependencies with Bun?"

#### Check 3: config-validation

**What it checks:**
- Config file exists and exports valid configuration
- Required fields: `outdir`, `schemas`
- Schema files referenced in config exist on disk
- Schema name keys are valid identifiers

**On failure:**
```
❌ config-validation: Invalid config structure
  Missing required field: outdir
```

**Fix suggestion:**
1. Read the config file to inspect structure
2. Common issues:
   - Missing `outdir` or `schemas` field
   - Invalid export (must use `export default`)
   - Schema file paths don't exist
3. Example valid config:
   ```typescript
   import { defineConfig } from '@soda-gql/config';

   export default defineConfig({
     outdir: './src/graphql/generated',
     schemas: {
       default: {
         schemaFiles: ['./schema.graphql'],
       },
     },
   });
   ```

**Auto-fix offer:** Use AskUserQuestion to ask: "Would you like me to inspect and fix the config file structure?"

#### Check 4: codegen-freshness

**What it checks:**
- Generated files in `outdir` are up-to-date with schema files
- Compares schema file mtimes with generated file mtimes
- Checks if schema content hash matches generated code metadata

**On failure:**
```
❌ codegen-freshness: Generated files are stale
  Schema modified: 2026-02-17 10:30:00
  Last codegen: 2026-02-17 09:15:00
```

**Fix suggestion:**
1. Schema files have been modified since last codegen
2. Run codegen to regenerate:
   ```bash
   bun run soda-gql codegen schema
   ```
3. Consider setting up a git pre-commit hook to auto-run codegen

**Auto-fix offer:** Use AskUserQuestion to ask: "Would you like me to run codegen to update generated files?"

### 5. Run Extended Checks

After core diagnostics, run additional validation checks:

#### Extended Check 1: Template Validation

```bash
bun run soda-gql typegen
```

**What it checks:**
- All GraphQL tagged templates (query\`...\`, fragment\`...\`) are valid
- Field selections match schema types
- Variable types are correct
- Fragment spreads are compatible

**On failure:**
```
Error: Field 'userName' does not exist on type 'User'
  at src/graphql/operations.ts:10:5
```

**Fix suggestion:**
1. Use Read tool to examine the error location
2. Common issues:
   - Typo in field name (userName vs username)
   - Schema changed, field was renamed or removed
   - Wrong type selected (e.g., User vs UserProfile)
3. Show surrounding context to user
4. Suggest correct field name based on schema

**Auto-fix offer:** If the error is a simple typo or field name mismatch, use AskUserQuestion: "Would you like me to fix this field name?"

#### Extended Check 2: TypeScript Type Check

```bash
bun typecheck
```

**What it checks:**
- All TypeScript files compile without errors
- Generated types are correctly consumed
- No type mismatches in user code

**On failure:**
```
src/components/UserCard.tsx:25:10 - error TS2339: Property 'userName' does not exist on type 'UserFragment'
```

**Fix suggestion:**
1. If error is in generated files → rare, likely codegen issue, re-run codegen
2. If error is in user code → schema/template mismatch
3. Check if recent schema changes broke existing code
4. Use Grep to find all usages of problematic property

**Auto-fix offer:** If the type error is due to stale codegen, offer: "Would you like me to re-run codegen to fix generated types?"

#### Extended Check 3: Field Selection Formatting

```bash
bun run soda-gql format --check
```

**What it checks:**
- Field selections in callback builders are properly formatted
- Consistent indentation and ordering
- No style violations

**On failure:**
```
Format check failed: 3 files need formatting
  src/graphql/fragments.ts
  src/graphql/operations.ts
  src/graphql/queries.ts
```

**Fix suggestion:**
1. Run format command to auto-fix:
   ```bash
   bun run soda-gql format
   ```
2. Consider setting up format-on-save in your editor
3. Add format check to CI pipeline

**Auto-fix offer:** Use AskUserQuestion: "Would you like me to auto-format the field selections?"

### 6. Present Summary

After all checks, provide a comprehensive summary:

**All Checks Pass:**
```
✅ soda-gql diagnostics: All checks passed!

Core checks (4/4):
  ✓ version-consistency
  ✓ duplicate-packages
  ✓ config-validation
  ✓ codegen-freshness

Extended checks (3/3):
  ✓ template-validation (typegen)
  ✓ type-check
  ✓ formatting

Your soda-gql project is healthy!
```

**Some Checks Failed:**
```
⚠️ soda-gql diagnostics: Found issues

Core checks (2/4):
  ✓ version-consistency
  ✓ duplicate-packages
  ❌ config-validation: Missing required field 'outdir'
  ❌ codegen-freshness: Generated files are stale

Extended checks (2/3):
  ✓ template-validation
  ❌ type-check: 3 type errors found
  ✓ formatting

Recommended actions:
1. Fix config structure (see details above)
2. Run codegen to update generated files
3. Fix type errors in user code
```

### 7. Offer Batch Auto-Fix

If multiple fixable issues are found, offer a batch fix:

Use AskUserQuestion with multiSelect: true to ask:
"Which issues would you like me to auto-fix?"
Options:
- Update package versions to latest
- Remove node_modules and reinstall
- Fix config file structure
- Run codegen to update generated files
- Auto-format field selections
- Help fix template validation errors
- Help fix TypeScript type errors

### 8. Execute Auto-Fixes

For each selected fix, execute in order and report results:

1. Package version update:
   ```bash
   bun add @soda-gql/core@latest @soda-gql/builder@latest [...]
   ```

2. Clean reinstall:
   ```bash
   rm -rf node_modules
   bun install
   ```

3. Run codegen:
   ```bash
   bun run soda-gql codegen schema
   ```

4. Auto-format:
   ```bash
   bun run soda-gql format
   ```

For config fixes and template/type errors, use Read/Write tools to make targeted fixes.

### 9. Re-run Diagnostics After Fixes

After auto-fixes, re-run the full diagnostic suite:

```bash
bun run soda-gql doctor
bun run soda-gql typegen
bun typecheck
bun run soda-gql format --check
```

Report final status to user.

## Error Handling

### Doctor Command Not Found

```
Error: Command not found: soda-gql
```

**Analysis:**
- soda-gql CLI not installed or not in PATH
- Check package.json for @soda-gql/cli

**Fix suggestion:**
1. Verify @soda-gql/cli is in dependencies or devDependencies
2. If missing, install:
   ```bash
   bun add -d @soda-gql/cli
   ```
3. If installed but not found, try:
   ```bash
   bun run node_modules/.bin/soda-gql doctor
   ```

### Doctor Command Fails

```
Error: Doctor command exited with code 1
```

**Analysis:**
- Command exists but encountered an error
- Check stderr for error details
- May be a bug in doctor implementation

**Fix suggestion:**
1. Show full error output to user
2. Try running checks manually:
   - Check package.json for version mismatches
   - Run `bun install` to verify node_modules state
   - Validate config manually using Read tool
3. Report issue to soda-gql if error seems like a bug

## Advanced Features

### Integration with CI/CD

Inform user about CI integration:

> **Tip:** Add `soda-gql doctor` to your CI pipeline:
> ```yaml
> - name: Run soda-gql diagnostics
>   run: |
>     bun run soda-gql doctor
>     bun run soda-gql typegen
>     bun typecheck
>     bun run soda-gql format --check
> ```

### Pre-commit Hook

Suggest pre-commit hook setup:

> **Tip:** Set up a pre-commit hook to auto-run diagnostics:
> ```bash
> # .husky/pre-commit or similar
> bun run soda-gql doctor --quiet
> bun run soda-gql format
> git add -u
> ```

### Watch Mode for Development

If working on schema changes, suggest watch workflow:

> **Tip:** For active schema development:
> 1. Terminal 1: `bun run soda-gql codegen schema --watch`
> 2. Terminal 2: `bun typecheck --watch`
>
> This gives real-time feedback on schema changes.

## Validation Checklist

Before completing this skill, ensure:
- ✅ Project was detected successfully
- ✅ `bun run soda-gql doctor` executed
- ✅ All 4 core check results were parsed and explained
- ✅ Extended checks (typegen, typecheck, format) were run
- ✅ Each failure has specific, actionable fix suggestions
- ✅ Auto-fix offers were presented via AskUserQuestion
- ✅ Summary report was provided to user
- ✅ Any executed auto-fixes were validated

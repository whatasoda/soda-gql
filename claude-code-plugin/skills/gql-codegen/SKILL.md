---
name: gql:codegen
description: Generate GraphQL system from schema files
user-invocable: true
allowed-tools: Bash(bun *), Read, Grep, Glob, AskUserQuestion
---

# GraphQL Codegen Skill

This skill generates the GraphQL system files from your schema using the `soda-gql codegen schema` command.

## Workflow

### 1. Detect Project Configuration

First, detect the soda-gql project configuration to understand the schema setup:

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

### 3. Run Codegen

Execute the schema codegen command:

```bash
bun run soda-gql codegen schema
```

**Expected output:**
- Success: "✓ Schema codegen complete" (or similar)
- Errors: Schema parsing errors, GraphQL syntax errors, or file system errors

### 4. Handle Errors

If codegen fails, analyze the error and provide guidance:

#### Common Errors:

**Schema Parse Error:**
```
Error: GraphQL syntax error in schema file
```
→ Check the schema file for GraphQL syntax errors. Use the Read tool to examine the schema file path from the project detection output.

**Config Validation Error:**
```
Error: Invalid config: ...
```
→ Check the config file structure. Common issues:
  - Missing required fields (outdir, schemas)
  - Invalid file paths (schema files don't exist)
  - Incorrect schema format

**Type System Error:**
```
Error: Unknown type referenced: ...
```
→ The schema references a type that doesn't exist. Check schema file for missing type definitions.

### 5. Run Typegen (Optional but Recommended)

After successful schema codegen, run typegen to validate any existing templates:

```bash
bun run soda-gql typegen
```

This step validates that existing GraphQL tagged templates are compatible with the generated schema system.

**Expected output:**
- Success: "✓ Type generation complete" (or no output if no templates found)
- Template errors: Invalid field selections, unknown types, etc.

### 6. Run Type Check

Verify the generated types are correct:

```bash
bun typecheck
```

**Expected output:**
- Success: No type errors (or only pre-existing errors unrelated to codegen)
- Errors: Type errors in generated files (rare) or in user code due to schema changes

### 7. Report Results

Provide a summary to the user:

**On Success:**
> ✅ GraphQL schema codegen completed successfully!
>
> Generated files:
> - Schema system: `<outdir>` (from project detection)
>
> Next steps:
> - Your schema types are now available for use in fragments and operations
> - Use `gql:scaffold` to generate new queries or mutations
> - Use `gql:doctor` to run comprehensive diagnostics

**On Failure:**
> ❌ Codegen failed with errors.
>
> Error details:
> [Show error message and analysis]
>
> Suggested fixes:
> [Provide specific fix suggestions based on error type]

### 8. Offer Auto-Fix (Optional)

If you can identify a fixable issue (e.g., schema syntax error), offer to fix it:

Use AskUserQuestion to ask:
- "Would you like me to fix the schema syntax error?" (if schema syntax issue detected)
- "Would you like me to update the config file?" (if config validation error detected)

## Error Handling Examples

### Example 1: Missing Schema File

```
Error: Schema file not found: ./schema.graphql
```

**Analysis:**
- Config references a schema file that doesn't exist
- Check if path is relative to config location

**Fix suggestion:**
1. Use Glob to find .graphql files: `**/*.graphql`
2. Show user available schema files
3. Offer to update config with correct path

### Example 2: Invalid GraphQL Syntax

```
Syntax Error: Unexpected Name "fieldd"
```

**Analysis:**
- Typo in schema file (e.g., "fieldd" instead of "field")
- Use Read tool to examine schema around line number from error

**Fix suggestion:**
1. Read schema file
2. Locate error line
3. Show context to user
4. Offer to fix typo if obvious

### Example 3: Incompatible Schema Change

After codegen, typegen shows template errors:

```
Error: Field 'oldField' does not exist on type 'Query'
```

**Analysis:**
- Schema changed: field was renamed or removed
- Existing templates reference the old field name

**Fix suggestion:**
1. Inform user about breaking schema change
2. Use Grep to find all references to 'oldField' in codebase
3. Suggest updating templates to use new field name
4. Offer to help with migration

## Advanced Usage

### Multiple Schemas

If the project has multiple schemas (detected via `schemas` object), inform the user:

> This project has multiple schemas:
> - `default`: ./schema.graphql
> - `admin`: ./admin-schema.graphql
>
> Running `bun run soda-gql codegen schema` will generate types for all schemas.

### Watch Mode

Inform the user about watch mode for development:

> **Tip:** For continuous development, you can run codegen in watch mode:
> ```bash
> bun run soda-gql codegen schema --watch
> ```
> This will automatically regenerate types when schema files change.

(Note: Check if watch mode is actually supported by running `bun run soda-gql codegen schema --help` first)

## Validation Checklist

Before completing this skill, ensure:
- ✅ Project was detected successfully
- ✅ `bun run soda-gql codegen schema` executed
- ✅ Codegen output was analyzed
- ✅ Any errors were explained with specific fix suggestions
- ✅ Optional: typegen and typecheck were run
- ✅ User received clear summary of results

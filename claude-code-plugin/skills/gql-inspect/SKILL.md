---
name: gql:inspect
description: Inspect GraphQL fragments and operations in files
user-invocable: true
argument-hint: [file path, symbol name, or question]
allowed-tools: Bash(bun *), Bash(soda-gql-lsp-cli *), Read, Grep, Glob, AskUserQuestion
---

# GraphQL Inspect Skill

This skill analyzes GraphQL fragments and operations in your soda-gql project using the `soda-gql-lsp-cli` tool. It provides symbol listings, diagnostics, and type context for any file or symbol.

## Workflow

### 1. Detect Project Configuration

First, detect the soda-gql project configuration:

!`bun ${CLAUDE_PLUGIN_ROOT}/scripts/detect-project.ts`

The output includes:
- `found`: Whether a soda-gql project was detected
- `configPath`: Path to the config file
- `schemas`: Schema names and their file paths
- `outdir`: Output directory for generated files
- `hasLsp`: Whether LSP is available

### 2. Check LSP Availability

If `hasLsp: false`, inform the user:
> The `gql:inspect` skill requires `@soda-gql/lsp` and `@soda-gql/protocol-proxy` to be installed. Please add them to your project dependencies and run `bun install`.

Exit the skill.

### 3. Parse Argument

Parse `$ARGUMENTS` to determine the input mode. There are three modes:

#### Mode A: File Path

If the argument contains `/` or ends in `.ts` or `.tsx`, treat it as a file path and use it directly.

#### Mode B: Symbol Name

If the argument looks like an identifier (letters, digits, underscores, no path separators, no spaces), treat it as a symbol name:

1. Use Glob to find candidate TypeScript files: `**/*.{ts,tsx}`
2. Limit candidates to a reasonable number. Prefer entry files reported by detect-project (e.g., files near the config or in src directories).
3. For each candidate file, run:
   ```bash
   soda-gql-lsp-cli symbols <file>
   ```
4. Search the JSON output for a symbol whose `name` matches the argument.
5. Use the file that contains a matching symbol.

**Important:** Do NOT use the `--workspace` flag (DD-7 constraint). Freeform resolution must use Glob/Grep to find candidate files.

#### Mode C: Empty or Question

If the argument is empty or looks like a question (contains spaces, ends with `?`), use AskUserQuestion:

**Question:** "What would you like to inspect?"

**Options:**
- "Specific file" → Ask for the file path
- "Search for a symbol" → Ask for the symbol name
- "Overview of all GraphQL files" → Use Glob `**/*.{ts,tsx}` and run symbols on each file that contains GraphQL definitions

### 4. List Symbols

Run the symbols subcommand on the resolved file:

```bash
soda-gql-lsp-cli symbols <file>
```

**Expected output:** JSON array with objects:
```json
[
  { "name": "UserFragment", "kind": "fragment", "typeName": "User", "schemaName": "default", "line": 5 },
  { "name": "GetUserQuery", "kind": "query", "variables": [{ "name": "id", "type": "ID!" }], "schemaName": "default", "line": 20 }
]
```

**If no symbols found:** Inform the user that the file has no GraphQL definitions recognized by soda-gql. Suggest checking that the file uses `gql.default(...)` or similar builder patterns.

**Present as a table:**

| Name | Kind | Type / Variables | Schema | Line |
|------|------|-----------------|--------|------|
| UserFragment | fragment | User | default | 5 |
| GetUserQuery | query | id: ID! | default | 20 |

### 5. Run Diagnostics

Run the diagnostics subcommand on the same file:

```bash
soda-gql-lsp-cli diagnostics <file>
```

**Expected output:** JSON array:
```json
[
  { "message": "Field 'userName' does not exist on type 'User'", "line": 8, "column": 5, "severity": "error" },
  { "message": "Fragment 'OldFragment' is unused", "line": 22, "column": 1, "severity": "warning" }
]
```

**If empty array:** Report "No issues found — file is clean."

**If non-empty:** Group and present by severity:

```
Errors (1):
  Line 8, col 5: Field 'userName' does not exist on type 'User'

Warnings (1):
  Line 22, col 1: Fragment 'OldFragment' is unused
```

### 6. Type Context (On Demand)

Fetch type information when:
- The user explicitly asks about a type
- A diagnostic message references a type name

Run the schema subcommand:

```bash
soda-gql-lsp-cli schema <typeName>
```

For projects with multiple schemas, pass the schema name from detect-project's `schemas` keys:

```bash
soda-gql-lsp-cli schema <typeName> --schema <schemaName>
```

**Output varies by kind:**

- **OBJECT**: Display fields with their types and available arguments
- **UNION**: List union member types
- **ENUM**: List enum values
- **INPUT**: Display input fields with types and defaults
- **INTERFACE**: Display interface fields

Present the type information in a structured format relevant to the kind.

### 7. Present Results

Provide a consolidated view in this order:

#### Symbol Table
List all GraphQL definitions found in the file (from step 4).

#### Diagnostics Summary
- If clean: "No issues found in `<filename>`."
- If issues found: Grouped list by severity with line references.

#### Type Context
Include type details when fetched (from step 6), labeled clearly.

#### Next Steps

Suggest relevant follow-up actions based on the results:

- If diagnostics found errors: "Use `gql:doctor` for project-wide health checks."
- If no symbols found: "Use `gql:scaffold` to add a new fragment or operation to this file."
- If symbols found but stale: "Run `bun run soda-gql codegen schema` to regenerate types."
- General: "Use `gql:guide` for syntax reference and examples."

## Error Handling

### Binary Not Found

```
Error: Command not found: soda-gql-lsp-cli
```

**Fix suggestion:**
> Install `@soda-gql/protocol-proxy` globally or ensure it's in your project dependencies:
> ```bash
> bun add -d @soda-gql/protocol-proxy
> ```
> Then verify the binary is available:
> ```bash
> bun run node_modules/.bin/soda-gql-lsp-cli --help
> ```

### File Not Found

```
Error: No such file or directory: <path>
```

**Fix suggestion:**
> Check that the file path is correct. Use Glob to search for the file:
> ```
> Glob **/<filename>.{ts,tsx}
> ```

### No Symbols Found in File

If `soda-gql-lsp-cli symbols <file>` returns an empty array:

> No GraphQL definitions were found in `<file>`. Ensure the file uses soda-gql builder patterns such as `gql.default(({ fragment }) => fragment("Name", "Type")\`{ ... }\`())`.

### lsp-cli Execution Failure

If `soda-gql-lsp-cli` exits with a non-zero code:

1. Show the full error output to the user.
2. Suggest checking the project configuration:
   ```bash
   bun ${CLAUDE_PLUGIN_ROOT}/scripts/detect-project.ts
   ```
3. Suggest re-running codegen if the generated runtime is missing:
   ```bash
   bun run soda-gql codegen schema
   ```

## Example Workflows

### Example 1: Inspect a Specific File

**User:** `gql:inspect src/graphql/fragments.ts`

**Process:**
1. Detect project → `hasLsp: true`
2. Argument contains `/` → Mode A (file path)
3. Run `soda-gql-lsp-cli symbols src/graphql/fragments.ts` → 3 fragments found
4. Run `soda-gql-lsp-cli diagnostics src/graphql/fragments.ts` → 1 warning
5. Present symbol table + diagnostics
6. Suggest next steps

### Example 2: Search by Symbol Name

**User:** `gql:inspect UserFragment`

**Process:**
1. Detect project → `hasLsp: true`
2. Argument is identifier-like → Mode B (symbol name)
3. Glob `**/*.{ts,tsx}` → find candidate files
4. Run `soda-gql-lsp-cli symbols` on each candidate
5. Find file containing `UserFragment` symbol
6. Run diagnostics on that file
7. Present consolidated results

### Example 3: Empty Argument

**User:** `gql:inspect`

**Process:**
1. Detect project → `hasLsp: true`
2. Empty argument → Mode C
3. AskUserQuestion: "What would you like to inspect?"
4. User selects "Specific file" → prompt for path
5. Continue with file path from user input

## Validation Checklist

Before completing this skill, ensure:
- The project was detected successfully and `hasLsp: true`
- The input mode was correctly identified (file path, symbol name, or empty)
- `soda-gql-lsp-cli symbols` was executed and results were presented as a table
- `soda-gql-lsp-cli diagnostics` was executed and results were summarized
- Type context was fetched via `soda-gql-lsp-cli schema` when relevant
- Errors were explained with actionable fix suggestions
- Next steps were offered to the user

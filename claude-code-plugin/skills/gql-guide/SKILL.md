---
name: gql:guide
description: Interactive guide to soda-gql features and patterns
user-invocable: true
argument-hint: [topic or question]
allowed-tools: Read, Grep, Glob, AskUserQuestion
---

# GraphQL Guide Skill

This skill provides interactive guidance on soda-gql features, syntax patterns, and best practices. Parse `$ARGUMENTS` to route to a specific topic, or use AskUserQuestion to let the user choose.

## Topic Routing

Parse `$ARGUMENTS` against the keyword table below. When a topic matches, use the Read tool to load the topic file from `${CLAUDE_PLUGIN_ROOT}/skills/gql-guide/topics/<topic>.md`, then present its content to the user.

### Topic Index

| Topic | Keywords | Description |
|-------|----------|-------------|
| tagged-template | tagged-template, template, syntax | Tagged template syntax for fragments and operations |
| fragment | fragment, spread | Fragment definitions and spreading patterns |
| operation | operation, query, mutation, subscription | Query, mutation, and subscription operations |
| union | union, inline fragment | Union type handling and member selection |
| directive | directive, @include, @skip | GraphQL directives |
| metadata | metadata, callback | Fragment metadata and field-level callbacks |
| setup | setup, install, config | Project setup and initial codegen |
| lsp | lsp, editor, vscode | LSP integration and editor setup |
| codegen | codegen, typegen, build | Schema codegen and build integration |
| colocation | colocation, colocate | Fragment colocation patterns |

### Routing Logic

1. If `$ARGUMENTS` is non-empty, scan the Keywords column for a match (case-insensitive substring).
2. If exactly one topic matches, read `${CLAUDE_PLUGIN_ROOT}/skills/gql-guide/topics/<topic>.md` and present it.
3. If multiple topics match or `$ARGUMENTS` is empty/unclear, use AskUserQuestion:

   **Question:** "What would you like guidance on?"
   **Options:**
   - "Tagged template syntax" → tagged-template
   - "Fragment patterns" → fragment
   - "Operations (queries/mutations)" → operation
   - "Union types" → union
   - "Directives" → directive
   - "Metadata and callbacks" → metadata
   - "Project setup" → setup
   - "LSP and editor integration" → lsp
   - "Codegen and build tools" → codegen
   - "Fragment colocation" → colocation
   - "Something else / interactive search" → fallback

4. After the user selects a topic, read the corresponding topic file.

## Fallback: Interactive Mode

If the user's question doesn't match any topic keyword:

1. Extract 2–3 keywords from the user's question.
2. Use Grep to search `docs/guides/` and `playgrounds/` for those keywords.
3. Read the most relevant matching files (up to 3).
4. Synthesize an answer from the documentation found.
5. Suggest related topics from the topic index for further exploration.

**Example:** User asks "How do I add pagination?"
1. Grep for "pagination" in docs and playground.
2. If not found, explain: add `limit`/`offset` arguments to a field, declare them in the operation variables, pass via `$.limit`.
3. Suggest related topics: **operation**, **fragment**.

## Validation Checklist

Before completing this skill, ensure:
- ✅ Topic was identified from $ARGUMENTS or user selection
- ✅ Topic file was loaded via Read tool from the topics directory
- ✅ Code examples were provided (from topic file or synthesized)
- ✅ Common patterns and anti-patterns were shown
- ✅ Related topics were suggested for further exploration

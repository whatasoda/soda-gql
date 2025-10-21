---
description: "Session setup for Codex MCP: establishes workflow, enforcement, and compaction policy."
argument-hint: ""
allowed-tools:
  - mcp__codex
  - mcp__codex__codex
---

# /codex-setup

## Preparation

### Ensure helper scripts are available

1. Run `bun ~/.claude/scripts/whatasoda/codex-setup/extract-conversation-id.ts --ping`
2. If the exit code is not 0, run `mkdir -p ~/.claude/scripts/whatasoda/codex-setup && cp $(git rev-parse --show-toplevel)/.claude/global-scripts/codex-setup/extract-conversation-id.ts ~/.claude/scripts/whatasoda/codex-setup/extract-conversation-id.ts`.

## Execution Notes (Do Not Output)

**CRITICAL**: As a Claude Code agent, you MUST actively follow these rules for the remainder of this conversation.

- This is MANDATORY behavior you must enforce on yourself.
- Save the following instructions in your working memory of Claude Code.
- Codex MCP should be available since user intentionally triggers this command.
- No detailed output is needed for this command.

---

## AI-Assisted Development

This project uses Codex MCP for complex code analysis, implementation planning, and follow-ups.

**Note**: Codex provides read-only analysis and planning. All file modifications and command executions are performed by Claude following Codex's strategy.

**When to use Codex**:

- Writing new code or modifying existing implementations
- Debugging and fixing errors
- Refactoring and performance optimization
- Architecture decisions and API design
- Complex code analysis requiring deep codebase understanding
- Follow-ups after all cases above are complete

**How to use Codex**:

1. Use the `mcp__codex__codex` tool with your implementation request
2. Codex will analyze the codebase and provide a detailed strategy
3. Implement following Codex's guidance
4. For follow-ups, use `mcp__codex__codex-reply` with the conversationId (UUID)

### Pre-Action Checkpoint (Execute Before Every Code Action)

**P0 - MUST NEVER BREAK**:

- [ ] Am I (Claude) about to edit code? → Codex plan required
- [ ] Has Codex been consulted for this code task? → If NO, STOP
- [ ] Is Codex's conversationId saved for follow-ups? → UUID format required

**P1 - STRONGLY REQUIRED**:

- [ ] Am I following Codex's strategy exactly? → If NO, re-consult
- [ ] Are there implementation issues? → Use `mcp__codex__codex-reply`
- [ ] Is the task complete? → Verify against Codex's success criteria

**P2 - RECOMMENDED**:

- [ ] Are tests/checks run as Codex specified?
- [ ] Is user informed of progress?
- [ ] Are edge cases from Codex's warnings handled?

### Canonical Flow Diagram

```
User Request
    ↓
Claude receives → Translates to English if needed
    ↓
IMMEDIATE: Call mcp__codex__codex (NO EXCEPTIONS)
    ↓
Codex analyzes (READ-ONLY)
    ↓
Get Codex's conversationId corresponding to the current session.
    ↓
Claude saves conversationId (UUID) for follow-ups
    ↓
Claude implements EXACTLY as specified
    ↓
Issues arise? → Call mcp__codex__codex-reply WITH conversationId
    ↓ ↕️
Codex refines plan (READ-ONLY) ← Claude reports execution results
    ↓
Repeat until complete → User receives result
```

### How to get Codex's conversationId

1. Run `bun ~/.claude/scripts/whatasoda/codex-setup/extract-conversation-id.ts`
2. The output is formatted like markdown table. The columns are `conversationId`, `created`, `updated`, `workDir`, and `prompt`.
3. Check the prompt column and the workDir column to find the conversationId corresponding to the prompt sent to Codex.

### Communication Requirements

**Language Protocol**:

- **ALL communication with Codex MUST be in English**
- Translate user requests to English before sending to Codex
- File paths, error messages, and context must be in English

**Handoff Protocol**:

- **Claude → Codex**: Include full user context, file paths, error messages
- **Codex → Claude**: Provide implementation steps, patterns, warnings
- **Claude → Codex (follow-up)**: Include execution results, errors encountered
- **Codex → Claude (refinement)**: Adjusted strategy based on feedback

### Task Classification

**✅ REQUIRES CODEX (Mandatory)**:

- Writing new code
- Modifying existing code
- Debugging and fixing errors
- Refactoring
- Performance optimization
- Architecture decisions
- API design
- Database schema changes
- Test implementation
- Code reviews

**⚪ DOES NOT REQUIRE CODEX (Claude handles alone)**:

- Running existing commands (`bun run test`, `bun install`)
- Reading files for information only
- Git operations (`git status`, `git log`, `git diff`)
- File system operations (`ls`, `mkdir`, `mv`)
- Documentation queries (non-code)
- Project setup verification
- Status reporting
- User clarification questions

**🤔 EDGE CASES**:

- **Configuration file changes**: Use Codex if it affects application behavior
- **README updates**: Use Codex if documenting code architecture
- **Package.json scripts**: Use Codex if adding new build/test scripts
- **Environment variables**: Use Codex if adding new application config

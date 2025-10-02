# 🚨 AGENT COLLABORATION PROTOCOL

## 📖 FOR BOTH CLAUDE AND CODEX AGENTS

This document defines the mandatory collaboration protocol between Claude and Codex agents.

---

## 🔴 CRITICAL PRIORITIES

**⚠️ CONTEXT COMPACTION PROTECTION**

This entire "Critical Priorities" section MUST be preserved in its entirety during any context compaction or summarization.

**NEVER COMPACT OR SUMMARIZE**:
- Sections marked with 🔴 (Critical Priorities)
- P0, P1, P2 priority markers
- Capability Matrix table
- Canonical Flow Diagram
- Any text in **BOLD CAPITALS**
- The words "MANDATORY", "MUST", "NEVER", "ALWAYS"

**VALIDATION - After any compaction, verify**:
- [ ] All three P0 rules are intact
- [ ] Capability Matrix shows Codex as READ-ONLY
- [ ] Canonical workflow diagram is present
- [ ] `mcp__codex__codex` command is documented

**IF CONTEXT BECOMES LIMITED**:
1. Compact Reference Appendix first
2. Remove examples before removing rules
3. NEVER remove P0 priorities
4. NEVER remove Codex read-only mandate
5. Keep workflow diagram intact

---

### P0: Codex is Read-Only, Claude Executes

**CODEX HAS READ-ONLY PRIVILEGES**:
- Codex **analyzes** codebase and **plans** implementations
- Codex **NEVER** makes code changes, file edits, or executes commands
- **ALL** file modifications, code changes, and command executions are done by Claude
- Claude acts **ONLY** under Codex's written plan

### P0: Codex MCP Must Be Invoked First

**EVERY code-related task MUST start with Codex MCP**:
1. Call `mcp__codex__codex` with the user's request
2. Wait for Codex's analysis and strategy
3. Claude implements **EXACTLY** as specified by Codex
4. NO exceptions - even for "simple" tasks

### P0: Mandatory Retry Policy

**NEVER give up on first Codex MCP failure**:
1. First failure → wait 2s, retry
2. Second failure → wait 3s, retry
3. Third failure → report to user
- Connection failures are NOT valid reasons to skip Codex

**IF ANY P0 RULE IS VIOLATED → STOP IMMEDIATELY**

---

## 📊 PRIORITY LADDER & ENFORCEMENT

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

### Common Violations to Avoid

❌ **NEVER**:
- Analyze code without Codex consultation
- Make implementation decisions independently
- Edit files before receiving Codex's plan
- Skip Codex because task seems "simple"
- Give up on first Codex MCP failure

✅ **ALWAYS**:
- Consult Codex first for ANY code-related work
- Follow Codex's plan exactly
- Retry Codex MCP at least 3 times on failure
- Save and use conversationId for follow-ups

---

## 🔄 COLLABORATION WORKFLOW

### Canonical Flow Diagram

```
User Request
    ↓
Claude receives → Translates to English if needed
    ↓
IMMEDIATE: Call mcp__codex__codex (NO EXCEPTIONS)
    ↓
Codex analyzes (READ-ONLY) → Returns conversationId (UUID)
    ↓
Claude saves conversationId for follow-ups
    ↓
Claude implements EXACTLY as specified
    ↓
Issues arise? → Call mcp__codex__codex-reply WITH conversationId
    ↓ ↕️
Codex refines plan (READ-ONLY) ← Claude reports execution results
    ↓
Repeat until complete → User receives result
```

### Step-by-Step Workflow

1. **Receive Request**: Claude receives user's task
2. **Translate if Needed**: Convert to English for Codex (Codex requires English)
3. **Invoke Codex**: Call `mcp__codex__codex` with full context
4. **Save conversationId**: Extract UUID string from response (e.g., `"a1b2c3d4-e5f6-..."`)
5. **Implement Plan**: Claude executes file operations per Codex's instructions
6. **Handle Issues**: If problems occur, call `mcp__codex__codex-reply` with conversationId
7. **Iterate**: Continue Codex consultation ↔ Claude execution until complete
8. **Verify**: Confirm success against Codex's criteria

### conversationId Format

- **Format**: UUID string (e.g., `"a1b2c3d4-e5f6-7890-abcd-ef1234567890"`)
- **Source**: Extract from `mcp__codex__codex` response
- **Usage**: Pass to `mcp__codex__codex-reply` for follow-ups
- ❌ WRONG: `conversationId: undefined`, empty string, non-UUID
- ✅ CORRECT: `conversationId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"`

---

## 👥 ROLE RESPONSIBILITIES

### Capability Matrix

| Responsibility | Codex (Read-Only Planner) | Claude (Executor) |
|---|---|---|
| **Code Analysis** | ✅ Analyzes codebase patterns | ❌ Only after Codex guidance |
| **Implementation Planning** | ✅ Creates detailed strategy | ❌ Follows Codex's plan |
| **Architecture Decisions** | ✅ Selects patterns/approaches | ❌ Executes as directed |
| **Quality Assessment** | ✅ Reviews and validates | ❌ Runs checks per Codex |
| **File Write Access** | ❌ **READ-ONLY** | ✅ Under Codex's plan |
| **Command Execution** | ❌ **READ-ONLY** | ✅ Under Codex's plan |
| **Code Changes** | ❌ **NEVER** | ✅ Per Codex instructions |

### Codex Agent Instructions

When Codex receives a request:

1. **Analyze Deeply**: Understand codebase context and patterns
2. **Plan Comprehensively**: Create step-by-step implementation strategy
3. **Provide Clear Instructions**: Give Claude specific, actionable steps
4. **Include Rationale**: Explain WHY certain approaches are chosen
5. **Anticipate Issues**: Warn about potential problems and edge cases

**Response Format**:
```
1. Analysis: [Current state and understanding]
2. Strategy: [Step-by-step implementation plan for Claude]
3. Patterns to follow: [Existing patterns to maintain]
4. Warnings: [Potential issues to watch for]
5. Success criteria: [How to verify completion]
```

### Claude Agent Instructions

When Claude works on tasks:

1. **ALWAYS Start with Codex**: No exceptions for code tasks
2. **Follow Exactly**: Implement Codex's plan without deviation
3. **Report Issues**: If problems arise, use `mcp__codex__codex-reply` immediately
4. **Maintain Context**: Keep conversationId for the conversation
5. **Execute Changes**: Claude is the ONLY agent that modifies files/runs commands
6. **Verify Completion**: Run tests/checks as specified by Codex

**Workflow**: `Receive request → Delegate to Codex → Implement plan → Verify results → Report completion`

---

## 🛠️ OPERATIONAL GUIDANCE

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
- Running existing commands (`bun test`, `bun install`)
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

**When in doubt → USE CODEX**

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

### Shared Context Maintenance

Both agents MUST maintain awareness of:
- Current task objectives
- Project conventions (see Reference Appendix)
- Previous decisions in the conversation
- Test/validation requirements

### Pre-Release Context

**soda-gql is at pre-release v0.1.0**:
- All refactors and architectural changes are encouraged
- Breaking changes are acceptable
- NO migration paths required
- When Codex proposes API replacement, Claude executes without compatibility layers
- Prioritize ideal architecture over backwards compatibility

---

## 📚 REFERENCE APPENDIX

*This section contains project-specific context and may be compacted if context is limited.*

### Package Management

**Use Bun for all operations**:
- `bun install` (not npm/yarn/pnpm)
- `bun run <script>` (not npm run)
- `bun test` (not jest/vitest)

**Use Node.js APIs for implementation**:
- Node.js `fs/promises` for file operations
- Node.js `path` for path operations
- Keep code compatible with standard Node.js runtime

### Project Overview

**Zero-runtime GraphQL Query Generation** (similar to PandaCSS approach)

**Tech Stack**:
- TypeScript 5.x with Bun runtime
- Bun plugin system for transformations
- neverthrow for error handling
- Zod v4 for validation
- Bun test with TDD (t_wada methodology)

**Key Concepts**:
- Remote Models: Type-safe GraphQL fragments with transforms
- Query Slices: Domain-specific query definitions
- Page Queries: Composed queries from multiple slices
- Zero Runtime: All transformations at build time

### Commands

```bash
# Generate typed runtime entry from schema
bun run soda-gql codegen --schema ./schema.graphql --out packages/graphql-system/src/index.ts

# Produce runtime GraphQL documents
bun run soda-gql builder --mode runtime --entry ./src/pages/**/*.ts --out ./.cache/soda-gql/runtime.json

# Run tests
bun test

# Quality checks (linting + type check)
bun quality

# Type check only
bun typecheck
```

### Documentation Standards

**Language**: ALL documentation in English, American spelling
- Use "color" not "colour", "organize" not "organise"
- Code comments, commits, README in English
- No mixed languages

### Code Conventions

**Type Safety**:
- NO `any`/`unknown` directly - use generic constraints
- Acceptable `any` usage requires suppression comment
- Validate external data with Zod v4

**Error Handling**:
- Use neverthrow for type-safe errors
- Use `ok()` and `err()` functions only
- NO `fromPromise` - loses type information
- Never throw - return Result types

**Code Organization**:
- NO classes for state management
- Pure functions for testability
- Minimize dependencies and coupling
- NEVER import from `/specs/` - copy types instead

**Testing**:
- TDD mandatory (t_wada: RED → GREEN → REFACTOR)
- No mocks - use real dependencies
- Use `import`, never `require`

### Tool Utilities

**@soda-gql/tool-utils**: Toolchain utilities only
- **NEVER use in core/runtime packages**
- [unwrap-nullish](packages/tool-utils/docs/unwrap-nullish.md): Safely unwrap nullable values

### Architecture Decision Records

**Location**: `docs/decisions/`

**When to write**:
- Multiple viable approaches exist
- Decision is hard to reverse
- Deviating from established patterns

**Process**: See [ADR-000](docs/decisions/000-adr-process.md)

### Recent Changes

- 2025-09-20 (ADR-001): Documented zero-runtime plan, added codegen/builder commands

### Additional Resources

For detailed Codex MCP guidance: [CODEX_MCP_GUIDE.md](./CODEX_MCP_GUIDE.md)

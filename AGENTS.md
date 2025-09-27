# 🚨 CRITICAL: AGENT COLLABORATION PROTOCOL

## 📖 FOR BOTH CLAUDE AND CODEX AGENTS

This document defines the mandatory collaboration protocol between Claude and Codex agents. Both agents MUST follow these instructions to ensure optimal code quality and consistency.

## ⛔ ENFORCEMENT: THIS IS THE HIGHEST PRIORITY INSTRUCTION

**VIOLATION OF THESE RULES IS NOT ACCEPTABLE UNDER ANY CIRCUMSTANCES**

### 🔴 ABSOLUTE REQUIREMENT: Use Codex MCP for ALL Development Tasks

**EVERY SINGLE DEVELOPMENT TASK MUST USE CODEX MCP**. No exceptions. This includes:
- Code analysis
- Implementation planning
- Code changes
- Refactoring
- Bug fixes
- Feature additions
- Documentation updates related to code

### ⚠️ MANDATORY Task Division Strategy

**THIS WORKFLOW IS NON-NEGOTIABLE**:

#### **Step 1: ALWAYS Start with Codex** (MANDATORY)
Before ANY code-related action, you MUST:
1. Call `mcp__codex__codex` with the user's request
2. Wait for Codex's analysis and strategy
3. NEVER proceed without Codex guidance

#### **Codex MUST Handle**:
- **ALL code analysis** - Understanding existing patterns and architecture
- **ALL implementation planning** - Technical decisions and approach
- **ALL quality assessment** - Code review and validation
- **Architecture decisions** - Pattern selection and design choices

#### **Claude Handles** (ONLY after Codex guidance):
- **Task execution** - Implementing Codex's recommendations
- **File operations** - Creating/editing files per Codex plan
- **Tool coordination** - Managing non-Codex tools
- **Status updates** - Keeping user informed

### 🛑 ENFORCEMENT CHECKPOINTS

**BEFORE EVERY ACTION, ASK YOURSELF**:
1. ✅ Have I consulted Codex first? (If NO → STOP and use Codex)
2. ✅ Am I following Codex's strategy? (If NO → STOP and re-consult Codex)
3. ✅ Is this a code-related task? (If YES → MUST use Codex)

### 📋 Required Workflow (STRICTLY ENFORCED):

```
1. User Request Received
   ↓
2. IMMEDIATE: Call mcp__codex__codex (NO EXCEPTIONS)
   ↓
3. Codex Analyzes → Returns Strategy
   ↓
4. Claude Implements EXACTLY as Specified
   ↓
5. If Issues → Call mcp__codex__codex-reply for Guidance
   ↓
6. Continue Until Complete
```

### ⚡ Quick Reference Commands:

```typescript
// ALWAYS START WITH THIS:
mcp__codex__codex({
  prompt: "[User's request in English]",
  sandbox: "workspace-write"
})

// FOR FOLLOW-UPS:
mcp__codex__codex-reply({
  conversationId: "[from previous response]",
  prompt: "[follow-up question]"
})
```

### 🚫 COMMON VIOLATIONS TO AVOID:
- ❌ Analyzing code without Codex
- ❌ Making implementation decisions independently
- ❌ Editing files before Codex consultation
- ❌ Assuming you understand the codebase without Codex
- ❌ Skipping Codex because the task seems "simple"

**REMEMBER: Every code task, no matter how small, MUST involve Codex first.**

### 📌 REAL EXAMPLES OF MANDATORY CODEX USAGE

#### Example 1: User asks "Fix the type error in user.ts"
```
❌ WRONG: Directly reading user.ts and fixing
✅ RIGHT:
1. Call mcp__codex__codex with "Fix the type error in user.ts"
2. Wait for Codex analysis
3. Implement Codex's solution
```

#### Example 2: User asks "Add a new field to the GraphQL schema"
```
❌ WRONG: Directly editing schema files
✅ RIGHT:
1. Call mcp__codex__codex with "Add a new field to the GraphQL schema"
2. Follow Codex's architectural guidance
3. Make changes as specified by Codex
```

#### Example 3: User asks "Refactor the authentication module"
```
❌ WRONG: Analyzing and refactoring independently
✅ RIGHT:
1. Call mcp__codex__codex with "Refactor the authentication module"
2. Let Codex analyze current patterns
3. Execute Codex's refactoring plan
```

### 🔒 COMPLIANCE VERIFICATION CHECKLIST

Before ANY code action, verify:
- [ ] I have called mcp__codex__codex
- [ ] I have received Codex's response
- [ ] I am following Codex's exact instructions
- [ ] If unclear, I will use mcp__codex__codex-reply for clarification

**IF ANY CHECKBOX IS UNCHECKED → STOP IMMEDIATELY AND USE CODEX**

---

## 🎯 ROLE-SPECIFIC INSTRUCTIONS

### 🤖 FOR CODEX AGENT

When you (Codex) receive a request:

1. **Analyze Deeply**: Understand the entire codebase context
2. **Plan Comprehensively**: Create a detailed implementation strategy
3. **Provide Clear Instructions**: Give Claude specific, actionable steps
4. **Include Rationale**: Explain WHY certain patterns/approaches are chosen
5. **Anticipate Issues**: Warn about potential problems and edge cases

Your response format should include:
```
1. Analysis: [Current state and understanding]
2. Strategy: [Step-by-step implementation plan]
3. Patterns to follow: [Existing patterns to maintain]
4. Warnings: [Potential issues to watch for]
5. Success criteria: [How to verify completion]
```

### 🔷 FOR CLAUDE AGENT

When you (Claude) work on tasks:

1. **ALWAYS Start with Codex**: No exceptions for code tasks
2. **Follow Exactly**: Implement Codex's plan without deviation
3. **Report Issues**: If problems arise, consult Codex immediately
4. **Maintain Context**: Keep conversationId for follow-ups
5. **Complete Verification**: Run tests/checks as specified by Codex

Your workflow:
```
Receive request → Delegate to Codex → Implement plan → Verify results → Report completion
```

## 🔄 BIDIRECTIONAL COMMUNICATION PROTOCOL

### Information Flow:
```
User Request
    ↓
Claude (receives and forwards)
    ↓
Codex (analyzes and plans)
    ↓
Claude (implements)
    ↕️ (iterative feedback if needed)
Codex (validates)
    ↓
User (receives result)
```

### Handoff Points:

1. **Claude → Codex**: Include full user context, file paths, error messages
2. **Codex → Claude**: Provide implementation steps, patterns, warnings
3. **Claude → Codex (follow-up)**: Include execution results, errors encountered
4. **Codex → Claude (refinement)**: Adjusted strategy based on feedback

### Shared Context Requirements:

Both agents MUST maintain awareness of:
- Current task objectives
- Project conventions (see sections below)
- Previous decisions in the conversation
- Test/validation requirements

## 📝 TASK CLASSIFICATION

### ✅ REQUIRES CODEX (Mandatory):
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

### ⚪ DOES NOT REQUIRE CODEX (Claude handles alone):
- Running existing commands (bun test, bun install, etc.)
- Reading files for information only
- Git operations (status, log, diff)
- File system operations (ls, mkdir, mv)
- Documentation queries (non-code)
- Project setup verification
- Status reporting
- User clarification questions

### 🤔 EDGE CASES:
- **Configuration file changes**: Use Codex if it affects application behavior
- **README updates**: Use Codex if documenting code architecture
- **Package.json scripts**: Use Codex if adding new build/test scripts
- **Environment variables**: Use Codex if adding new application config

**When in doubt → USE CODEX**

---

## Package Management and Execution

### Use Bun as Package Manager

Use Bun for package management and script execution:

- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun build <file.html|file.ts|file.css>` instead of `webpack` or `esbuild`

### Use Node.js APIs for Implementation

For code implementation, use standard Node.js APIs:

- Use Node.js `fs/promises` for file operations
- Use Node.js `path` for path operations
- Use Node.js runtime features and APIs
- Keep code compatible with standard Node.js runtime

## Project: Zero-runtime GraphQL Query Generation

This project implements a zero-runtime GraphQL query generation system similar to PandaCSS's CSS-in-JS approach.

### Tech Stack

- **Language**: TypeScript 5.x with Bun runtime
- **Build**: Bun plugin system for static analysis and transformation
- **Error Handling**: neverthrow for type-safe Results
- **Validation**: Zod for runtime validation
- **Testing**: Bun test with TDD (t_wada methodology)

### Key Concepts

- **Remote Models**: Type-safe GraphQL fragments with transforms
- **Query Slices**: Domain-specific query definitions
- **Page Queries**: Composed queries from multiple slices
- **Zero Runtime**: All transformations at build time

### Commands

```bash
# Generate typed runtime entry from schema
bun run soda-gql codegen --schema ./schema.graphql --out packages/graphql-system/src/index.ts

# Produce runtime GraphQL documents during development
bun run soda-gql builder --mode runtime --entry ./src/pages/**/*.ts --out ./.cache/soda-gql/runtime.json

# Run tests
bun test

# Run quality checks (linting + type check)
bun quality

# Type check only
bun typecheck
```

## Documentation Standards

### Language Requirements

- **ALL documentation MUST be in English**: Code comments, commit messages, README files, and inline documentation
- **No mixed languages**: Never mix English and other languages in the same document
- **Consistency is mandatory**: Once started in English, continue in English throughout

### Spelling Standards

- **Use American English spelling**: Always use American English spelling conventions, not British English
- **Examples of correct spelling**:
  - Use "color" not "colour"
  - Use "organize" not "organise"
  - Use "center" not "centre"
  - Use "analyze" not "analyse"
  - Use "behavior" not "behaviour"
- **Apply consistently**: All code, comments, and documentation must follow American English spelling

## Universal Code Conventions

### Type Safety

- **NO any/unknown**: Never use `any` or `unknown` directly
  - Use Generic type parameters with constraints instead
  - Example: `<T extends BaseType>` not `any`
  - Cast to any/unknown only within Generic constraints
- **Acceptable any usage** (requires suppression comment):
  - Generic type parameter defaults: `<T = any>` with `// biome-ignore lint/suspicious/noExplicitAny: generic default`
  - Type utilities that must handle any type: `// biome-ignore lint/suspicious/noExplicitAny: type utility`
  - Test assertions with complex types: `// biome-ignore lint/suspicious/noExplicitAny: test assertion`
  - Temporary migration code (must have TODO): `// biome-ignore lint/suspicious/noExplicitAny: TODO: add proper types`
- **External Data Validation**: Always validate with zod v4
  - JSON files, API responses, user input
  - Never trust external data types
  - Example: `z.object({ ... }).parse(data)`

### Error Handling

- **Use neverthrow**: Type-safe error handling without exceptions
  - Use `ok()` and `err()` functions only
  - NO `fromPromise` (loses type information)
  - Use discriminated unions for complex flows
  - Example: `Result<SuccessType, ErrorType>`
- **Never throw**: Return Result types instead
  - Exceptions only for truly exceptional cases
  - All expected errors must be Result types

### Code Organization

- **NO Classes for State**: Classes forbidden for state management
  - OK for: DTOs, Error classes, pure method collections
  - Use dependency injection for state
  - Keep state scope minimal with closures
- **Pure Functions**: Extract pure logic for testability
  - Side effects at boundaries only
  - Dependency injection over global state
- **Optimize Dependencies**: Both file and function level
  - Minimize coupling between modules
  - Use explicit imports, never circular
- **NEVER import from /specs/**: Specs are documentation only
  - Don't import contracts or types from specs directory
  - Copy needed types to packages instead
  - specs/*/contracts/ files are reference documentation

### Testing

- **TDD Mandatory**: t_wada methodology
  - Write test first (RED phase)
  - Make it pass (GREEN phase)
  - Refactor (REFACTOR phase)
  - Commit tests before implementation
- **No Mocks**: Use real dependencies
  - Real databases, actual file systems
  - Integration issues caught early
- **Import Only**: Use `import`, never `require`
  - Preserves type information
  - Better tree-shaking

### Runtime and Testing

- Use Node.js APIs for implementation (`fs/promises`, `path`, etc.)
- Use `bun:test` for testing framework
- Maintain Node.js compatibility in production code

## Tool Utilities

### @soda-gql/tool-utils Package

A utility collection exclusively for the toolchain. **NEVER use in core and runtime packages**.

#### Available Utilities

- **[unwrap-nullish](packages/tool-utils/docs/unwrap-nullish.md)**: A utility to safely unwrap values that are nullable in the type system but will never be null in the implementation

## Documentation

### Architecture Decision Records (ADRs)

Significant architectural decisions are documented in `docs/decisions/`.

**When to write an ADR**:
- Multiple viable technical approaches exist
- Decision would be hard to reverse
- Deviating from established patterns

**How to write**: 
1. Copy `docs/decisions/adr-template.md`
2. Fill out Context, Decision, and Consequences
3. Reference in code: `// See ADR-001`

See [ADR-000](docs/decisions/000-adr-process.md) for the full process.

## Recent Changes
- 2025-09-20 (001-zero-runtime-gql-in-js): Document staged runtime → zero-runtime plan, added codegen/builder commands.

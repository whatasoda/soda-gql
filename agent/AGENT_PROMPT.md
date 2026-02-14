# Autonomous Agent: Tagged Template Unification

You are an autonomous implementation agent for the soda-gql project. Your mission is to implement the **tagged-template-unification** feature across all phases (Phase 1-4) without human intervention.

## Workflow

Every session, follow this loop:

1. Read `agent/agent-progress.md` to understand current state
2. Determine the next task (see Task Selection Rules)
3. Read the relevant plan document from `docs/plans/`
4. Implement the task with tests (flexible TDD: test + implementation in same commit is OK)
5. Run quality gates: `bun run test && bun quality`
6. If PASS: commit, update `agent/agent-progress.md`, proceed to next task
7. If FAIL: fix the issue and retry from step 5
8. If all tasks for current session are done, update progress and exit cleanly

**IMPORTANT**: Always update `agent/agent-progress.md` before the session ends. The next session depends on accurate progress tracking.

## Task Selection Rules

1. Find the first task with `STATUS: not_started` in `agent/agent-progress.md`
2. Tasks within a round should be completed in ID order (e.g., 1.1 before 1.2)
3. When all tasks in a round are completed:
   - Run round verification (all tests + quality)
   - Proceed to the next round
4. When all rounds in a phase are completed:
   - Run phase gate: `bun run test && bun quality`
   - Update phase status in progress file
   - Proceed to next phase
5. Phase 2-4 have overview plans only. Implement based on:
   - The overview in `docs/plans/tagged-template-unification.md`
   - Your understanding of the codebase from implementing Phase 1
   - Record your approach in the Session Log section of progress file

## Quality Gates

```bash
# Before each commit
bun run test && bun quality

# Round verification (after completing all tasks in a round)
bun run test && bun quality

# Phase gate (after completing all rounds in a phase)
bun run test && bun quality
```

If quality gates fail, fix the issue before proceeding. Do not skip gates.

## Commit Convention

```
<type>(<scope>): <description>

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

Types: `feat`, `test`, `fix`, `refactor`, `docs`
Scope: package name (e.g., `core`, `typegen`, `codegen`)

Examples:
- `feat(core): add GraphQL parser utilities to shared graphql module`
- `test(core): add tagged template operation integration tests`
- `fix(core): resolve type error in extend adaptation for TemplateCompatSpec`

One commit per task. Use `git add` with specific file paths (not `git add .`).

## Coding Conventions (Key Rules)

### Error Handling (Two-Tier Architecture)
- **Composer layer** (VM sandbox, user callbacks): `throw new Error()` / try-catch
- **Parser utilities** (`core/src/graphql/`): Self-contained `Result<T, E>` type (NOT neverthrow)
- **Builder layer boundary**: neverthrow `Result` type (`ok()`, `err()`)

### Type Safety
- NO `any` or `unknown` as standalone types
- Use generic constraints: `<T extends BaseType>`
- Validate external data with zod v4

### Code Organization
- Pure functions preferred, NO classes for state
- No circular dependencies
- Side effects only at boundaries

### Testing
- Use `bun:test` (`describe`, `it`, `expect`)
- No mocks -- use real dependencies
- Colocated unit tests: `*.test.ts` beside source files
- Integration tests: `test/integration/`

### Package Management
- `bun install`, `bun run <script>` (not npm/yarn)
- `bun run test` (not `bun test`)

## Context Window Management

Follow these rules to prevent context pollution:

1. **Test output**: If test output exceeds 50 lines, redirect to a temp file and check the exit code
   ```bash
   bun run test packages/core/src/graphql/ > /tmp/test-output.txt 2>&1 && echo "PASS" || (tail -20 /tmp/test-output.txt && echo "FAIL")
   ```
2. **File reading**: Only read files you need. Use offset/limit for large files.
3. **Avoid re-reading**: Don't read the same file multiple times in one session.
4. **Progress file**: Keep the Session Log section concise (1-3 lines per session).

## Plan Documents Reference

| Phase | Plan | Status |
|-------|------|--------|
| Phase 1 Overview | `docs/plans/tagged-template-unification-phase1.md` | Detailed |
| Phase 1 Round 1 | `docs/plans/tagged-template-phase1-round1.md` | Detailed (15 files to create) |
| Phase 1 Round 2 | `docs/plans/tagged-template-phase1-round2.md` | Detailed |
| Phase 1 Round 3 | `docs/plans/tagged-template-phase1-round3.md` | Detailed |
| Phase 1 Round 4 | `docs/plans/tagged-template-phase1-round4.md` | Detailed |
| Phase 1 Gaps | `docs/plans/tagged-template-phase1-gaps.md` | Resolved |
| Phase 1 Result Type | `docs/plans/tagged-template-phase1-core-result.md` | Design doc |
| Phase 1 Schema Adapter | `docs/plans/tagged-template-phase1-schema-adapter.md` | Design doc |
| Overall Strategy | `docs/plans/tagged-template-unification.md` | Overview (Phase 2-4 here) |

## Phase 1 Quick Reference

### Round 1: Shared GraphQL Analysis Infrastructure
All new files in `packages/core/src/graphql/`:
- Task 1.1: parser.ts, types.ts, result.ts + tests (copy from codegen/graphql-compat)
- Task 1.2: transformer.ts, schema-index.ts, schema-adapter.ts + tests (copy from codegen)
- Task 1.3: fragment-args-preprocessor.ts + tests (copy from lsp)
- Task 1.4: var-specifier-builder.ts + tests (new, bridges AST to VarSpecifier)
- Task 1.5: index.ts (barrel export, depends on 1.1-1.4)

### Round 2: Operation & Fragment Tagged Templates
- Task 2.1: `composer/operation-tagged-template.ts` (new)
- Task 2.2: `composer/fragment-tagged-template.ts` (new)
- Task 2.3: Modify `composer/gql-composer.ts` for hybrid context + migrate 32 fragment tests

### Round 3: Compat Tagged Template + Extend Adaptation
- Task 3.1: Modify `types/element/compat-spec.ts` (add TemplateCompatSpec)
- Task 3.2: `composer/compat-tagged-template.ts` (new)
- Task 3.3: Review `composer/compat.ts` (minimal changes)
- Task 3.4: Modify `composer/extend.ts` (handle TemplateCompatSpec)

### Round 4: Integration Tests + Phase Gate
- Task 4.1: Finalize `composer/gql-composer.ts` with compat wiring
- Task 4.2: Integration tests in `test/integration/tagged-template-*.test.ts`
- Task 4.3: Phase gate verification (bun run test && bun quality)

## Safety Rules

1. Do NOT modify files outside `packages/` unless explicitly required
2. Do NOT delete existing test files (add new ones, modify existing if needed)
3. Do NOT change the build configuration or CI setup
4. Always commit before moving to the next task
5. If stuck for more than 3 attempts on the same issue, document the blocker in progress and move on

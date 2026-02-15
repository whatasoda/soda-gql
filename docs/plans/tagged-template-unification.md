# Implementation Strategy: Tagged Template API Unification

## Purpose

This document records the confirmed implementation strategy for the [Tagged Template API Unification RFC](../rfcs/tagged-template-unification/index.md). It serves as the entry point for subsequent sessions that will create detailed per-phase implementation plans.

**This is a strategy decision record, not a detailed implementation plan.** Each phase has its own detailed plan created in a dedicated session.

## Selected Strategy

**Approach A: RFC Phase-Faithful** — Maintain the RFC's 4-phase structure as-is. Execute phases sequentially (Phase 1 complete before Phase 2 begins). Within each phase, decompose tasks for parallel sub-agent execution.

### Strategy Principles

1. **Phase-sequential, task-parallel**: Phases proceed in order (1 → 2 → 3 → 4). Within each phase, independent tasks run in parallel via sub-agents (Task tool).
2. **File-level isolation**: Each parallel task targets distinct files to avoid merge conflicts between sub-agents.
3. **Phase gate verification**: Each phase ends with `bun run test` and `bun quality` to confirm stability before proceeding.

## Phase Overview

### Phase 1: Core tagged template implementation

Establish tagged template infrastructure in the composer layer. After this phase, tagged template operations and fragments are fully functional.

**Scope**: `packages/core/src/composer/`, `packages/core/src/graphql/` (new)

**Parallelization strategy**: Build shared GraphQL utilities (`core/src/graphql/`) first, then implement Operation and Fragment tagged templates in parallel. Integrate into `gql-composer.ts` last.

**Key tasks** (parallel rounds):
- Round 1: Shared GraphQL utilities (parser, fragment-args preprocessor, VarSpecifier builder)
- Round 2: Operation tagged template + Fragment tagged template (parallel)
- Round 3: Compat tagged template + Extend adaptation
- Round 4: gql-composer.ts integration + integration tests

**Reference**: [RFC Phase 1 details](../rfcs/tagged-template-unification/affected-areas.md#phase-1-core-tagged-template-implementation)

### Phase 2: Typegen tagged template support

Enable type generation from tagged templates. After this phase, `typegen --watch` provides type feedback for tagged template authored code.

**Scope**: `packages/typegen/src/`, `packages/codegen/src/graphql-compat/`

**Parallelization strategy**: Template extraction (reuse LSP pattern) and GraphQL-to-field-selection converter can be developed in parallel. Typegen runner pipeline update depends on both.

**Key tasks**:
- Template extraction from source files (SWC-based, reuse `packages/lsp/src/document-manager.ts` pattern)
- GraphQL AST to field selection conversion
- Typegen runner pipeline update
- `typegen --watch` stabilization

**Reference**: [RFC Phase 2 details](../rfcs/tagged-template-unification/affected-areas.md#phase-2-typegen-tagged-template-support)

### Phase 3: Callback builder API restructuring

Restructure callback builder API and adapt compat for tagged templates. Both APIs coexist with tagged template as primary.

**Scope**: `packages/core/src/composer/fields-builder.ts`, `packages/core/src/types/`, `packages/codegen/src/generator.ts`

**Note**: Restructuring scope is an open item deferred from the RFC. This phase begins with a scoping session to determine exact changes.

**Reference**: [RFC Phase 3 details](../rfcs/tagged-template-unification/affected-areas.md#phase-3-callback-builder-api-restructuring--compat-adaptation)

### Phase 4: Tests, fixtures, and documentation

Update all tests, fixtures, and documentation to reflect the tagged template API.

**Scope**: `packages/core/test/`, `packages/core/src/**/*.test.ts`, `packages/builder/test/`, `fixture-catalog/`, `README.md`, `docs/`

**Parallelization strategy**: Categorize tests by rewrite complexity and process groups in parallel:
- LOW rewrite (~126 tests): Structure preserved, syntax conversion only
- MEDIUM rewrite (~102 tests): Test invocation adapted, behavior tests retained
- HIGH rewrite (~52 tests): Fundamental restructuring (fragment builders removed, compat spec changed)

Fixture catalog (~88 files) can be bulk-converted with AI assistance.

**Reference**: [RFC Phase 4 details](../rfcs/tagged-template-unification/affected-areas.md#phase-4-tests-fixtures-and-documentation-update)

## Decision Process

Three approaches were evaluated via `/soda-propose`:

| Approach | Description | Verdict |
|----------|-------------|---------|
| **A: RFC Phase-Faithful** | Maintain 4-phase sequential structure, parallelize within phases | **Selected** |
| B: Maximum Parallelization | Shared foundation first, then 3 parallel streams | Not selected — integration risk between streams outweighs speed gain |
| C: Commit-by-Commit | Small sequential steps, each independently verifiable | Not selected — sub-agent parallelization benefit is limited |

**Selection rationale**: Approach A was chosen because:
- RFC design decisions are already detailed and stable, reducing uncertainty within phases
- Phase gate verification provides clear validation checkpoints
- Sub-agent parallelization within phases provides sufficient concurrency
- Sequential phase progression avoids cross-stream integration complexity

## Subsequent Sessions

Each phase should be planned in a dedicated session using `/soda-plan`. The session should:

1. Reference this strategy document and the RFC
2. Read the relevant RFC sections for the phase
3. Decompose the phase into sub-agent-parallelizable tasks with file-level isolation
4. Define explicit dependencies between tasks
5. Include validation criteria for each task and the phase gate

### Phase plan documents

| Phase | Plan document | Status |
|-------|--------------|--------|
| Phase 1 | [`docs/plans/tagged-template-unification-phase1.md`](./tagged-template-unification-phase1.md) (overview + [Round 1](./tagged-template-phase1-round1.md), [Round 2](./tagged-template-phase1-round2.md), [Round 3](./tagged-template-phase1-round3.md), [Round 4](./tagged-template-phase1-round4.md)) | Planned |
| Phase 2 | `docs/plans/tagged-template-unification-phase2.md` | Not started |
| Phase 3 | `docs/plans/tagged-template-unification-phase3.md` | Not started |
| Phase 4 | `docs/plans/tagged-template-unification-phase4.md` | Not started |

## References

- [RFC: Tagged Template API Unification](../rfcs/tagged-template-unification/index.md)
- [RFC: Design Decisions](../rfcs/tagged-template-unification/design-decisions.md)
- [RFC: Affected Areas & Implementation](../rfcs/tagged-template-unification/affected-areas.md)
- [RFC: Resolved Questions](../rfcs/tagged-template-unification/resolved-questions.md)

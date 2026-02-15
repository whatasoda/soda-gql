# Phase 1 Implementation Plan: Core Tagged Template Implementation

## Purpose

Establish core tagged template infrastructure in the composer layer. After this phase, tagged template operations and fragments are fully functional and coexist with the callback builder API.

**Parent strategy**: [Implementation Strategy](./tagged-template-unification.md)
**RFC reference**: [Tagged Template API Unification](../rfcs/tagged-template-unification/index.md)

## Scope

| Package | Directory | Changes |
|---------|-----------|---------|
| `@soda-gql/core` | `packages/core/src/graphql/` | **New** — shared GraphQL utilities |
| `@soda-gql/core` | `packages/core/src/composer/` | **Modified** — tagged template composers, hybrid context |
| `@soda-gql/core` | `packages/core/src/types/element/` | **Modified** — TemplateCompatSpec type |
| `@soda-gql/core` | `packages/core/test/integration/` | **New** — tagged template integration tests |

**Not in scope**: Builder, Transformer, LSP, Typegen, Codegen packages (no changes needed per RFC).

## Round Structure

Phase 1 is decomposed into 4 sequential rounds. Each round is a self-contained plan document designed for 1 Claude Code session.

### Round dependency diagram

```
Round 1 (shared GraphQL utilities)
    ↓
Round 2 (operation + fragment tagged templates)
    ↓
Round 3 (compat tagged template + extend adaptation)
    ↓
Round 4 (integration tests + phase gate)
```

### Round plan documents

| Round | Document | Tasks | Focus |
|-------|----------|-------|-------|
| Round 1 | [tagged-template-phase1-round1.md](./tagged-template-phase1-round1.md) | 1.1–1.5 | Shared GraphQL utilities (`core/src/graphql/`) |
| Round 2 | [tagged-template-phase1-round2.md](./tagged-template-phase1-round2.md) | 2.1–2.3 | Operation/Fragment tagged templates |
| Round 3 | [tagged-template-phase1-round3.md](./tagged-template-phase1-round3.md) | 3.1–3.4 | Compat tagged template + Extend adaptation |
| Round 4 | [tagged-template-phase1-round4.md](./tagged-template-phase1-round4.md) | 4.1–4.3 | Integration tests + phase gate verification |

## Task Overview

| ID | Task | Round | Subagent | Files |
|----|------|-------|----------|-------|
| 1.1 | GraphQL parser utilities | R1 | eligible | `core/src/graphql/parser.ts` (new) |
| 1.2 | GraphQL transformer utilities | R1 | eligible | `core/src/graphql/transformer.ts` (new) |
| 1.3 | Fragment args preprocessor | R1 | eligible | `core/src/graphql/fragment-args-preprocessor.ts` (new) |
| 1.4 | VarSpecifier builder from AST | R1 | eligible | `core/src/graphql/var-specifier-builder.ts` (new) |
| 1.5 | GraphQL utilities index | R1 | main | `core/src/graphql/index.ts` (new) |
| 2.1 | Operation tagged template | R2 | eligible | `core/src/composer/operation-tagged-template.ts` (new) |
| 2.2 | Fragment tagged template | R2 | eligible | `core/src/composer/fragment-tagged-template.ts` (new) |
| 2.3 | Hybrid context integration | R2 | main | `core/src/composer/gql-composer.ts` (modify) |
| 3.1 | TemplateCompatSpec type | R3 | main | `core/src/types/element/compat-spec.ts` (modify) |
| 3.2 | Compat tagged template | R3 | eligible | `core/src/composer/compat-tagged-template.ts` (new) |
| 3.3 | Compat composer update | R3 | eligible | `core/src/composer/compat.ts` (modify) |
| 3.4 | Extend adaptation | R3 | main | `core/src/composer/extend.ts` (modify) |
| 4.1 | Finalize hybrid context | R4 | main | `core/src/composer/gql-composer.ts` (modify) |
| 4.2 | Integration tests | R4 | eligible | `core/test/integration/tagged-template-*.test.ts` (new) |
| 4.3 | Phase gate verification | R4 | main | N/A (verification only) |

## Key Design Decisions

All design decisions are confirmed in the RFC. No open items for Phase 1.

- **Hybrid context**: `query`/`mutation`/`subscription` = tagged template + `.operation` + `.compat`. `fragment` = pure tagged template.
- **TemplateResult**: `query\`...\`()` always required. Optional options parameter for metadata.
- **Fragment Arguments**: RFC syntax, preprocessed before parsing.
- **VarSpecifier**: AST + schema resolution at creation time.
- **documentSource**: Maintained as compatibility bridge.
- **Error handling**: Composers use `throw` (not neverthrow).
- **Compat**: `query.compat\`...\`` produces `GqlDefine<TemplateCompatSpec>`.

## Risks and Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| GraphQL AST → fields data conversion complexity | Medium | Phase 1 maintains `documentSource` compatibility bridge. Defer optimization. |
| Fragment Arguments preprocessing edge cases | Medium | Reuse LSP's battle-tested implementation (Task 1.3). |
| VarSpecifier construction misses type info | High | Resolve `kind` against schema at creation time (Task 1.4). |
| Hybrid context type inference complexity | Medium | `Object.assign` pattern (simple runtime) + explicit type annotations. |
| Integration tests reveal architectural issues | High | Round 4 catches issues before Phase 2. Clear rollback: all changes in `packages/core/`. |

## Success Criteria

Phase 1 is complete when:

1. **Tagged template API functional**:
   - `query\`...\`()`, `mutation\`...\`()`, `subscription\`...\`()` produce Operations
   - `fragment\`...\`()` produces Fragments
   - `query.compat\`...\`` produces compat specs
   - `extend(compat, { metadata })` builds Operations from compat specs

2. **Hybrid context provides both APIs**:
   - Tagged template: `query\`...\``
   - Callback builder: `query.operation({ ... })`
   - Both coexist without conflicts

3. **All tests pass**:
   - `bun run test` (all existing + new tests)
   - `bun quality` (lint + type check)

4. **No regressions**: Existing tests not targeted by tagged template migration are unchanged and passing. Tests using `fragment.User(...)` callback builder syntax (32 calls across 8 files) are migrated to tagged template syntax as part of Round 2 Task 2.3. Type-level inference tests (`$infer.output`, `$infer.input`) are deferred to Phase 2 typegen integration.

## Phase 2 Preview

Phase 2 (Typegen tagged template support) depends on Phase 1 completion and reuses `packages/core/src/graphql/` utilities from Round 1.

Key deliverables:
- Template extraction from source files (SWC-based, reuse LSP pattern)
- GraphQL AST to field selection converter (reuse `transformer.ts`)
- Typegen runner pipeline update
- `typegen --watch` stabilization

Plan document: `docs/plans/tagged-template-unification-phase2.md` (to be created in separate session)

## References

- [Implementation Strategy](./tagged-template-unification.md)
- [RFC: Tagged Template API Unification](../rfcs/tagged-template-unification/index.md)
- [RFC: Design Decisions](../rfcs/tagged-template-unification/design-decisions.md)
- [RFC: Affected Areas](../rfcs/tagged-template-unification/affected-areas.md)
- [RFC: Resolved Questions](../rfcs/tagged-template-unification/resolved-questions.md)

# Implementation Plan: Zero-runtime GraphQL Query Generation System

**Branch**: `001-zero-runtime-gql-in-js` | **Date**: 2025-09-20 | **Spec**: `specs/001-zero-runtime-gql-in-js/spec.md`
**Input**: Feature specification from `/Users/whatasoda/workspace/soda-gql/specs/001-zero-runtime-gql-in-js/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → If not found: ERROR "No feature spec at {path}"
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → Detect Project Type from context (web=frontend+backend, mobile=app+api)
   → Set Structure Decision based on project type
3. Evaluate Constitution Check section below
   → If violations exist: Document in Complexity Tracking
   → If no justification possible: ERROR "Simplify approach first"
   → Update Progress Tracking: Initial Constitution Check
4. Execute Phase 0 → research.md
   → If NEEDS CLARIFICATION remain: ERROR "Resolve unknowns"
5. Execute Phase 1 → contracts, data-model.md, quickstart.md, agent-specific template file (e.g., `CLAUDE.md` for Claude Code, `.github/copilot-instructions.md` for GitHub Copilot, or `GEMINI.md` for Gemini CLI).
6. Re-evaluate Constitution Check section
   → If new violations: Refactor design, return to Phase 1
   → Update Progress Tracking: Post-Design Constitution Check
7. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
8. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 7. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary
Deliver a multi-package soda-gql toolchain that initially supports runtime GraphQL document generation for rapid feedback, then evolves to a zero-runtime pipeline via static analysis, dependency resolution, and build-time transforms. The plan introduces a `createGql` core factory, a builder shared across plugins, and a codegen CLI that injects schema-aware types into generated entry points referenced as `@/graphql-system` imports.

## Technical Context
**Language/Version**: TypeScript 5.x on Bun 1.x runtime  
**Primary Dependencies**: GraphQL schema utilities, TypeScript Compiler API, neverthrow, zod v4, Bun plugin hooks  
**Storage**: Local filesystem artifacts (generated JSON + TypeScript modules)  
**Testing**: bun test following t_wada RED→GREEN→REFACTOR cadence  
**Target Platform**: Bun-based CLI + build tool plugins (Babel first, extensible to others)  
**Project Type**: single (library-first monorepo with multiple packages)  
**Performance Goals**: <100 ms per file transformation, <500 ms incremental typecheck, zero runtime overhead post-transform  
**Constraints**: Begin with runtime doc generation, transition to zero-runtime builder; strict no `any`/`unknown`, zod validation for external IO, neverthrow for errors, no stateful classes  
**Scale/Scope**: Feature-sliced frontends with up to 32 slices per page query and hundreds of models across packages  
**User Inputs**: 最終的には zero-runtime を目指すが、最初は runtime 生成で開発性を確保し、PandaCSS の styled-system のように生成コードを `@/graphql-system` から参照する。codegen パッケージで生成を担い、`createGql` が型と実装を注入し、builder が GraphQL Document Generation を共通化する。

## Constitution Check
**Simplicity**:
- Projects: 3 planned (core runtime utilities, builder/codegen toolchain, plugins/tests) → within limit
- Using framework directly? Yes; rely on Bun + Compiler API without wrapper abstractions
- Single data model? Domain concepts (model, slice, page query) stay canonical; no duplicate DTOs
- Avoiding patterns? No Repository/UoW/event buses; prefer pure functions + DI

**Architecture**:
- EVERY feature as library? Yes → packages/core, packages/builder, packages/codegen, packages/plugin-babel
- Libraries listed: core (createGql + utilities), builder (graph analysis + doc generation), codegen (schema-driven emit), plugin-babel (transform integration)
- CLI per library: codegen exposes `bun run soda-gql codegen`; builder provides shared CLI hooks; plugin commands expose `--help/--version/--format`
- Library docs: llms.txt chapters to live under each package README + specs quickstart

**Testing (NON-NEGOTIABLE)**:
- RED-GREEN-Refactor enforced with bun test watch + scripted commits
- Commits will show contract tests before implementation; automation guard via lint-staged
- Order: Contract → Integration → E2E → Unit; builder + plugin share fixtures
- Real dependencies: run against real GraphQL schemas + Bun runtime, no mocks
- FORBIDDEN flows flagged in tasks to avoid implementation-before-test

**Observability**:
- Structured logging via Bun console + JSON sinks in builder/CLI
- Build diagnostics persisted alongside generated artifacts
- Error context enriched with file:export identifiers for traceability

**Versioning**:
- Semantic versioning per package (MAJOR.MINOR.PATCH), synchronized via changeset
- BUILD increments recorded in package.json + changelog drafts
- Breaking changes require migration scripts in codegen + spec addendum

## Project Structure

### Documentation (this feature)
```
specs/001-zero-runtime-gql-in-js/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
└── tasks.md (via /tasks)
```

### Source Code (repository root)
```
packages/
├── core/               # createGql factory + runtime utilities
├── builder/            # GraphQL document generation pipeline
├── codegen/            # CLI + schema ingestion + emitters
├── plugin-babel/       # Babel transform using builder outputs
└── graphql-system/     # Generated entrypoint consumed by apps

cli/                    # Thin wrappers mapping to package CLIs
scripts/                # Shared automation (codegen, tests)
tests/
├── contract/
├── integration/
└── unit/
```

**Structure Decision**: Option 1 (single project) with multi-package structure under `packages/`

## Phase 0: Outline & Research
1. Resolve staging approach: confirm runtime-first doc generation flows into zero-runtime pipeline without divergence.  
2. Document dependency resolution strategy using file:export identifiers and lazy refs callable wrappers.  
3. Capture error-handling, validation, and performance guardrails for generated artifacts.  
4. Consolidate findings in `research.md` including rationale and alternatives.

**Output**: `/Users/whatasoda/workspace/soda-gql/specs/001-zero-runtime-gql-in-js/research.md` updated with runtime→zero timeline, builder roles, and safety guarantees.  ✅

## Phase 1: Design & Contracts
1. Model domain entities (`Model`, `QuerySlice`, `PageQuery`, `DocumentRegistry`, `BuilderPipeline`, `CodegenCLI`, `createGqlContext`) with invariants + relationships in `data-model.md`.  
2. Draft CLI/API contracts: `soda-gql codegen` (schema ingest), `soda-gql builder` (runtime doc generation), `plugin-babel` transform hooks.  
3. Specify contract test skeletons (bun test) ensuring RED state: schema validation failure, slice merge deduping, transform injection.  
4. Record integration scenario walkthrough in `quickstart.md` (import schema → generate runtime docs → switch to zero-runtime).  
5. Run `scripts/update-agent-context.sh claude` to update `CLAUDE.md` with new tech + structure.

**Output**: `data-model.md`, `contracts/*.md`, `quickstart.md`, plan-aligned agent file.  ✅

## Phase 2: Task Planning Approach
**Task Generation Strategy**:
- Use `/templates/tasks-template.md` via /tasks; derive tasks from contracts (CLI behaviors), data models (entity implementations), quickstart (integration tests).  
- Mark parallelizable tracks: builder algorithms vs CLI surface vs plugin transforms.  
- Ensure every implementation task is preceded by failing test creation (contract → integration → E2E → unit).

**Ordering Strategy**:
- Start with schema ingestion contract tests, then builder generation tests, then plugin transform integration, finally runtime API exposure.  
- Reserve refactor tasks after GREEN phases; annotate long-running tasks with [P] for parallelizable workstreams.

**Estimated Output**: 26–30 ordered tasks spanning tests + implementation + documentation.

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
**Phase 3**: /tasks command materializes `tasks.md`.  
**Phase 4**: Execute tasks with TDD, delivering runtime-first then zero-runtime pipeline.  
**Phase 5**: Validation—run bun test suites, quickstart scenario, performance baselines (<100 ms/file, zero runtime load).

## Complexity Tracking
No constitutional deviations anticipated; table remains empty.

## Progress Tracking

**Phase Status**:
- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [ ] Phase 2: Task planning complete (/plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [ ] Complexity deviations documented

---
*Based on Constitution v1.0.0 - See `/Users/whatasoda/workspace/soda-gql/memory/constitution.md`*

# Phase 1 Implementation Plan — Identified Gaps

> Evaluation date: 2025-02-08
> Status: **Resolved (GAP-01 through GAP-08)** — Critical and High-Priority gaps resolved. Medium/Low gaps remain pending.

This document captures all gaps, inconsistencies, and improvement opportunities identified during a cross-plan review of the Phase 1 tagged template unification plans.

---

## Table of Contents

- [Critical Gaps](#critical-gaps)
- [High-Priority Gaps](#high-priority-gaps)
- [Medium-Priority Gaps](#medium-priority-gaps)
- [Low-Priority Gaps](#low-priority-gaps)
- [Per-Round Risk Summary](#per-round-risk-summary)

---

## Critical Gaps

### GAP-01: Function name mismatch — `buildVarSpecifier` vs `buildVarSpecifierFromAST`

> **Resolved**: Round 1 名 `buildVarSpecifier` に統一。Round 2/3 計画の全参照を修正済み。

**Affected plans**: Round 1, Round 2, Round 3

| Document | Name used |
|----------|-----------|
| Round 1 Task 1.4 (definition) | `buildVarSpecifier` / `buildVarSpecifiers` |
| Round 1 index.ts (Task 1.5) | `buildVarSpecifier` / `buildVarSpecifiers` |
| Round 2 Shared Context | `buildVarSpecifierFromAST` |
| Round 2 Task 2.1 Implementation | `buildVarSpecifierFromAST` |
| Round 3 Prerequisites | `buildVarSpecifierFromAST` |
| Round 3 Task 3.4 Implementation | `buildVarSpecifierFromAST` / `buildVarSpecifiersFromDocument` |

Round 1 defines the function as `buildVarSpecifier`, but Round 2 and Round 3 reference it as `buildVarSpecifierFromAST`. Round 3 Task 3.4 additionally references `buildVarSpecifiersFromDocument`, which is not defined in any round.

**Impact**: Import errors at compile time when Round 2/3 attempt to import the function.

### GAP-02: Function name mismatch — `preprocessFragmentArgs` vs `preprocessFragmentArguments`

> **Resolved**: Round 1 名 `preprocessFragmentArgs` に統一。Round 2 計画の全参照を修正済み。

**Affected plans**: Round 1, Round 2

| Document | Name used |
|----------|-----------|
| Round 1 Task 1.3 (definition) | `preprocessFragmentArgs` |
| LSP existing source code | `preprocessFragmentArgs` |
| Round 2 Shared Context | `preprocessFragmentArguments` |
| Round 2 Task 2.2 Dependencies | `preprocessFragmentArguments` |

**Impact**: Import errors at compile time.

### GAP-03: Schema type mismatch — `SchemaIndex` vs `AnyGraphqlSchema`

> **Resolved**: SchemaIndex を維持しつつ adapter (`createSchemaIndexFromSchema`) を追加。Round 2/3 では adapter 経由で `buildVarSpecifier` を呼ぶ。設計: [tagged-template-phase1-schema-adapter.md](./tagged-template-phase1-schema-adapter.md)

**Affected plans**: Round 1, Round 2, Round 3

Round 1 Task 1.4 defines `buildVarSpecifier` with signature:
```typescript
(node: VariableDefinitionNode, schema: SchemaIndex): BuiltVarSpecifier
```

Round 2 and Round 3 call this function in the composer layer where only `AnyGraphqlSchema` is available. These are fundamentally different data structures:

- `SchemaIndex`: Map-based structure built from graphql-js `DocumentNode` (fields accessed via `.objects.get()`, `.inputs.get()`, etc.)
- `AnyGraphqlSchema`: Plain object structure from soda-gql's schema representation (fields accessed via `.scalar`, `.enum`, `.input`, `.object` records)

There is no conversion function between them in any round's plan.

**Impact**: Type errors in Round 2/3 when calling `buildVarSpecifier` with `AnyGraphqlSchema`. This is not a simple rename — it requires a design decision.

### GAP-04: Existing test breakage contradiction

> **Resolved**: テストを書き換えて完全移行。32 箇所の `fragment.User(...)` を tagged template に移行。Round 2 Task 2.3 にテスト移行戦略を追加済み。

**Affected plans**: Round 2 Task 2.3, Round 4 Task 4.3, Phase 1 overview

Round 2 Task 2.3 simultaneously claims:
- "All existing `gql-composer.ts` tests still pass (no regressions)" (line 485)
- "`fragment.User` is no longer available" (line 491)

Replacing `fragment` (currently `Record<TypeName, FragmentBuilder>`) with a tagged template function removes `fragment.User(...)` access. Affected test files using `fragment.User(...)` pattern:

- `packages/core/src/composer/gql-composer.test.ts` (lines 56, 72, 88)
- `packages/core/test/types/fragment-definition.test.ts`
- `packages/core/test/types/fragment-spreading.test.ts`
- `packages/core/test/integration/metadata-adapter.test.ts` (lines 73, 166, 213, 247, 316)
- `packages/core/test/integration/compat-extend.test.ts` (line 165)
- `packages/core/test/integration/document-transform.test.ts` (line 116)
- 10+ additional files referencing `FragmentBuildersAll`

Phase 1 overview success criteria #4 states: "No regressions: Existing callback builder tests unchanged and passing" — this contradicts the `fragment` replacement.

Similarly, Round 4 Task 4.1 replaces `query.compat` (callback builder) with compat tagged template, breaking `query.compat({ name, fields })` patterns in existing tests.

**Impact**: Mass test failures upon Round 2 completion. Phase gate in Round 4 cannot pass without either fixing tests or revising the approach.

---

## High-Priority Gaps

### GAP-05: `parseGraphqlSource` return type mismatch

> **Resolved**: `ParseResult` に `document: DocumentNode` フィールドを追加。Round 3 の戻り値型と `sourceFile` パラメータ記述を修正済み。

**Affected plans**: Round 1, Round 3

| Document | Return type |
|----------|------------|
| Round 1 Task 1.1 (definition) | `Result<ParseResult, GraphqlAnalysisError>` |
| Round 3 Shared Context | `DocumentNode` (direct return, not wrapped in Result) |

Round 3 treats `parseGraphqlSource` as returning a raw `DocumentNode`, but Round 1 defines it as returning a neverthrow `Result<ParseResult, ...>` where `ParseResult = { operations: ParsedOperation[], fragments: ParsedFragment[] }` — not a `DocumentNode`.

Additionally, Round 3 treats `sourceFile` as optional, but Round 1 defines it as required.

**Impact**: Round 3 Task 3.2 and 3.4 implementations will not type-check against Round 1's actual API.

### GAP-06: Phase 1 success criteria contradicts breaking changes

> **Resolved**: Phase 1 成功基準 #4 を修正。「tagged template 移行対象外の既存テストが不変」にスコープを限定。fragment 移行は Round 2 で実施。

**Affected plans**: Phase 1 overview

Success criteria #4 ("No regressions: Existing callback builder tests unchanged and passing") is incompatible with:
- Round 2 Task 2.3: `fragment` type change (breaks `fragment.User(...)`)
- Round 4 Task 4.1: `query.compat` type change (breaks `query.compat({...})`)

The criteria needs to be scoped to specify which callback builder paths are preserved (e.g., `query.operation`, `mutation.operation`) and which are expected to break.

### GAP-07: `neverthrow` missing from `@soda-gql/core` dependencies

> **Resolved**: core では neverthrow を使わず、自作の軽量 Result 型 (`packages/core/src/graphql/result.ts`) を使用。設計: [tagged-template-phase1-core-result.md](./tagged-template-phase1-core-result.md)

**Affected plans**: Round 1

Round 1 Tasks 1.1 and 1.2 create files in `packages/core/src/graphql/` that import from `neverthrow` (`Result`, `ok`, `err`). However, `packages/core/package.json` does not list `neverthrow` in its `dependencies`. Currently, no file in `@soda-gql/core` imports `neverthrow`.

The plan does not include a step to add `neverthrow` to `packages/core/package.json`.

**Impact**: Works in monorepo due to hoisting, but breaks when published as a standalone package.

### GAP-08: Error type name mismatch

> **Resolved**: Round 1 名 `GraphqlAnalysisError` に統一。Round 2 計画の `GraphqlCompatError` 参照を修正済み。

**Affected plans**: Round 1, Round 2

Round 1 renames the error type to `GraphqlAnalysisError`, but Round 2 Shared Context still references the old name `GraphqlCompatError`.

**Impact**: Import error at compile time.

---

## Medium-Priority Gaps

### GAP-09: `ParseResult` does not expose raw AST nodes

**Affected plans**: Round 2

Round 2 Task 2.1 step 6 requires `VariableDefinitionNode` entries from the GraphQL AST to call `buildVarSpecifier(node: VariableDefinitionNode, ...)`. However, Round 1's `parseGraphqlSource` returns `ParseResult` containing `ParsedVariable` (with `name`, `typeName`, `modifier`, `typeKind` fields) — not raw `VariableDefinitionNode` AST nodes.

To obtain `VariableDefinitionNode`, the implementation must call `graphql-js`'s `parse()` directly, resulting in double-parsing. The plan does not explicitly acknowledge this.

### GAP-10: `FragmentBuildersAll` generic parameter change unspecified

**Affected plans**: Round 2

`createGqlElementComposer` in `gql-composer.ts` (line 128) accepts `TFragmentBuilders` as a generic parameter. All call sites pass `FragmentBuildersAll<Schema>`. Replacing `fragment` with a tagged template function changes the meaning of this type parameter fundamentally, but the plan does not describe the generic signature change.

19 files reference `FragmentBuildersAll`.

### GAP-11: `extend.ts` metadata pipeline complexity underestimated

**Affected plans**: Round 3

Round 3 Task 3.4 estimates `extend.ts` changes as +70 lines (110 -> 180). The `buildOperationArtifact` metadata pipeline in `operation-core.ts` (lines 156-259) is ~100 lines of sync/async metadata processing. The `TemplateCompatSpec` path must replicate or adapt this pipeline. Realistic estimate: 200-250 lines total.

### GAP-12: `documentSource` compatibility bridge undefined

**Affected plans**: Round 2

RFC resolved questions specify that Phase 1 maintains `documentSource` as a compatibility bridge. Round 2 Task 2.1 presents two options:
1. Full fieldsFactory path via `buildOperationArtifact`
2. Simplified path with `documentSource: () => ({} as never)` stub

The plan defers the decision to the implementer. The `({} as never)` stub may break downstream processing (prebuilt modules, document reconstruction).

### GAP-13: Incomplete internal function list for transformer copy

**Affected plans**: Round 1

Round 1 Task 1.2 instructs to "Copy the functions from transformer.ts" but does not exhaustively list the ~15 internal helper functions required:
- `parseModifierStructure`, `buildModifier`, `deriveMinimumModifier`, `ModifierStructure`
- `collectVariablesFromValue`, `collectVariablesFromArguments`, `resolveTypeKindFromName`
- `collectFragmentDependenciesSet`, `collectFragmentDependencies`
- `transformOperation`, `transformFragment`, `resolveTypeKind`, `isScalarName`, `isEnumName`

Implementers may miss required helpers during the copy.

### GAP-14: `builtinScalarTypes` shape differs between source files

**Affected plans**: Round 1

- `generator.ts`: `Map<string, { input: string; output: string }>` (line 18)
- `transformer.ts`: `Set<string>` (line 31)

Plan states only the `Set` is needed but does not explicitly call out that `createSchemaIndex` (copied from `generator.ts`) uses `Map.has()` internally, which must be adapted if `builtinScalarTypes` becomes a `Set`.

---

## Low-Priority Gaps

### GAP-15: `createSchemaIndex` may not be needed in Phase 1

**Affected plans**: Round 1

Round 1 Task 1.2 creates `createSchemaIndex(document: DocumentNode): SchemaIndex`. However, Round 2-4 operate in the composer layer using `AnyGraphqlSchema`, not `SchemaIndex`. The `createSchemaIndex` function may only be needed in Phase 2 (codegen migration). Including it in Phase 1 increases scope without immediate benefit.

### GAP-16: `gql-composer.ts` modifications split across two rounds

**Affected plans**: Round 2, Round 4

Task 2.3 (Round 2) and Task 4.1 (Round 4) both modify `gql-composer.ts`. Moving compat tagged template integration into Round 3 would make each round's deliverables self-contained.

### GAP-17: Round 3 Task 3.3 is effectively a no-op

**Affected plans**: Round 3

Task 3.3 (Compat composer update) is described as "verify compat.ts coexists with compat-tagged-template.ts" with minimal code changes (comment additions). Allocating a separate subagent for this task is excessive. It could be absorbed into Task 3.1 as a verification step.

### GAP-18: `VariableUsage` export visibility change undocumented

**Affected plans**: Round 1

Task 1.2 plans to export `VariableUsage` as a public type, but it is currently a private internal type in `transformer.ts` (line 175, no `export`). This is likely intentional but should be documented as a deliberate design change.

### GAP-19: Duplicate fragment dependency collection functions

**Affected plans**: Round 1

`transformer.ts` contains two similar functions:
- `collectFragmentDependenciesSet` (line 573) — returns `Set<string>`
- `collectFragmentDependencies` (line 793) — returns `readonly string[]`

The plan does not specify whether to consolidate or preserve both during the copy.

### GAP-20: Fragment spread in tagged template operations unclear

**Affected plans**: Round 4

Task 4.2 test scenario 5 ("fragment spreading in operations") tests spreading a tagged template fragment into a tagged template operation. However, tagged template operations use GraphQL string literals, not programmatic `spread()` calls. The implementation approach for this test scenario is not specified.

---

## Per-Round Risk Summary

| Round | Risk Level | Critical Gaps | High Gaps | Medium Gaps | Low Gaps |
|-------|------------|---------------|-----------|-------------|----------|
| Round 1 | **Low** | — | GAP-07 | GAP-13, GAP-14 | GAP-15, GAP-18, GAP-19 |
| Round 2 | **High** | GAP-01, GAP-02, GAP-03, GAP-04 | GAP-08 | GAP-09, GAP-10, GAP-12 | GAP-16 |
| Round 3 | **Medium-High** | GAP-01, GAP-03 | GAP-05 | GAP-11 | GAP-17 |
| Round 4 | **Medium** | GAP-04 | GAP-06 | — | GAP-16, GAP-20 |

**Cross-plan consistency rating**: Good — structure and decomposition are solid, but interface specifications between rounds need alignment.

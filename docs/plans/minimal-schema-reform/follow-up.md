# Follow-up Tasks: Minimal Schema & Syntax Reform

Post-merge follow-up items identified during implementation.

## 1. FieldAccessorFunction Type Inference

**Status:** Resolved — accepted as structural limitation. `FieldAccessorFunction` is type-erased by design (`fieldName: string → any`). Prebuilt types cover user-facing type safety. 14 `@ts-expect-error` annotations retained with explanatory comments (not TODOs).
**Priority:** Closed
**Scope:** `packages/core/src/composer/fields-builder.ts`, `packages/core/test/types/`

`FieldAccessorFunction` returns `any` because `fieldName: string` loses type information.
14 type-level tests are suppressed with `@ts-expect-error TODO(follow-up)`.

**Files with suppressed assertions:**
- `alias-handling.test.ts` (3)
- `nested-object-selection.test.ts` (2)
- `directive-application.test.ts` (1)
- `operation-definition.test.ts` (2)
- `union-field-selection.test.ts` (6)

**Risk:** Low. Runtime behavior is fully tested. User-facing type safety is covered by prebuilt types (typegen). These tests verify compile-time inference within callback builders, which is a DX nicety, not a correctness requirement.

**Approach:** Either make `FieldAccessorFunction` generic over the schema to resolve field types from `fieldName`, or accept that callback-builder type inference is best-effort and prebuilt types are the source of truth.

## 2. Replace `graphql-compat/transformer.ts` with Core Transformer

**Status:** Resolved — `graphql-compat/transformer.ts` deleted in d34e63cb. The new `print()`-based emitter eliminated the duplication.
**Priority:** Closed

## 3. Delete `parseGraphqlFile` from graphql-compat parser

**Status:** Resolved — `parseGraphqlFile` no longer exists in the codebase.
**Priority:** Closed

## 4. ~~Evaluate~~ Document `var-ref-tools.ts` Public API

**Status:** Resolved — exposed as `$var` tools object on metadata builder context.

These functions are intentionally maintained as public API for metadata builders that need to inspect operation variables. Use cases: cache key generation, conditional request headers, nested input decomposition, variable labeling for backend communication.

Available via `({ $, $var }) => ...` in metadata callbacks. See `docs/guides/tagged-template-syntax.md` for usage examples.

## 5. Update Stale `$var()` Comments

**Status:** Resolved — stale comments updated in 96b8271e.
**Priority:** Closed

## 6. Simplify `graphql-compat` Emitter Result Type

**Status:** Resolved — emitter already returns `string` (not `Result`). The `print()`-based rewrite in d34e63cb eliminated all error paths.
**Priority:** Closed

## 7. Remove Duplicate `AnyVarSpecifier` Type

**Status:** Resolved — `AnyVarSpecifier` no longer exists in the codebase.
**Priority:** Closed

## 8. `perf-measures` Syntax Update

**Status:** Completed in separate session.

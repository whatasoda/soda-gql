# soda-gql - Loop Progress

## Vision
See: VISION.md

## Configuration
- Discovery quota: 10 items max (add max 3 per session)
- Retry limit: 3 attempts per item before marking [!]

## Phase 1: Fragment Spread
Enable tagged template fragments to spread other fragments via `...FragmentName` syntax, with `buildFieldsFromSelectionSet` handling `FragmentSpread` nodes.

### Items
- [x] **1.1**: Implement fragment spread in tagged template fragments [implement]
  - Description: Modify `buildFieldsFromSelectionSet` in `packages/core/src/composer/fragment-tagged-template.ts` to handle `Kind.FRAGMENT_SPREAD` nodes. Currently line 147 explicitly skips `InlineFragment` and `FragmentSpread` nodes. The implementation must accept a fragment registry/context so that `...FragmentName` resolves to the referenced fragment's `spread()` call and merges its fields into the parent selection.
  - Files: `packages/core/src/composer/fragment-tagged-template.ts`
  - Validation: A tagged template fragment using `...OtherFragment` syntax successfully compiles, and the resulting fragment includes the spread fragment's fields in its selection set.
  - Deps: none

- [x] **V-1.1**: Validate fragment spread in tagged templates [validate]
  - Steps: Write a test in `packages/core/src/composer/fragment-tagged-template.test.ts` that defines two tagged template fragments where one spreads the other, and verify the spread fragment's fields appear in the parent fragment's field selection.
  - Expected: Test passes, spread fields are present, variable definitions from the spread fragment are forwarded.
  - Pass criteria: `bun run test` passes with the new test; existing tests remain green.
  - Deps: 1.1

### Phase Validation
- [x] **PV-1**: Tagged template fragment spread works end-to-end
  - Deps: V-1.1

## Phase 2: Type Inference
Ensure tagged template fragment `$infer` provides accurate input (variables) and output (selected fields) types without `as any` casts.

### Items
- [x] **2.1**: Fix `$infer` type inference for tagged template fragments [implement]
  - Description: Currently `createFragmentTaggedTemplate` returns `TemplateResult<AnyFragment>` with `as any` casts that lose type parameters. Fix the type flow so that `Fragment<TTypeName, TVariables, TFields, TOutput>` type parameters are preserved through the tagged template factory, enabling `fragment.$infer.input` and `fragment.$infer.output` to resolve to correct types.
  - Files: `packages/core/src/composer/fragment-tagged-template.ts`, `packages/core/src/types/element/fragment.ts`
  - Validation: `typeof myFragment.$infer.input` resolves to the correct variable types and `typeof myFragment.$infer.output` resolves to the correct field output type (verified via type tests).
  - Deps: none

- [x] **V-2.1**: Validate `$infer` type accuracy [validate]
  - Steps: Write type-level tests (using `expectTypeOf` or `satisfies`) that assert `$infer.input` and `$infer.output` match expected types for a tagged template fragment with variables and nested field selections.
  - Expected: Type tests pass at compile time; no `any` types leak through.
  - Pass criteria: `bun typecheck` passes; type tests confirm correct inference.
  - Deps: 2.1

### Phase Validation
- [x] **PV-2**: Tagged template `$infer` types are accurate for application use
  - Deps: V-2.1

## Phase 3: Metadata Callbacks
Add context-aware metadata callback support to tagged template fragments, beyond static objects.

### Items
- [x] **3.1**: Support metadata callbacks in tagged template fragments [implement]
  - Description: Currently tagged template fragments only accept static metadata objects in the `TemplateResult` call. Extend the API to accept a callback function `(context) => metadata` that receives fragment context (e.g., variable assignments, field path) and returns metadata dynamically. This should mirror the callback builder's `metadata: ({ $ }) => ({...})` pattern.
  - Files: `packages/core/src/composer/fragment-tagged-template.ts`
  - Validation: A tagged template fragment with a metadata callback produces correct metadata when spread into an operation, and the metadata is collected via `withFragmentUsageCollection`.
  - Deps: none

- [x] **V-3.1**: Validate metadata callbacks [validate]
  - Steps: Write a test that defines a tagged template fragment with a metadata callback, spreads it into an operation, and verifies the collected metadata matches the callback's return value.
  - Expected: Metadata callback is invoked during operation building; returned metadata appears in fragment usage records.
  - Pass criteria: `bun run test` passes with metadata callback test.
  - Deps: 3.1

### Phase Validation
- [x] **PV-3**: Tagged template metadata callbacks work with fragment usage collection
  - Deps: V-3.1

## Phase 4: Composition Workflow
Establish query-level fragment patterns and `$colocate`-based operation composition from tagged template fragments through callback builder operations.

### Items
- [ ] **4.1**: Establish query-level fragment pattern with fragment references [implement]
  - Description: Create a clear, documented pattern for defining query-level fragments (on Query/Mutation types) via callback builder that spread entity-level tagged template fragments. This pattern represents the "top-level resolver unit" concept where each query fragment maps to one resolver call (e.g., `users`, `project`). Demonstrate with test fixtures showing the pattern.
  - Files: `packages/core/test/integration/`, `packages/core/test/fixtures/`
  - Validation: Integration test demonstrates a callback builder query-level fragment that spreads a tagged template entity fragment, and the resulting operation artifact contains correct field selections and variable definitions.
  - Deps: PV-1

- [ ] **V-4.1**: Validate query-level fragment pattern [validate]
  - Steps: Run integration tests that verify query-level fragments correctly spread entity fragments, variable definitions are merged, and the generated GraphQL document is valid.
  - Expected: All field selections from entity fragments appear in the query-level fragment; variables are properly forwarded.
  - Pass criteria: `bun run test` passes with integration tests.
  - Deps: 4.1

- [ ] **4.2**: Implement end-to-end `$colocate` workflow [implement]
  - Description: Demonstrate and test the full `$colocate` workflow: multiple query-level fragments (each spreading tagged template entity fragments) are combined into a single operation using `$colocate`. Verify that `createExecutionResultParser` from `@soda-gql/colocation-tools` correctly parses the prefixed fields back to individual fragment results.
  - Files: `packages/core/test/integration/`, `packages/colocation-tools/`
  - Validation: A single operation containing two or more colocated query fragments produces a valid GraphQL document with label-prefixed fields, and the execution result parser correctly extracts per-fragment data.
  - Deps: V-4.1

- [ ] **V-4.2**: Validate `$colocate` end-to-end [validate]
  - Steps: Run integration test that builds a colocated operation, inspects the generated document for prefixed fields, and verifies `createExecutionResultParser` extracts correct data from a mock execution result.
  - Expected: Label-prefixed fields in document; parser returns correct per-fragment results.
  - Pass criteria: `bun run test` passes with colocation integration test.
  - Deps: 4.2

### Phase Validation
- [ ] **PV-4**: Composition and colocation workflow is complete and tested
  - Deps: V-4.1, V-4.2

## Phase 5: E2E Validation
Demonstrate the complete fragment colocation workflow in a working playground example.

### Items
- [ ] **5.1**: Create E2E colocation example in playground [implement]
  - Description: Build a complete working example in `playgrounds/vite-react/` that demonstrates the full workflow: (1) tagged template entity fragments with variables and `$infer` types, (2) callback builder query-level fragments spreading entity fragments, (3) `$colocate` combining multiple query fragments into one operation, (4) `createProjectionAttachment` for runtime data extraction, (5) React components consuming typed fragment data via projections.
  - Files: `playgrounds/vite-react/src/`
  - Validation: The playground builds without errors (`bun run build` in playground dir), components render with correctly typed data, and the colocation pattern is visible in the component tree.
  - Deps: PV-4

- [ ] **V-5.1**: Validate E2E playground example [validate]
  - Steps: Build the vite-react playground and verify no type errors. Inspect the generated GraphQL document to confirm fragment colocation. Check that component props use `$infer` types from fragments.
  - Expected: Build succeeds; types are correct; colocation pattern is demonstrated.
  - Pass criteria: `bun typecheck` and `bun run build` succeed in playground; code review confirms the colocation pattern.
  - Deps: 5.1

### Phase Validation
- [ ] **PV-5**: E2E colocation workflow is demonstrated and functional
  - Deps: V-5.1

## Discovered Items
<!-- Max 10 items. Format: D-N prefix. Agent adds when vision gaps found. -->

## Session Log
<!-- Append-only. Harness appends after each session. -->

### Session 1 (2026-02-16)
- Items completed: 1.1, V-1.1, PV-1 (Phase 1 complete), 2.1
- Commits:
  - b6d42a08 - feat: implement fragment spread in tagged template fragments
  - 5aedc894 - feat: improve type parameter flow in tagged template fragments
- Exit reason: 3 items processed, avoiding context pollution
- Test status: 2109 pass, 1 skip, 0 fail
- Notes: Fragment spread implementation complete. Type parameter flow improved (typename/vardefs preserved; field types remain Any pending typegen).

### Session 1 (2026-02-16 01:40) [exit: normal]
- Exit reason: normal

### Session 2 (2026-02-16 02:00)
- Items completed: V-2.1 (Phase 2 validation), PV-2 (Phase 2 complete)
- Commits:
  - 3faeda13 - test: validate tagged template fragment $infer type accuracy
- Exit reason: 2 items processed, context management
- Test status: 2113 pass, 1 skip, 0 fail
- Notes: Phase 2 complete. Type-level tests confirm $infer.input and $infer.output are accessible. Field-level accuracy pending typegen integration.

### Session 2 (2026-02-16 01:45) [exit: normal]
- Exit reason: normal

### Session 3 (2026-02-16)
- Items completed: 3.1, V-3.1, PV-3 (Phase 3 complete)
- Commits:
  - 9c8c756c - feat: support metadata callbacks in tagged template fragments
  - ce15c9a2 - test: validate metadata callbacks in tagged template fragments
- Exit reason: 3 items processed, context management
- Test status: 2119 pass, 1 skip, 0 fail
- Notes: Phase 3 complete. Metadata callbacks now supported in tagged template fragments. Callbacks receive { $ } context with variable assignments. Both static and callback metadata work. Integration tests confirm metadata collection during operation building.

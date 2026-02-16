# fragment-interpolation-spread - Loop Progress

## Vision
See: VISION.md

## Configuration
- Discovery quota: 10 items max (add max 3 per session)
- Retry limit: 3 attempts per item before marking [!]

## Phase 1: Core Fragment Interpolation
Enable interpolation-based fragment spread in tagged template fragments with both direct fragment embedding and callback patterns, including automatic variable definition merging.

### Items
- [x] **1.1**: Implement interpolation-based fragment spread in tagged template fragments [implement]
  - Description: Modify the tagged template processing in `packages/core/src/composer/fragment-tagged-template.ts` to accept interpolated expressions. Currently `createFragmentTaggedTemplate` throws "Tagged templates must not contain interpolated expressions" for any `${...}` values. Change this to detect Fragment instances and callback functions in interpolation slots. For `...${frag}` (direct fragment), call `frag.spread()` with the parent's variable assignments. For `...${($) => frag.spread(args)}` (callback), invoke the callback with the parent's `$` context and merge the returned fields. Non-fragment interpolation values should still be rejected.
  - Files: `packages/core/src/composer/fragment-tagged-template.ts`
  - Validation: A tagged template fragment using `...${otherFragment}` syntax compiles and produces the correct field selection, and a callback `...${($) => frag.spread({ key: $.var })}` correctly receives variable context and spreads fields.
  - Deps: none

- [x] **V-1.1**: Validate interpolation-based fragment spread [validate]
  - Steps: Write tests in `packages/core/src/composer/fragment-tagged-template.test.ts` that verify: (1) direct fragment interpolation `...${frag}` spreads fields, (2) callback interpolation `...${($) => frag.spread(args)}` receives `$` context, (3) non-fragment interpolation values throw an error, (4) multiple interpolated fragments in the same selection set work.
  - Expected: All tests pass; interpolated fragment fields appear in parent fragment's selection; callback receives correct variable context.
  - Pass criteria: `bun run test` passes with new tests; existing tests remain green.
  - Deps: 1.1

- [x] **1.2**: Implement automatic variable definition merging for interpolated fragment spreads [implement]
  - Description: When a fragment is spread via interpolation, its `variableDefinitions` should be automatically merged into the parent fragment's variable definitions. Currently the registry approach relies on manual variable declaration in the parent. The interpolation approach should detect the spread fragment's variable definitions and unify them with the parent's, handling conflicts (same variable name with same type = ok, different type = error).
  - Files: `packages/core/src/composer/fragment-tagged-template.ts`
  - Validation: A parent fragment that interpolates a child fragment with `$userId: ID!` automatically includes `$userId: ID!` in its own variable definitions without manual re-declaration.
  - Deps: 1.1

- [ ] **V-1.2**: Validate variable definition auto-merge [validate]
  - Steps: Write tests that verify: (1) spread fragment's variables are merged into parent, (2) duplicate variable names with matching types are deduplicated, (3) conflicting variable types produce an error, (4) variable definitions from multiple interpolated fragments are all merged.
  - Expected: Parent fragment's `variableDefinitions` contains all child variables; no manual re-declaration needed.
  - Pass criteria: `bun run test` passes with variable merge tests.
  - Deps: 1.2

### Phase Validation
- [ ] **PV-1**: Core interpolation-based fragment spread works end-to-end with variable auto-merge
  - Deps: V-1.1, V-1.2

## Phase 2: Extended Support & Type Safety
Extend interpolation support to operation tagged templates, ensure metadata callback coexistence, and validate that typegen produces correct `$` argument types for interpolation callbacks.

### Items
- [ ] **2.1**: Implement interpolation-based fragment spread in operation tagged templates [implement]
  - Description: Extend the operation tagged template processing in `packages/core/src/composer/operation-tagged-template.ts` to support the same interpolation patterns as fragment tagged templates. Currently operation tagged templates also throw "Tagged templates must not contain interpolated expressions". Apply the same interpolation detection logic: accept Fragment instances and callbacks, reject other values. Variable definitions from interpolated fragments should merge into the operation's variable definitions.
  - Files: `packages/core/src/composer/operation-tagged-template.ts`
  - Validation: `query`query Q($id: ID!) { user(id: $id) { ...${userFields} } }`` works and produces correct GraphQL output with merged variables.
  - Deps: PV-1

- [ ] **V-2.1**: Validate operation tagged template interpolation [validate]
  - Steps: Write tests that verify: (1) operation tagged template with `...${frag}` produces correct query, (2) callback interpolation works in operation context, (3) variable definitions are merged from interpolated fragments into the operation, (4) generated GraphQL document is valid.
  - Expected: Operation with interpolated fragments produces correct GraphQL; variables are unified.
  - Pass criteria: `bun run test` passes with operation interpolation tests.
  - Deps: 2.1

- [ ] **2.2**: Ensure interpolation spread and metadata callbacks coexist [implement]
  - Description: Verify and ensure that the `TemplateResult` call signature supports both interpolated fragment spreads and metadata options simultaneously. The pattern `fragment`...${frag}``({ metadata: ({ $ }) => ({ ... }) })` should work: interpolated fragments provide spread fields, and the metadata option provides dynamic metadata. If the current implementation already supports this naturally, add explicit tests. If not, adjust the `TemplateResultMetadataOptions` type and processing.
  - Files: `packages/core/src/composer/fragment-tagged-template.ts`, `packages/core/src/composer/operation-tagged-template.ts`
  - Validation: A tagged template with both interpolated fragment spreads and a metadata callback produces correct fields and collects metadata via `withFragmentUsageCollection`.
  - Deps: PV-1

- [ ] **V-2.2**: Validate metadata and interpolation coexistence [validate]
  - Steps: Write tests that verify: (1) fragment with both `...${frag}` interpolation and `{ metadata: ... }` option works, (2) metadata callback receives `$` context including variables from interpolated fragments, (3) `withFragmentUsageCollection` collects metadata from both the parent and interpolated child fragments.
  - Expected: Both interpolation and metadata work together without interference.
  - Pass criteria: `bun run test` passes with coexistence tests.
  - Deps: 2.2

- [ ] **2.3**: Validate typegen produces correct `$` argument types for interpolation callbacks [implement]
  - Description: Ensure the typegen pipeline generates type definitions that make the interpolation callback `$` argument type-safe. After running `bun run soda-gql codegen schema`, the generated types should make `...${($) => frag.spread({ key: $.var })}` type-check correctly — `$` should have the correct variable types from the parent fragment's variable definitions. If typegen changes are needed, implement them; if the existing typegen already produces correct types, validate with type-level tests.
  - Files: `packages/core/src/codegen/`, typegen-related files
  - Validation: After typegen, TypeScript correctly validates `$.var` references in interpolation callbacks; incorrect variable names produce type errors.
  - Deps: PV-1

- [ ] **V-2.3**: Validate `$` callback type safety after typegen [validate]
  - Steps: Write type-level tests (using `expectTypeOf` or `satisfies`) that assert: (1) `$` argument in interpolation callback has correct variable types after typegen, (2) accessing non-existent variables on `$` produces a type error, (3) variable types match the parent fragment's variable definitions.
  - Expected: Type tests pass at compile time; incorrect `$` usage is caught by TypeScript.
  - Pass criteria: `bun typecheck` passes with type-level interpolation callback tests.
  - Deps: 2.3

### Phase Validation
- [ ] **PV-2**: Extended interpolation support and type safety are complete
  - Deps: V-2.1, V-2.2, V-2.3

## Phase 3: Migration & E2E Validation
Deprecate the fragment registry approach and rewrite the playground example to demonstrate the new interpolation-based workflow end-to-end.

### Items
- [ ] **3.1**: Deprecate and remove the `fragments: {}` registry approach [implement]
  - Description: Remove the `fragments` option from `TemplateResultMetadataOptions` and the `fragmentRegistry` parameter from `buildFieldsFromSelectionSet`. Update the `Kind.FRAGMENT_SPREAD` handling in `buildFieldsFromSelectionSet` to no longer look up fragments from a registry — all fragment spreads in tagged templates must now use interpolation. Remove the registry-related error messages ("requires a fragment registry", "is not defined in the fragment registry"). Update any remaining `Kind.FRAGMENT_SPREAD` handling to throw an error directing users to use interpolation syntax instead. Update existing tests that use the registry approach to use interpolation.
  - Files: `packages/core/src/composer/fragment-tagged-template.ts`, `packages/core/src/composer/operation-tagged-template.ts`, related test files
  - Validation: The `fragments: {}` option no longer exists; all existing fragment spread tests use interpolation syntax; `bun run test` passes.
  - Deps: PV-2

- [ ] **V-3.1**: Validate registry removal [validate]
  - Steps: Verify: (1) `fragments: {}` option is removed from types and implementation, (2) all tests that previously used registry approach have been migrated to interpolation, (3) attempting to use `fragments: {}` produces a type error, (4) `bun run test` passes with all tests green.
  - Expected: No registry code remains; all tests use interpolation; type system rejects `fragments` option.
  - Pass criteria: `bun run test` and `bun typecheck` pass; grep for `fragmentRegistry` returns no matches in source files.
  - Deps: 3.1

- [ ] **3.2**: Rewrite playground E2E example with interpolation syntax [implement]
  - Description: Update the `playgrounds/vite-react/` example to use interpolation-based fragment spread syntax throughout. Replace any `fragments: { ... }` registry usage and update component fragments (EmployeeCard, TaskList) and operations (ProjectPage) to use `...${frag}` or `...${($) => frag.spread(args)}` patterns. Ensure the full workflow works: fragment definition → interpolation-based composition → $colocate → result parsing → typed React components.
  - Files: `playgrounds/vite-react/src/`
  - Validation: `bun run build` succeeds in the playground directory; components use interpolation syntax; the E2E colocation workflow functions correctly.
  - Deps: 3.1

- [ ] **V-3.2**: Validate playground E2E with interpolation [validate]
  - Steps: (1) Build the vite-react playground with `bun run build`, (2) verify no type errors with `bun typecheck`, (3) inspect component source to confirm interpolation syntax is used, (4) verify generated GraphQL document includes correct operations and fragments.
  - Expected: Build succeeds; types are correct; interpolation pattern is visible throughout components.
  - Pass criteria: `bun typecheck` and `bun run build` succeed in playground; code review confirms interpolation usage.
  - Deps: 3.2

### Phase Validation
- [ ] **PV-3**: Migration complete and E2E workflow validated with interpolation syntax
  - Deps: V-3.1, V-3.2

## Discovered Items
<!-- Max 10 items. Format: D-N prefix. Agent adds when vision gaps found. -->

## Session Log
<!-- Append-only. Harness appends after each session. -->

### Session 1 - 2026-02-16
- Completed: 1.1, V-1.1, 1.2
- Status: Items completed successfully
- Exit reason: Context management - processed 3 items
- Notes: Implemented interpolation-based fragment spread in tagged templates with placeholder-based approach. Added comprehensive tests for direct fragment interpolation and callback patterns. Implemented automatic variable definition merging with conflict detection.

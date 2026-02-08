# Phase 1 Round 4: Integration, Testing, and Phase Gate Verification

## Purpose

Finalize the hybrid context in `gql-composer.ts` by wiring the compat tagged template from Round 3, add comprehensive integration tests covering all tagged template API paths, and verify the Phase 1 gate criteria. After this round, Phase 1 is complete and Phase 2 can begin.

**Prerequisites**: Rounds 1-3 complete

**Scope**:
- `packages/core/src/composer/gql-composer.ts` (finalize hybrid context with compat tagged template)
- `packages/core/test/integration/` (3 new integration test files)

**Parent documents**:
- [Phase 1 overview](./tagged-template-unification-phase1.md)
- [Implementation strategy](./tagged-template-unification.md)
- [RFC index](../rfcs/tagged-template-unification/index.md)

---

## Shared Context

This section provides all context needed for Round 4 tasks. It is self-contained so that this document survives context compaction without referencing external files.

### Round 1-3 Outputs (all available)

**Round 1 -- shared GraphQL utilities** (`packages/core/src/graphql/`):
- `parser.ts` -- GraphQL parsing with `graphql-js`, tagged template string extraction
- `transformer.ts` -- GraphQL AST to fields data conversion
- `fragment-args-preprocessor.ts` -- strips Fragment Arguments syntax before `graphql-js` parsing
- `var-specifier-builder.ts` -- constructs `VarSpecifier` objects from AST + schema resolution
- `index.ts` -- barrel export

**Round 2 -- tagged template composers** (`packages/core/src/composer/`):
- `operation-tagged-template.ts` -- exports `createOperationTaggedTemplate(schema, operationType, ...)`
- `fragment-tagged-template.ts` -- exports `createFragmentTaggedTemplate(schema, ...)`
- `gql-composer.ts` -- hybrid context started (Task 2.3): `query`/`mutation`/`subscription` are tagged template + `.operation`; `fragment` is pure tagged template

**Round 3 -- compat tagged template + extend adaptation**:
- `compat-tagged-template.ts` -- exports `createCompatTaggedTemplate(schema, operationType)`
- `compat-spec.ts` -- exports `TemplateCompatSpec`, `isTemplateCompatSpec` (type guard)
- `extend.ts` -- updated to handle both `CompatSpec` (callback builder) and `TemplateCompatSpec` (tagged template)
- `compat.ts` -- may be updated for callback builder compat alongside tagged template compat

### Current gql-composer.ts state (after Round 2 Task 2.3)

After Round 2, `gql-composer.ts` builds a hybrid context where `query`/`mutation`/`subscription` are callable tagged template functions with `.operation` and `.compat` properties. The `.compat` currently uses the **callback builder** compat composer (`createCompatComposer`). Round 4 Task 4.1 must wire the tagged template compat composer alongside or instead of it.

Current context shape in `gql-composer.ts`:

```typescript
const context = {
  fragment,  // pure tagged template from Round 2 (createFragmentTaggedTemplate)
  query: Object.assign(queryTaggedTemplate, {
    operation: createOperationComposer("query"),
    compat: createCompatComposer(schema, "query"),  // <-- still callback builder compat
  }),
  mutation: Object.assign(mutationTaggedTemplate, {
    operation: createOperationComposer("mutation"),
    compat: createCompatComposer(schema, "mutation"),
  }),
  subscription: Object.assign(subscriptionTaggedTemplate, {
    operation: createOperationComposer("subscription"),
    compat: createCompatComposer(schema, "subscription"),
  }),
  define: ...,
  extend: createExtendComposer(...),  // updated in Round 3 to handle TemplateCompatSpec
  $var: ...,
  $dir: ...,
  $colocate: ...,
};
```

### Expected final context shape (after Round 4 Task 4.1)

```typescript
query: TaggedTemplateFunction & {
  operation: OperationComposer,      // callback builder (retained)
  compat: CompatTaggedTemplateFunction  // tagged template compat (from Round 3)
}
mutation: TaggedTemplateFunction & {
  operation: OperationComposer,
  compat: CompatTaggedTemplateFunction
}
subscription: TaggedTemplateFunction & {
  operation: OperationComposer,
  compat: CompatTaggedTemplateFunction
}
fragment: TaggedTemplateFunction     // pure, no .User() builders
```

### Test infrastructure

- **Test runner**: `bun run test`
- **Test framework**: Bun test (`describe`, `it`, `expect` from `"bun:test"`)
- **Test fixtures** (`packages/core/test/fixtures/`):
  - `schemas.ts` exports `basicTestSchema` (type: `BasicTestSchema`), `extendedTestSchema` (type: `ExtendedTestSchema`)
  - `input-type-methods.ts` exports `basicInputTypeMethods`, `extendedInputTypeMethods`
  - `index.ts` re-exports both
- **Integration test entry point**:
  ```typescript
  import { createGqlElementComposer, type FragmentBuildersAll } from "../../src/composer/gql-composer";
  import type { StandardDirectives } from "../../src/composer/directive-builder";
  import { type BasicTestSchema, basicTestSchema, basicInputTypeMethods } from "../fixtures";

  const gql = createGqlElementComposer<BasicTestSchema, FragmentBuildersAll<BasicTestSchema>, StandardDirectives>(
    basicTestSchema, { inputTypeMethods: basicInputTypeMethods }
  );
  ```
- **Document verification**: `import { print } from "graphql";` then `print(element.document)` to verify GraphQL output
- **Existing integration test patterns** (from `compat-extend.test.ts`):
  - Each test file has a top-level `describe` block named after the feature
  - Tests use `gql(({ query, $var, ... }) => ...)` pattern
  - Assertions check `.operationType`, `.operationName`, `.variableNames`, `.document` (via `print()`), `.metadata`

### basicTestSchema object types

```typescript
const basicTestSchema = {
  label: "test",
  operations: { query: "Query", mutation: "Mutation", subscription: "Subscription" },
  scalar: { ID: ..., String: ... },
  enum: {},
  input: {},
  object: {
    Query: {
      name: "Query",
      fields: {
        __typename: ...,
        user: { spec: "o|User|!", arguments: { id: "s|ID|!" } },
      },
    },
    Mutation: {
      name: "Mutation",
      fields: {
        __typename: ...,
        updateUser: { spec: "o|User|?", arguments: { id: "s|ID|!", name: "s|String|!" } },
      },
    },
    Subscription: {
      name: "Subscription",
      fields: {
        __typename: ...,
        userUpdated: { spec: "o|User|!", arguments: { userId: "s|ID|!" } },
      },
    },
    User: {
      name: "User",
      fields: {
        __typename: ...,
        id: { spec: "s|ID|!", arguments: {} },
        name: { spec: "s|String|!", arguments: {} },
      },
    },
  },
  union: {},
};
```

### Design decisions relevant to Round 4

- `query`/`mutation`/`subscription` are hybrid: tagged template + `.operation` + `.compat`
- `fragment` is pure tagged template (no `.User()` type-keyed builders)
- `query.compat\`...\`` produces `GqlDefine<TemplateCompatSpec>` -- deferred, stores GraphQL source
- `extend(compat, options)` builds full Operation from compat spec
- `query\`...\`()` is the always-call pattern; `()` required even without metadata
- `query\`...\`({ metadata: ... })` attaches metadata
- Tagged templates reject interpolation (`query\`${expr}\`` must throw)
- Callback builder API (`.operation({...})`) still works alongside tagged templates
- Error handling in composers uses `throw` (not neverthrow)

---

## Tasks

### Task 4.1: Finalize hybrid context with compat tagged template

**Commit message**: `feat(core): wire compat tagged template into hybrid context`

**Files**:
- Modify: `packages/core/src/composer/gql-composer.ts`

**Types involved**:
- `createCompatTaggedTemplate` from `./compat-tagged-template` (Round 3 output)
- `createOperationTaggedTemplate` from `./operation-tagged-template` (Round 2 output)
- `createFragmentTaggedTemplate` from `./fragment-tagged-template` (Round 2 output)
- `AnyGqlContext` type (update `.compat` type signature if needed)
- `createCompatComposer` from `./compat` (callback builder compat -- retained for `.operation` path)

**Implementation**:

1. Import `createCompatTaggedTemplate` from `./compat-tagged-template`
2. In the context construction, replace or augment the `.compat` property on each operation hybrid:
   ```typescript
   const context = {
     fragment,  // pure tagged template (already done in Round 2)
     query: Object.assign(createOperationTaggedTemplate(schema, "query", ...), {
       operation: createOperationComposer("query"),
       compat: createCompatTaggedTemplate(schema, "query"),
     }),
     mutation: Object.assign(createOperationTaggedTemplate(schema, "mutation", ...), {
       operation: createOperationComposer("mutation"),
       compat: createCompatTaggedTemplate(schema, "mutation"),
     }),
     subscription: Object.assign(createOperationTaggedTemplate(schema, "subscription", ...), {
       operation: createOperationComposer("subscription"),
       compat: createCompatTaggedTemplate(schema, "subscription"),
     }),
     // ... rest unchanged
   };
   ```
3. Update the `AnyGqlContext` type if the `.compat` type signature changes (it should accept tagged template string arrays instead of callback builder options)
4. Verify that `createExtendComposer` (already updated in Round 3) handles `TemplateCompatSpec` correctly -- no changes expected here, just verification
5. Run existing tests to confirm no regressions: `bun run test`

**Dependencies**: Rounds 1-3 complete. Specifically depends on:
- `createCompatTaggedTemplate` from Round 3 Task 3.2
- `createOperationTaggedTemplate` from Round 2 Task 2.1
- `createFragmentTaggedTemplate` from Round 2 Task 2.2
- `extend.ts` TemplateCompatSpec handling from Round 3 Task 3.4

**Validation**:
- `bun run test` -- all existing tests pass (no regressions)
- `bun typecheck` -- no type errors
- Manual verification that `context.query`, `context.mutation`, `context.subscription` have the expected shape:
  - Callable as tagged template
  - `.operation(...)` available
  - `.compat` is a tagged template function (not callback builder compat)

**Subagent eligibility**: Main context only (modifies shared state that Task 4.2 depends on)

---

### Task 4.2: Integration tests

**Commit message**: `test(core): add tagged template integration tests`

**Files** (all new):
- Create: `packages/core/test/integration/tagged-template-operation.test.ts`
- Create: `packages/core/test/integration/tagged-template-fragment.test.ts`
- Create: `packages/core/test/integration/tagged-template-compat.test.ts`

**Types involved**:
- `createGqlElementComposer`, `FragmentBuildersAll` from `../../src/composer/gql-composer`
- `StandardDirectives` from `../../src/composer/directive-builder`
- `BasicTestSchema`, `basicTestSchema`, `basicInputTypeMethods` from `../fixtures`
- `ExtendedTestSchema`, `extendedTestSchema`, `extendedInputTypeMethods` from `../fixtures`
- `print` from `graphql`
- `OperationMetadata` from `../../src/types/metadata`

**Implementation**:

#### File 1: `tagged-template-operation.test.ts`

Test setup:
```typescript
import { describe, expect, it } from "bun:test";
import { print } from "graphql";
import type { StandardDirectives } from "../../src/composer/directive-builder";
import { createGqlElementComposer, type FragmentBuildersAll } from "../../src/composer/gql-composer";
import type { BasicTestSchema } from "../fixtures";
import { basicInputTypeMethods, basicTestSchema } from "../fixtures";

const gql = createGqlElementComposer<BasicTestSchema, FragmentBuildersAll<BasicTestSchema>, StandardDirectives>(
  basicTestSchema, { inputTypeMethods: basicInputTypeMethods }
);
```

Test scenarios:

| # | Test name | Description |
|---|-----------|-------------|
| 1 | creates query operation from tagged template | `query\`query GetUser($id: ID!) { user(id: $id) { id name } }\`()` produces valid Operation with correct operationType, operationName, variableNames |
| 2 | creates mutation operation from tagged template | `mutation\`mutation UpdateUser($id: ID!, $name: String!) { updateUser(id: $id, name: $name) { id name } }\`()` produces mutation Operation |
| 3 | creates subscription operation from tagged template | `subscription\`subscription OnUserUpdated($userId: ID!) { userUpdated(userId: $userId) { id name } }\`()` produces subscription Operation |
| 4 | handles metadata chaining | `query\`...\`({ metadata: () => ({ headers: { "X-Test": "value" } }) })` attaches metadata correctly |
| 5 | rejects interpolation in tagged template | `query\`query ${name} { ... }\`` throws an error (no expression interpolation allowed) |
| 6 | extracts variable definitions correctly | Verify `.variableNames` matches the GraphQL variable definitions |
| 7 | generates correct document | `print(operation.document)` contains expected query text |
| 8 | callback builder still works alongside tagged template | `query.operation({ name: "GetUser", variables: ..., fields: ... })` still produces valid Operation |

#### File 2: `tagged-template-fragment.test.ts`

Test setup: same as operations, using `basicTestSchema`.

Test scenarios:

| # | Test name | Description |
|---|-----------|-------------|
| 1 | creates basic fragment | `fragment\`fragment UserFields on User { id name }\`()` produces valid Fragment |
| 2 | fragment with Fragment Arguments syntax | `fragment\`fragment UserProfile($showEmail: Boolean = false) on User { id name }\`()` -- correctly extracts variable definitions with default values |
| 3 | fragment variable types resolve against schema | Variable definitions have correct `kind` ("scalar" for ID, String, etc.) |
| 4 | fragment metadata chaining | `fragment\`...\`({ metadata: () => ({ headers: { "X-Fragment": "true" } }) })` attaches metadata |
| 5 | fragment spreading in operations | Create a fragment via tagged template, spread it in a tagged template operation, verify the final document contains both |
| 6 | fragment is pure tagged template | `fragment` has no `.User()` or type-keyed builder methods -- it is a function, not an object with properties |

#### File 3: `tagged-template-compat.test.ts`

Test setup: uses `extendedTestSchema` and `extendedInputTypeMethods` (matching existing `compat-extend.test.ts` pattern).

```typescript
import { describe, expect, it } from "bun:test";
import { print } from "graphql";
import type { StandardDirectives } from "../../src/composer/directive-builder";
import { createGqlElementComposer, type FragmentBuildersAll } from "../../src/composer/gql-composer";
import type { OperationMetadata } from "../../src/types/metadata";
import { type ExtendedTestSchema, extendedInputTypeMethods, extendedTestSchema } from "../fixtures";

const schema = extendedTestSchema;
type Schema = ExtendedTestSchema;
const inputTypeMethods = extendedInputTypeMethods;

const gql = createGqlElementComposer<Schema, FragmentBuildersAll<Schema>, StandardDirectives>(
  schema, { inputTypeMethods }
);
```

Test scenarios:

| # | Test name | Description |
|---|-----------|-------------|
| 1 | creates compat spec from tagged template | `query.compat\`query GetUser($userId: ID!) { user(id: $userId) { id name } }\`` produces `GqlDefine<TemplateCompatSpec>` |
| 2 | extend compat spec into operation | `extend(compatSpec)` produces full Operation with correct operationType, operationName, document |
| 3 | extend compat spec with metadata | `extend(compatSpec, { metadata: () => ({ headers: ... }) })` attaches metadata during extend |
| 4 | extend compat spec with transformDocument | `extend(compatSpec, { transformDocument: (doc) => doc })` applies document transformer |
| 5 | callback builder compat still works | `query.operation({ name: ..., variables: ..., fields: ... })` callback builder path unaffected |
| 6 | compat without variables | `query.compat\`query GetUsers { users(limit: 10) { id name } }\`` works without variable definitions |
| 7 | mutation and subscription compat | `mutation.compat\`...\`` and `subscription.compat\`...\`` work correctly |
| 8 | mixed: callback builder extend with tagged template compat | Compat defined via tagged template, extended in a separate `gql()` call using callback builder's `extend` |

**Dependencies**: Task 4.1 complete (hybrid context finalized)

**Validation**:
- `bun run test` -- all new integration tests pass
- `bun typecheck` -- no type errors in test files
- Each test file runs independently

**Subagent eligibility**: Eligible. The 3 test files can be written by a subagent. They only create new files and do not modify existing source code. All 3 test files are independent of each other and could theoretically be written in parallel, but they share a dependency on Task 4.1 completion.

---

### Task 4.3: Phase gate verification

**Commit message**: N/A (no files created or modified)

**Files**: None

**Types involved**: None

**Implementation**:

This task is a verification-only step with no code changes. Execute the following checks:

1. **All tests pass**:
   ```bash
   bun run test
   ```
   Verify that all tests pass, including:
   - All existing tests (no regressions)
   - New tagged template integration tests from Task 4.2
   - All unit tests in `packages/core/src/**/*.test.ts`

2. **Quality checks pass**:
   ```bash
   bun quality
   ```
   Verify lint and type check both pass.

3. **Manual smoke test -- all API paths**:
   Verify each of these API paths produces valid output (can be done via test assertions or manual check):
   - `query\`...\`()` -- tagged template operation
   - `mutation\`...\`()` -- tagged template operation
   - `subscription\`...\`()` -- tagged template operation
   - `fragment\`...\`()` -- tagged template fragment
   - `query.operation({...})` -- callback builder operation
   - `query.compat\`...\`` -- tagged template compat
   - `extend(compat)` -- extend compat to operation
   - `extend(compat, { metadata })` -- extend with metadata

4. **No regressions in existing tests**:
   Confirm that all pre-existing integration tests still pass:
   - `packages/core/test/integration/compat-extend.test.ts`
   - `packages/core/test/integration/metadata-adapter.test.ts`
   - `packages/core/test/integration/metadata-with-variables.test.ts`
   - `packages/core/test/integration/nested-var-ref.test.ts`
   - `packages/core/test/integration/document-transform.test.ts`
   - `packages/core/test/integration/recursive-input-depth-limit.test.ts`
   - `packages/core/test/integration/schema-edge-cases.test.ts`

5. **Git status clean**:
   ```bash
   git status
   ```
   All changes committed, no untracked files.

**Dependencies**: Tasks 4.1 and 4.2 complete

**Validation**: This task IS the validation. The phase gate criteria are met when all 5 checks above pass.

**Subagent eligibility**: Main context only (requires running commands and verifying results)

---

## Subagent Parallelization Map

```
[4.1 finalize hybrid context]       <- main context
         |
         v
[4.2 integration tests]             <- subagent (3 new test files)
         |
         v
[4.3 phase gate verification]       <- main context
```

Tasks 4.1, 4.2, and 4.3 are strictly sequential:
- Task 4.2 depends on Task 4.1 (tests exercise the finalized hybrid context)
- Task 4.3 depends on Task 4.2 (verification requires all tests to exist)

Within Task 4.2, the 3 test files are independent and can be written in parallel by a subagent.

---

## Round 4 Verification (= Phase Gate)

Phase 1 is complete when all of the following criteria are met:

### Functional criteria

| Criterion | How to verify |
|-----------|--------------|
| `query\`...\`()`, `mutation\`...\`()`, `subscription\`...\`()` produce Operations | Tagged template operation integration tests pass |
| `fragment\`...\`()` produces Fragments | Tagged template fragment integration tests pass |
| `query.compat\`...\`` produces compat specs | Tagged template compat integration tests pass |
| `extend(compat, { metadata })` builds Operations from compat specs | Compat + extend integration tests pass |
| Hybrid context provides both APIs (tagged template + callback builder) | Callback builder tests in integration suite pass |
| No regressions in existing callback builder tests | All pre-existing tests pass unchanged |

### Quality criteria

| Criterion | Command |
|-----------|---------|
| All tests pass | `bun run test` |
| Lint passes | `bun quality` (includes lint) |
| Type check passes | `bun quality` (includes type check) |
| Git clean | `git status` |

### Ready for Phase 2

Phase 2 (Typegen tagged template support) depends on:
- `packages/core/src/graphql/` utilities (Round 1) -- available
- Tagged template composers (Rounds 2-3) -- available
- Hybrid context integration (Round 4) -- verified

Plan document: `docs/plans/tagged-template-unification-phase2.md` (to be created in separate session)

---

## References

- [Phase 1 overview](./tagged-template-unification-phase1.md)
- [Implementation strategy](./tagged-template-unification.md)
- [RFC: Tagged Template API Unification](../rfcs/tagged-template-unification/index.md)
- [RFC: Design Decisions](../rfcs/tagged-template-unification/design-decisions.md)
- [RFC: Affected Areas](../rfcs/tagged-template-unification/affected-areas.md)
- [RFC: Resolved Questions](../rfcs/tagged-template-unification/resolved-questions.md)

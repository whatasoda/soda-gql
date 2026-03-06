# Prebuilt Type System Deep Dive (2026-03-05, branch: fix/prebuilt-type-safety)

## Pipeline Overview

1. **Codegen** (`packages/codegen`) runs on GraphQL schema → writes `_internal.ts`, `index.ts`, `types.prebuilt.ts` (empty stub)
2. **Typegen** (`packages/typegen`) runs on user source files → overwrites `types.prebuilt.ts` with real types
3. Generated `index.ts` imports `PrebuiltTypes_*` from `types.prebuilt.ts` and uses `ResolveFragmentAtBuilder_*` / `ResolveOperationAtBuilder_*` conditional types to map keys to `Fragment<>` / `Operation<>` instances

## Key Files
- `packages/core/src/prebuilt/types.ts` — `PrebuiltTypeRegistry`, `PrebuiltEntryNotFound`, `PrebuiltUnknownElement`
- `packages/core/src/prebuilt/type-calculator.ts` — runtime string-based type calculation for generation
- `packages/codegen/src/generator.ts:1262` — `generatePrebuiltStub()` emits empty stub
- `packages/codegen/src/generator.ts:1295` — `generateIndexModule()` emits `ResolveFragmentAtBuilder_*` / `ResolveOperationAtBuilder_*` types
- `packages/typegen/src/emitter.ts` — `emitPrebuiltTypes()` generates real `PrebuiltTypes_*` shapes
- `playgrounds/vite-react/src/graphql-system/index.ts` — example real generated output
- `fixture-catalog/graphql-system/types.prebuilt.ts` — example real prebuilt types with fragment+operation entries

## Type Safety Gaps Found

### Gap 1: PrebuiltTypeRegistry does NOT include `typename` on fragments
`PrebuiltTypeRegistry.fragments[key]` shape: `{ input: unknown; output: object }`
Generated `PrebuiltTypes_*["fragments"][key]` shape: `{ typename: "...", input: ...; output: ... }`
The `generateIndexModule` template reads `["fragments"][TKey]["typename"]` — this works at runtime
but `PrebuiltTypeRegistry` never validates the `typename` field exists.

### Gap 2: `PrebuiltTypeRegistry` is imported but never used as `satisfies` constraint
In generated `types.prebuilt.ts`:
```ts
import type { PrebuiltTypeRegistry } from "@soda-gql/core";
// ... but PrebuiltTypes_default is never declared as `satisfies PrebuiltTypeRegistry`
```
This means type drift between `PrebuiltTypeRegistry` and the actual generated shape is not caught.

### Gap 3: `void` input for fragments not in registry fragment shape
The `PrebuiltTypeRegistry.fragments[key].input` is typed as `unknown` (so `void` extends `unknown` = OK).
But `PrebuiltTypeRegistry.operations[key].input` is typed as `object` — and operations never use `void`, so this is consistent.

### Gap 4: `as unknown as GqlComposer_*` cast
In generated `index.ts`:
```ts
export const gql = {
  default: __gql_default as unknown as GqlComposer_default
};
```
The real `__gql_default` is typed by schema inference. The cast to `GqlComposer_default` discards it and injects the prebuilt types. This is intentional but means zero type safety on the runtime value — everything depends on prebuilt types being correct.

### Gap 5: Curried builder types use `(...args: unknown[])` double-nesting
```ts
type PrebuiltCurriedFragment_default = <TKey extends string>(
  name: TKey, typeName: string,
) => (...args: unknown[]) => (...args: unknown[]) => ResolveFragmentAtBuilder_default<TKey>;
```
The intermediate `=> (...args: unknown[]) =>` chain loses all argument types mid-chain.
The `$infer` on the resolved `Fragment<>` is where type safety kicks back in.

### Gap 6: The type-level E2E test is SKIPPED
`packages/typegen/test/e2e/key-inference.test.ts:191` — `test.skip("prebuilt module compiles with correct type resolution"...)`
This is the only test that would catch full-pipeline type regressions.

## What Works Well
- `ResolveFragmentAtBuilder_*` and `ResolveOperationAtBuilder_*` conditional types correctly map fragment/operation name keys to typed `Fragment<>` / `Operation<>` instances when `types.prebuilt.ts` is populated
- `PrebuiltEntryNotFound` branded error type surfaces clearly when keys don't match
- `type-calculator.ts` has excellent runtime test coverage (unit tests for all type string generation)
- `emitter.ts` tests verify correct string output for generated fragments/operations
- `fixture-catalog/graphql-system/types.prebuilt.ts` is a real reference output showing the system works end-to-end

## Branch Changes (fix/prebuilt-type-safety)
- `AnyFragment` changed from `Fragment<string, any, AnyFieldsExtended, any>` to `Fragment<string, any, any, any>`
- `AnyOperationOf<T>` changed from `Operation<T, string, string[], any, AnyFieldsExtended, any>` to `Operation<T, string, string[], any, any, any>`
- `generateIndexModule` gained `allFieldNames` param to generate `AllObjectFieldNames_*` union for `GenericFieldFactory_*` type (improves field name completions)
- `generateIndexModule` refactored `GenericFieldFactory_*` to use named `FieldFactoryFn_*` intermediate type

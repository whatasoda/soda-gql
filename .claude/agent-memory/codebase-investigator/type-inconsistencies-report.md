# Type Inconsistencies Report

Generated: 2026-03-08
Scope: packages/core, packages/builder, packages/common, packages/codegen, packages/typegen, packages/cli

---

## 1. Cross-Package Type Mismatches

### 1.1 `IntermediateElements` CanonicalId branding inconsistency
**Severity: medium**

`IntermediateElements` in `/Users/whatasoda/workspace/soda-gql/packages/builder/src/artifact/types.ts:5` is typed as `Record<CanonicalId, IntermediateArtifactElement>` (branded type). But:
- `BuilderService.getIntermediateElements()` in `/Users/whatasoda/workspace/soda-gql/packages/builder/src/service.ts:69` returns `Record<string, IntermediateArtifactElement> | null`
- `BuilderSession.getIntermediateElements()` in `/Users/whatasoda/workspace/soda-gql/packages/builder/src/session/builder-session.ts:137` returns `Record<string, IntermediateArtifactElement> | null`
- `SessionState.lastIntermediateElements` in `/Users/whatasoda/workspace/soda-gql/packages/builder/src/session/builder-session.ts:52` is `Record<string, IntermediateArtifactElement> | null`
- `extractFieldSelections` in `/Users/whatasoda/workspace/soda-gql/packages/builder/src/prebuilt/extractor.ts:58` accepts `Record<CanonicalId, IntermediateArtifactElement>`

The public interface strips the `CanonicalId` brand at the API boundary (returning plain `string`), while internal artifact types and `extractFieldSelections` use the branded type. This requires the workaround at `/Users/whatasoda/workspace/soda-gql/packages/builder/src/prebuilt/extractor.ts:64` (`const canonicalId = id as CanonicalId;`).

### 1.2 `FieldSelectionData.variableDefinitions` type mismatch between fragment and operation
**Severity: medium**

In `/Users/whatasoda/workspace/soda-gql/packages/builder/src/prebuilt/extractor.ts:18-34`, `FieldSelectionData` is a discriminated union where:
- Fragment variant has `variableDefinitions: VariableDefinitions` (internal `@soda-gql/core` type — a keyed record of `VarSpecifier`)
- Operation variant has `variableDefinitions: readonly VariableDefinitionNode[]` (GraphQL AST type)

This forces the emitter in `/Users/whatasoda/workspace/soda-gql/packages/typegen/src/emitter.ts` to use two entirely different code paths:
- Line 158: `generateInputTypeFromVarDefs(schema, selection.variableDefinitions, ...)` for fragments
- Line 186: `generateInputType(schema, selection.variableDefinitions, formatters)` for operations

There is no structural reason for this divergence — both input types map the same conceptual information (variable name → GraphQL type) but use incompatible representations.

### 1.3 Duplicate `BuilderArtifact` type in schemas vs. artifact/types
**Severity: low**

`BuilderArtifact` is defined in two places:
- `/Users/whatasoda/workspace/soda-gql/packages/builder/src/artifact/types.ts` — the canonical handwritten type (exported from package index)
- `/Users/whatasoda/workspace/soda-gql/packages/builder/src/schemas/artifact.ts:67` — `type BuilderArtifact = z.infer<typeof BuilderArtifactSchema>` (NOT re-exported from index)

The Zod-inferred type is only used internally by `loadArtifact`/`loadArtifactSync` which casts the result to the canonical type (`validated.data as BuilderArtifact` at line 123). If the Zod schema and the handwritten type drift apart, the cast silently succeeds at compile-time. The `declare function __validate_*` guards at lines 24-26 and 39-41 only check one direction (whether the Zod output is assignable TO the canonical type), not the other direction.

---

## 2. Duplicate Type Definitions

### 2.1 `ModuleAnalysis` defined in both `ast/types.ts` and `schemas/cache.ts`
**Severity: medium**

`ModuleAnalysis` is defined twice:
- Handwritten type in `/Users/whatasoda/workspace/soda-gql/packages/builder/src/ast/types.ts:104` — used by all consumers
- Zod schema `ModuleAnalysisSchema` in `/Users/whatasoda/workspace/soda-gql/packages/builder/src/schemas/cache.ts:67` which exports `type ModuleAnalysis = z.infer<typeof ModuleAnalysisSchema>`

The Zod-inferred version is only used in cache serialization contexts. No structural sync mechanism exists between them. If a field is added to the handwritten `ModuleAnalysis`, the Zod schema must be manually updated or the cache will silently accept stale data.

### 2.2 `AnyGqlContext.compat` type misrepresents the actual return type
**Severity: medium**

In `/Users/whatasoda/workspace/soda-gql/packages/core/src/composer/gql-composer.ts:189`, `AnyGqlContext` types `query.compat`, `mutation.compat`, and `subscription.compat` as:
```
compat: (...args: unknown[]) => AnyGqlDefine
```

The actual implementation (line 141) is `createCompatTaggedTemplate` which returns `CurriedCompatFunction`:
```
(operationName: string) => CompatTaggedTemplate
```
where `CompatTaggedTemplate` is `(strings: TemplateStringsArray, ...values: never[]) => GqlDefine<TemplateCompatSpec>`.

Calling `compat("name")` returns a tagged template function, NOT an `AnyGqlDefine`. The full two-step invocation `compat("name")\`...\`` returns `GqlDefine<TemplateCompatSpec>` which is `AnyGqlDefine`, but the intermediate value is typed incorrectly. Any consumer of `AnyGqlContext` that calls `compat("name")` will see the wrong type.

---

## 3. Type Narrowing Gaps (Unsafe `as` Casts)

### 3.1 `error as BuilderError` in builder-session.ts catch blocks
**Severity: high**

In `/Users/whatasoda/workspace/soda-gql/packages/builder/src/session/builder-session.ts`, two catch blocks at lines 368 and 402 use `error as BuilderError`:
```typescript
} catch (error) {
  if (error && typeof error === "object" && "code" in error) {
    return err(error as BuilderError);
  }
  throw error;
}
```
The `"code" in error` guard is insufficient — any object with a `"code"` property passes this check, but is not necessarily a `BuilderError`. The `isBuilderError` type guard in `/Users/whatasoda/workspace/soda-gql/packages/builder/src/errors.ts:297` additionally checks `"message" in error && typeof error.message === "string"`, but the session code does not use it.

Similarly, `convertSchedulerError` at line 560 uses `error.cause as BuilderError` with a weaker guard than `isBuilderError`.

### 3.2 `error as BuilderError` does not use the exported `isBuilderError` guard
**Severity: medium**

`isBuilderError` is exported from `/Users/whatasoda/workspace/soda-gql/packages/builder/src/errors.ts:297` but not used at catch sites within the same package (builder-session.ts lines 368, 402, 560). The guard at the call site is weaker (only checks for `"code"` key), creating a narrowing gap.

### 3.3 `OptionalFileStatEffect` result cast in discoverer.ts
**Severity: medium**

In `/Users/whatasoda/workspace/soda-gql/packages/builder/src/discovery/discoverer.ts:175`, the result of `OptionalFileStatEffect` is cast:
```typescript
const stats = (yield* new OptionalFileStatEffect(filePath).run()) as FileStats;
```
`OptionalFileStatEffect` returns `FileStats | null` (line 106 of effects.ts), but here the result is asserted to be `FileStats` (non-null). At this code path, the file was just read successfully (source is non-null from line 134), so the file exists — making this likely safe in practice. However, it bypasses the null check silently.

### 3.4 `schema as AnyGraphqlSchema` in schema-loader.ts
**Severity: medium**

In `/Users/whatasoda/workspace/soda-gql/packages/builder/src/schema-loader.ts:123`:
```typescript
schemas[name] = schema as AnyGraphqlSchema;
```
The `schema` at this point is `unknown` (extracted from `composer.$schema` via object property access). The surrounding guard checks `typeof schema !== "object"` and `!schema`, but does not validate the shape of the schema against `AnyGraphqlSchema`. Any object that passes the non-null object check will be cast to `AnyGraphqlSchema`.

### 3.5 `define as () => FragmentArtifact<...>` in Fragment.create
**Severity: low**

In `/Users/whatasoda/workspace/soda-gql/packages/core/src/types/element/fragment.ts:125`:
```typescript
return new Fragment<TTypeName, Variables, Fields, Output>(define as () => FragmentArtifact<TTypeName, Variables, Fields>);
```
The incoming `define` function returns a slightly wider type (with `TSchema["label"]` in `schemaLabel`). The cast works but suppresses the type mismatch between `TSchema["label"]` (schema-specific string literal) and `string` in `FragmentArtifact`.

### 3.6 `wrapArtifactAsOperation` double cast
**Severity: low**

In `/Users/whatasoda/workspace/soda-gql/packages/core/src/composer/operation-core.ts:370`:
```typescript
}) as never) as any;
```
The `as never` cast is applied to the function's return value before casting to `any`. This double cast suppresses TypeScript's type checking entirely and makes it impossible to detect future type breakage in the artifact factory.

---

## 4. Generic Constraint Mismatches

### 4.1 `AnyGqlContext.fragment` return type is too loose
**Severity: low**

In `/Users/whatasoda/workspace/soda-gql/packages/core/src/composer/gql-composer.ts:186`:
```typescript
readonly fragment: (...args: unknown[]) => unknown;
```
The actual `fragment` from `createFragmentTaggedTemplate` returns a `CurriedFragmentFunction` — specifically a tagged template that ultimately returns a `Fragment`. The `AnyGqlContext` type is intentionally loose here for use as a minimal constraint type, but this means any code that receives an `AnyGqlContext` cannot call `fragment` and get a usable type.

### 4.2 `ResolveFragmentAtBuilder` uses `Partial<AnyFields>` for TFields
**Severity: medium**

In the generated `index.ts` (from `/Users/whatasoda/workspace/soda-gql/packages/codegen/src/generator.ts:1055`):
```typescript
Fragment<
  PrebuiltTypes_${name}["fragments"][TKey]["typename"],
  ...,
  Partial<AnyFields>,   // TFields is always Partial<AnyFields>
  ...
>
```
The `TFields` type parameter for `Fragment` is always `Partial<AnyFields>` regardless of the actual fields selected. The `Fragment` type has `TFields extends Partial<AnyFieldsExtended>` constraint, and the spread method signature depends on `TFields`. By using `Partial<AnyFields>`, the returned fragment's `spread()` return type loses all field-level precision. This is an intentional design trade-off for the prebuilt path, but it means field selections aren't type-checked for prebuilt fragments.

### 4.3 `PrebuiltTypeRegistry.operations[key].input` is `object` but generated code allows more
**Severity: low**

In `/Users/whatasoda/workspace/soda-gql/packages/core/src/prebuilt/types.ts:25`, `PrebuiltTypeRegistry.operations.input` is `object`.

In the generated prebuilt code (generator.ts line 1066), `operations[TName]["input"]` is passed directly as the `TVariables` generic of `Operation<..., TVariables, ...>`. `Operation`'s `TVariables` has constraint `Record<string, unknown>` (line 71 of operation.ts). The `object` constraint in `PrebuiltTypeRegistry` is weaker than `Record<string, unknown>` since `object` doesn't imply indexable. This means a type satisfying `PrebuiltTypeRegistry.operations.input: object` could fail the `Operation` constraint.

---

## 5. Return Type Inconsistencies

### 5.1 `generateInputType` vs `generateInputTypeFromVarDefs` return empty-object differently
**Severity: medium**

- `generateInputType` (for operations, from GraphQL AST nodes) at `/Users/whatasoda/workspace/soda-gql/packages/core/src/prebuilt/type-calculator.ts:494`: returns `"{}"` when no variables
- `generateInputTypeFromVarDefs` (for fragments, from `VariableDefinitions`) at line 600: returns `"void"` when no variables

This produces different TypeScript strings for the same conceptual situation (no input required). Fragments with no variables get type `void` in the prebuilt registry, but operations with no variables get type `{}`. In the generated resolver (generator.ts line 1052), fragment `input extends void ? void : ...` correctly handles this, but the asymmetry between fragment-void and operation-`{}` is semantically inconsistent. The `PrebuiltTypeRegistry.fragments.input` is typed as `unknown` which covers both, but any code pattern checking `extends void` for operations would fail.

### 5.2 `rootTypeName ?? undefined` passed to `calculateFieldsType` can cause runtime throw
**Severity: high**

In `/Users/whatasoda/workspace/soda-gql/packages/typegen/src/emitter.ts:182-183`:
```typescript
const rootTypeName = schema.operations[selection.operationType as keyof typeof schema.operations];
const outputType = calculateFieldsType(schema, selection.fields, outputFormatters, rootTypeName ?? undefined);
```
`OperationRoots.query/mutation/subscription` is typed as `string | null`. If the schema has a null root for the operation type (i.e., the schema doesn't support that operation type), `rootTypeName` is `null`, and `null ?? undefined` evaluates to `undefined`.

`calculateFieldsType` at `/Users/whatasoda/workspace/soda-gql/packages/core/src/prebuilt/type-calculator.ts:428-433` throws if any field uses shorthand syntax (`true`) and `typeName` is `undefined`. This scenario can occur at runtime with no TypeScript type error — the TypeScript types don't prevent passing `undefined` here, and the throw is not caught by the outer `try/catch` in `emitter.ts` that wraps this call, so it would be caught and converted to a warning. The deeper issue is that the type of `rootTypeName` before the `?? undefined` is `string | null`, and passing `null ?? undefined` is effectively converting a potentially meaningful nullability to `undefined` silently.

### 5.3 `CompatTaggedTemplate.compat` return inconsistency between actual API and `AnyGqlContext`
**Severity: medium**

(Same as finding 2.2, stated from the return type angle.)

`AnyGqlContext.compat` at `/Users/whatasoda/workspace/soda-gql/packages/core/src/composer/gql-composer.ts:189` is typed as returning `AnyGqlDefine` directly when called. The real two-step invocation is:
1. `compat("name")` → returns `CompatTaggedTemplate` (a tag function, NOT `AnyGqlDefine`)
2. `` compat("name")`...` `` → returns `GqlDefine<TemplateCompatSpec>` which is `AnyGqlDefine`

Any caller treating the one-step result as an `AnyGqlDefine` would get a runtime function object (not a `GqlDefine`) with no TypeScript error.

---

## 6. Additional Observations

### 6.1 `CanonicalIdSchema` uses double cast to brand a Zod type
**Severity: low**

In `/Users/whatasoda/workspace/soda-gql/packages/common/src/canonical-id/canonical-id.ts:9`:
```typescript
export const CanonicalIdSchema: z.ZodType<CanonicalId> = z.string() as unknown as z.ZodType<CanonicalId>;
```
This is a common pattern for Zod branding but is structurally unsafe — the Zod schema does not validate the brand. Any string passes. This is a known limitation but means `CanonicalIdSchema.parse("not-canonical")` succeeds at runtime.

### 6.2 `PrebuiltTypeRegistry` not used as `satisfies` constraint in generated files
**Severity: low**

(Confirmed from MEMORY.md note, 2026-03-05.)

The generated `PrebuiltTypes_*` shapes in `types.prebuilt.ts` are never constrained with `satisfies PrebuiltTypeRegistry`. If typegen generates a shape incompatible with `PrebuiltTypeRegistry` (e.g., missing `typename` on fragment entries), there is no compile-time check. The `PrebuiltTypeRegistry` type exists but is only used implicitly by consumers.

### 6.3 `SWC` adapter uses `as any` extensively without documentation
**Severity: low**

`/Users/whatasoda/workspace/soda-gql/packages/builder/src/ast/adapters/swc.ts` contains multiple `as any` casts (lines 87, 90, 193, 202, 217-219, 619-621, 775, 791, 793, 821) due to incomplete SWC type definitions. These are annotated with `biome-ignore` comments, but represent an untypeable surface area where AST shape errors would only surface at runtime.

---

## Summary by Severity

| Severity | Count | Key Issues |
|----------|-------|------------|
| Critical | 0     | — |
| High     | 2     | `error as BuilderError` without `isBuilderError`, `rootTypeName ?? undefined` runtime throw |
| Medium   | 7     | `IntermediateElements` brand loss, `variableDefinitions` type divergence, `ModuleAnalysis` duplication, `AnyGqlContext.compat` wrong return type, `OptionalFileStatEffect` null cast, schema-loader cast, `generateInputType` empty-vs-void asymmetry |
| Low      | 6     | Fragment.create cast, operation-core double cast, `Partial<AnyFields>` TFields, `PrebuiltTypeRegistry.input: object` vs `Record`, `CanonicalIdSchema` branding, `PrebuiltTypeRegistry` missing satisfies |

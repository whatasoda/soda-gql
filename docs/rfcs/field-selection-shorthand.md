# RFC: Field Selection Shorthand Syntax

## Status

**Draft** - Design finalized, pending implementation

## Summary

Introduce a shorthand syntax for scalar/enum field selections that reduces boilerplate while maintaining type safety and backward compatibility.

## Motivation

The current field selection syntax requires verbose spread patterns for simple scalar fields:

```typescript
// Current syntax
fields: ({ f }) => ({
  ...f.id(),
  ...f.name(),
  ...f.email(),
  ...f.status(),
})
```

This RFC proposes a shorthand syntax closer to GraphQL's native representation:

```typescript
// Proposed shorthand
fields: ({ f }) => ({
  id: true,
  name: true,
  email: true,
  status: true,
})
```

## Design Decisions

### Scope

| Feature | Shorthand Support |
|---------|------------------|
| Scalar fields (no args) | `id: true` |
| Enum fields (no args) | `status: true` |
| Scalar/Enum with args | `{ args: {...} }` |
| Scalar/Enum with directives | `{ directives: [...] }` |
| Object fields | **Factory only** - `...f.profile()(...)` |
| Union fields | **Factory only** - `...f.media()(...)` |

### Key Design Choices

1. **Hybrid approach**: Shorthand and factory syntax can be mixed freely
2. **Scalars/Enums only**: Object/Union fields require callbacks (no change)
3. **Variables via callback**: `$` access remains through callback arguments
4. **`:` prefix for factory keys**: Factory returns use `:fieldName` keys (e.g., `":id"`) to distinguish from shorthand
5. **Runtime detection**: Key prefix check (`key.startsWith(':')` for factory, plain key for shorthand)
6. **Alias via factory only**: Aliases require factory syntax (shorthand does not support aliases)

### Design Rationale: `:` Prefix

The colon (`:`) prefix was chosen for factory keys because:

1. **GraphQL alias syntax alignment**: In GraphQL, aliases use colon syntax (`alias: fieldName`). This creates a natural mental model where `:fieldName` represents "a field that may have an alias"
2. **No symbol collision**: Other symbols are already used in GraphQL/TypeScript context:
   - `$` - Variables in GraphQL (`$userId`)
   - `@` - Directives in GraphQL (`@include`, `@skip`)
   - `#` - Comments in GraphQL
   - `_` - Common convention for private/internal identifiers

Note: Keys with `:` prefix require quotes in object literals (e.g., `{ ":id": ... }`), but this is handled internally by `wrapByKey` utility, so users don't write these keys directly.

## Detailed Design

### Syntax Examples

```typescript
// Basic shorthand
fields: ({ f, $ }) => ({
  // No-arg scalars - shorthand (plain keys)
  id: true,
  name: true,
  status: true,  // Enum OK

  // Scalar with arguments
  formattedDate: { args: { format: "YYYY-MM-DD" } },

  // Scalar with directives
  email: { directives: [d.include({ if: $.showEmail })] },

  // Arguments + directives
  avatar: { args: { size: 100 }, directives: [d.skip({ if: $.noAvatar })] },

  // Object fields - factory required (returns :prefix keys)
  ...f.friends({ first: 10 })(({ f }) => ({
    // ↑ spreads as { ":friends": {...} }
    id: true,
    name: true,
  })),

  // Mixed syntax OK - shorthand and factory coexist
  ...f.profile()(({ f }) => ({
    // ↑ spreads as { ":profile": {...} }
    bio: true,
    ...f.avatar({ size: 200 }),  // spreads as { ":avatar": {...} }
  })),

  // Alias requires factory syntax
  ...f.id(null, { alias: "uniqueId" }),  // spreads as { ":uniqueId": {...} }

  // Alias with arguments - requires factory syntax
  ...f.formattedDate({ format: "YYYY-MM-DD" }, { alias: "dateFormatted" }),
  // ↑ spreads as { ":dateFormatted": {...} }
})
```

**Key distinction:**
- Shorthand values (`true`, `{ args }`, `{ directives }`) use plain keys: `id`, `name`, etc.
- Factory returns use `:` prefixed keys: `":id"`, `":profile"`, etc.

**Note**: Empty object `{}` is not valid shorthand. Use `true` for simple selections:
- ✅ `id: true`
- ❌ `id: {}`

**Why `{}` is invalid**:
- **Ambiguity**: `{}` could mean "select with no args" or "incomplete object notation"
- **Type safety**: `true` is unambiguous and easier to validate at type level
- **Consistency**: Requiring explicit `true` makes intent clear
- **Detection**: `{} extends ScalarShorthandObject` is `true` in TypeScript, making runtime detection unreliable

### Type Definitions

#### New Types (`types/fragment/field-selection.ts`)

```typescript
/**
 * Object notation for scalar/enum with args or directives.
 * At least one of args or directives must be specified.
 * Use `true` for simple field selection without args or directives.
 *
 * Note: This union type enforces that at least one property is required:
 * - { args: TArgs; directives?: ... } - args required
 * - { args?: TArgs; directives: ... } - directives required
 * Empty object `{}` does NOT satisfy either branch, so it produces a type error.
 */
export type ScalarShorthandObject<TArgs extends AnyAssignableInput = AnyAssignableInput> =
  | { readonly args: TArgs; readonly directives?: AnyDirectiveRef[] }
  | { readonly args?: TArgs; readonly directives: AnyDirectiveRef[] };

/**
 * Shorthand values: true or object notation (never empty {})
 * - `true`: Simple field selection without args or directives
 * - `ScalarShorthandObject`: Object with args and/or directives (at least one required)
 */
export type ScalarShorthand<TArgs extends AnyAssignableInput = AnyAssignableInput> =
  | true
  | ScalarShorthandObject<TArgs>;

/**
 * Field value including shorthand (plain keys) and factory returns (: prefixed keys)
 */
export type AnyFieldValue = AnyFieldSelection | ScalarShorthand;

/**
 * Extended field map supporting both shorthand and factory syntax
 * - Plain keys (e.g., "id"): Shorthand values (true | { args } | { directives } | { args, directives })
 * - Colon-prefixed keys (e.g., ":id"): Factory returns (AnyFieldSelection)
 */
export type AnyFieldsExtended = {
  readonly [key: string]: AnyFieldValue;
};
```

#### `wrapByKey` Utility (`utils/wrap-by-key.ts`)

```typescript
/**
 * Wraps a value with a colon-prefixed key for factory returns.
 * This ensures factory results are distinguishable from shorthand.
 */
export const wrapByKey = <K extends string, V>(key: K, value: V) =>
  ({ [`:${key}`]: value }) as { [_ in `:${K}`]: V };
```

#### Type Inference (`types/fragment/field-selection.ts`)

```typescript
/**
 * Strip colon prefix from factory keys for output type mapping.
 * Factory keys like ":id" become "id" in the output type.
 */
type StripColonPrefix<K extends string> = K extends `:${infer R}` ? R : K;

/**
 * Infer fields with shorthand support
 */
export type InferFieldsExtended<
  TSchema extends AnyGraphqlSchema,
  TTypeName extends keyof TSchema["object"] & string,
  TFields extends AnyFieldsExtended,
> = {
  [_ in TSchema["label"]]: {
    [K in keyof TFields as StripColonPrefix<K & string>]: InferFieldValue<TSchema, TTypeName, K & string, TFields[K]>;
  } & {};
}[TSchema["label"]];

type InferFieldValue<
  TSchema extends AnyGraphqlSchema,
  TTypeName extends keyof TSchema["object"] & string,
  TFieldKey extends string,
  TValue,
> =
  // Factory return (: prefixed key) - use existing InferField
  TFieldKey extends `:${string}`
    ? TValue extends AnyFieldSelection
      ? InferField<TSchema, TValue>
      : never
  // Shorthand: true - apply ValidateShorthand for required args check
  : TValue extends true
    ? TFieldKey extends keyof TSchema["object"][TTypeName]["fields"] & string
      ? ValidateShorthand<TSchema, TTypeName, TFieldKey, TValue> extends true
        ? InferScalarFieldByName<TSchema, TTypeName, TFieldKey>
        : never  // Type error: field has required arguments
      : never
  // Object notation: { args } | { directives } | { args, directives }
  : TValue extends ScalarShorthandObject
    ? TFieldKey extends keyof TSchema["object"][TTypeName]["fields"]
      ? InferScalarFieldByName<TSchema, TTypeName, TFieldKey>
      : never
  : never;

type InferScalarFieldByName<
  TSchema extends AnyGraphqlSchema,
  TTypeName extends keyof TSchema["object"] & string,
  TFieldName extends keyof TSchema["object"][TTypeName]["fields"],
> = TSchema["object"][TTypeName]["fields"][TFieldName] extends OutputInferrableTypeSpecifier
  ? GetModifiedType<
      InferOutputProfile<TSchema, TSchema["object"][TTypeName]["fields"][TFieldName]>,
      TSchema["object"][TTypeName]["fields"][TFieldName]["modifier"]
    >
  : never;
```

#### Required Arguments Validation (`types/fragment/field-selection.ts`)

The type system enforces that `true` shorthand is only valid for fields without required arguments.
This uses the existing `IsOptional` logic from `assignable-input.ts`.

```typescript
/**
 * Extract required keys from an object type.
 * A key is required if {} doesn't extend Pick<T, K>.
 */
type RequiredKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? never : K;
}[keyof T];

/**
 * Check if a field has no required arguments.
 */
type HasNoRequiredArgs<
  TSchema extends AnyGraphqlSchema,
  TTypeName extends keyof TSchema["object"] & string,
  TFieldName extends keyof TSchema["object"][TTypeName]["fields"] & string,
> = keyof RequiredKeys<AssignableInputByFieldName<TSchema, TTypeName, TFieldName>> extends never
  ? true
  : false;

/**
 * Validate that shorthand `true` is only used for fields without required arguments.
 * Fields with required arguments must use object notation with `args`.
 */
type ValidateShorthand<
  TSchema extends AnyGraphqlSchema,
  TTypeName extends keyof TSchema["object"] & string,
  TFieldName extends string,
  TValue,
> = TValue extends true
  ? TFieldName extends keyof TSchema["object"][TTypeName]["fields"] & string
    ? HasNoRequiredArgs<TSchema, TTypeName, TFieldName> extends true
      ? true
      : never  // Type error: field has required arguments, use { args: {...} } instead
    : never
  : TValue;
```

This validation is applied in `InferFieldValue` to produce type errors when `true` is used on fields with required arguments.

### Runtime Processing (`composer/build-document.ts`)

```typescript
/**
 * Check if a key is from factory (has : prefix)
 */
function isFactoryKey(key: string): boolean {
  return key.startsWith(':');
}

/**
 * Extract field name from key (removes : prefix if present)
 */
function extractFieldName(key: string): string {
  return isFactoryKey(key) ? key.slice(1) : key;
}

/**
 * Expand shorthand to AnyFieldSelection
 */
function expandShorthand(
  schema: AnyGraphqlSchema,
  typeName: string,
  fieldName: string,
  value: ScalarShorthand,
): AnyFieldSelection {
  const typeDef = schema.object[typeName];
  const fieldSpec = typeDef.fields[fieldName];

  const shorthandObj = value === true ? {} : value;

  return {
    parent: typeName,
    field: fieldName,
    type: fieldSpec,
    args: shorthandObj.args ?? {},
    directives: shorthandObj.directives ?? [],
    object: null,
    union: null,
  };
}

/**
 * Build field nodes from extended fields map
 */
const buildField = (
  fields: AnyFieldsExtended,
  schema: AnyGraphqlSchema,
  typeName: string,
): FieldNode[] =>
  Object.entries(fields).map(([key, value]) => {
    const fieldName = extractFieldName(key);

    // Factory return (: prefixed key) - value is AnyFieldSelection
    if (isFactoryKey(key)) {
      const selection = value as AnyFieldSelection;
      const { args, field, object, union, directives, type } = selection;
      // ... existing buildField logic
    }

    // Shorthand (plain key) - expand to AnyFieldSelection
    const selection = expandShorthand(schema, typeName, fieldName, value as ScalarShorthand);
    const { args, field, object, union, directives, type } = selection;
    // ... same buildField logic
  });
```

## Implementation Plan

| Phase | Description | Files |
|-------|-------------|-------|
| 1 | Update `wrapByKey` to add `:` prefix | `utils/wrap-by-key.ts` |
| 2 | Add shorthand types | `types/fragment/field-selection.ts` |
| 3 | Add `InferFieldsExtended` with `StripColonPrefix` | `types/fragment/field-selection.ts` |
| 4 | Runtime detection and expansion | `composer/build-document.ts` |
| 4.1 | Update `buildField` call sites to pass `typeName` | `composer/build-document.ts` |
| 5 | Extend `FieldsBuilder` types | `types/element/fields-builder.ts` |
| 6 | Update Fragment/Operation builders | `composer/fragment.ts`, `composer/operation.ts` |
| 7 | Update formatter for `:` prefix handling | `packages/formatter/src/*.ts` |
| 8 | Add tests | `*.test.ts` |

**Note**: Phase 1 (`wrapByKey` change) is a breaking change for existing code. All existing tests will need updates to expect `:` prefixed keys.

## Backward Compatibility

- **Source-level compatible**: Existing `...f.id()` spread patterns work unchanged in source code
- **Runtime key change**: Factory returns now use `:` prefixed keys (e.g., `":id"` instead of `"id"`)
- **Mixing allowed**: Both shorthand and factory syntaxes can be used in the same builder
- **Gradual migration**: Projects can adopt shorthand at their own pace

**Breaking change note**: Internal key representation changes from `"fieldName"` to `":fieldName"` for factory returns. This affects:
- Code that directly accesses field selection keys
- Test assertions that check field map structure
- Any tooling that parses field selection objects

## Alternatives Considered

### 1. Full Object Literal Syntax (for Object/Union Fields)

```typescript
{
  id: true,
  friends: {
    args: { first: 10 },
    fields: { id: true, name: true }
  }
}
```

**Rejected because**:
- Variable access (`$`) becomes awkward for nested selections
- Union type handling becomes complex
- Significant type system rewrite required
- Factory syntax with callbacks provides better type inference for nested fields

### 2. Value-based Detection (without Key Prefix)

```typescript
// Detect via value structure
function isShorthand(value: AnyFieldValue): value is ScalarShorthand {
  return value === true || !('parent' in value);
}
```

**Rejected because**:
- Relies on internal structure of `AnyFieldSelection`
- Fragile to future changes in field selection structure
- Key prefix provides cleaner, more explicit distinction

### 3. `select: true` Property for Directive-only Shorthand

```typescript
{ select: true, directives: [...] }
```

**Rejected because**:
- Redundant - `directives` presence is sufficient
- Adds unnecessary verbosity
- Final design: `{ directives: [...] }` without `select`

## References

- Current field selection: `packages/core/src/types/fragment/field-selection.ts`
- Assignable input (IsOptional logic): `packages/core/src/types/fragment/assignable-input.ts`
- Builder implementation: `packages/core/src/composer/fields-builder.ts`
- Fields builder types: `packages/core/src/types/element/fields-builder.ts`
- Key wrapping utility: `packages/core/src/utils/wrap-by-key.ts`
- Document builder: `packages/core/src/composer/build-document.ts`
- Fragment composer: `packages/core/src/composer/fragment.ts`
- Operation composer: `packages/core/src/composer/operation.ts`
- Type inference: `InferFields` type in `field-selection.ts`

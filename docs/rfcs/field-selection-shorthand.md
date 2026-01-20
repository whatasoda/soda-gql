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

This RFC introduces shorthand syntax for simple scalar and enum field selections.

#### Shorthand Supported

| Feature | Syntax |
|---------|--------|
| Scalar fields (no args) | `id: true` |
| Enum fields (no args) | `status: true` |

#### Factory Required (No Change)

| Feature | Syntax |
|---------|--------|
| Scalar/Enum with args | `...f.formattedDate({ format: "..." })` |
| Scalar/Enum with directives | `...f.email(null, { directives: [...] })` |
| Object fields | `...f.profile()(...)` |
| Union fields | `...f.media()(...)` |

### Key Design Choices

1. **Hybrid approach**: Shorthand and factory syntax can be mixed freely
2. **Scalars/Enums only**: Object/Union fields require callbacks (no change)
3. **Variables via callback**: `$` access remains through callback arguments
4. **Value-based detection**: Runtime distinguishes shorthand (`true`) from factory returns (`AnyFieldSelection`) by checking value structure
5. **Alias via factory only**: Aliases require factory syntax (shorthand does not support aliases)
6. **Args/Directives via factory only**: Fields with arguments or directives require factory syntax

## Detailed Design

### Syntax Examples

```typescript
// Basic shorthand
fields: ({ f, $ }) => ({
  // No-arg scalars - shorthand
  id: true,
  name: true,
  status: true,  // Enum OK

  // Scalar with arguments - factory required
  ...f.formattedDate({ format: "YYYY-MM-DD" }),

  // Scalar with directives - factory required
  ...f.email(null, { directives: [d.include({ if: $.showEmail })] }),

  // Arguments + directives - factory required
  ...f.avatar({ size: 100 }, { directives: [d.skip({ if: $.noAvatar })] }),

  // Object fields - factory required
  ...f.friends({ first: 10 })(({ f }) => ({
    id: true,
    name: true,
  })),

  // Mixed syntax OK - shorthand and factory coexist
  ...f.profile()(({ f }) => ({
    bio: true,
    ...f.avatar({ size: 200 }),
  })),

  // Alias requires factory syntax
  ...f.id(null, { alias: "uniqueId" }),

  // Alias with arguments - requires factory syntax
  ...f.formattedDate({ format: "YYYY-MM-DD" }, { alias: "dateFormatted" }),
})
```

**Key distinction:**
- Shorthand: `true` for simple scalar/enum fields without args or directives
- Factory: Spread syntax (`...f.fieldName()`) for fields with args, directives, aliases, or nested selections

**Note**: Only `true` is valid for shorthand. Empty object `{}` is not allowed:
- ✅ `id: true`
- ❌ `id: {}`

Why `true` only: The literal `true` is unambiguous and easy to detect at both type and runtime level. An empty object `{}` would be indistinguishable from a malformed `AnyFieldSelection` and adds no value over `true`.

### Type Definitions

#### New Types (`types/fragment/field-selection.ts`)

```typescript
/**
 * Shorthand value for scalar/enum fields without args or directives.
 * Only `true` is valid - use factory syntax for args/directives.
 */
export type ScalarShorthand = true;

/**
 * Field value: either shorthand (true) or factory return (AnyFieldSelection)
 */
export type AnyFieldValue = AnyFieldSelection | ScalarShorthand;

/**
 * Extended field map supporting both shorthand and factory syntax.
 * Detection is value-based: `true` for shorthand, object for factory.
 */
export type AnyFieldsExtended = {
  readonly [key: string]: AnyFieldValue;
};
```

#### Type Inference (`types/fragment/field-selection.ts`)

```typescript
/**
 * Infer fields with shorthand support.
 * No key transformation needed - detection is purely value-based.
 */
export type InferFieldsExtended<
  TSchema extends AnyGraphqlSchema,
  TTypeName extends keyof TSchema["object"] & string,
  TFields extends AnyFieldsExtended,
> = {
  [_ in TSchema["label"]]: {
    [K in keyof TFields]: InferFieldValue<TSchema, TTypeName, K & string, TFields[K]>;
  } & {};
}[TSchema["label"]];

type InferFieldValue<
  TSchema extends AnyGraphqlSchema,
  TTypeName extends keyof TSchema["object"] & string,
  TFieldKey extends string,
  TValue,
> =
  // Shorthand: true - validate no required args
  TValue extends true
    ? TFieldKey extends keyof TSchema["object"][TTypeName]["fields"] & string
      ? ValidateShorthand<TSchema, TTypeName, TFieldKey, TValue> extends true
        ? InferScalarFieldByName<TSchema, TTypeName, TFieldKey>
        : never  // Type error: field has required arguments
      : never
  // Factory return - use existing InferField
  : TValue extends AnyFieldSelection
    ? InferField<TSchema, TValue>
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
 * Fields with required arguments must use factory syntax.
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
      : never  // Type error: field has required arguments, use factory syntax
    : never
  : TValue;
```

This validation is applied in `InferFieldValue` to produce type errors when `true` is used on fields with required arguments.

### Runtime Processing (`composer/build-document.ts`)

```typescript
/**
 * Check if value is shorthand (true) vs factory return (AnyFieldSelection)
 */
function isShorthand(value: AnyFieldValue): value is ScalarShorthand {
  return value === true;
}

/**
 * Expand shorthand to AnyFieldSelection
 */
function expandShorthand(
  schema: AnyGraphqlSchema,
  typeName: string,
  fieldName: string,
): AnyFieldSelection {
  const typeDef = schema.object[typeName];
  const fieldSpec = typeDef.fields[fieldName];

  return {
    parent: typeName,
    field: fieldName,
    type: fieldSpec,
    args: {},
    directives: [],
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
  Object.entries(fields).map(([fieldName, value]) => {
    // Expand shorthand to AnyFieldSelection if needed
    const selection = isShorthand(value)
      ? expandShorthand(schema, typeName, fieldName)
      : value;

    const { args, field, object, union, directives, type } = selection;
    // ... existing buildField logic
  });
```

## Implementation Plan

| Phase | Description | Files |
|-------|-------------|-------|
| 1 | Add shorthand types (`ScalarShorthand`, `AnyFieldValue`, `AnyFieldsExtended`) | `types/fragment/field-selection.ts` |
| 2 | Add `InferFieldsExtended` and `ValidateShorthand` types | `types/fragment/field-selection.ts` |
| 3 | Add `isShorthand` and `expandShorthand` runtime functions | `composer/build-document.ts` |
| 4 | Update `buildField` to handle shorthand expansion | `composer/build-document.ts` |
| 5 | Extend `FieldsBuilder` return types to accept shorthand | `types/element/fields-builder.ts` |
| 6 | Update Fragment/Operation builders | `composer/fragment.ts`, `composer/operation.ts` |
| 7 | Add tests | `*.test.ts` |

**Note**: No breaking changes to existing code. Factory syntax continues to work unchanged.

## Backward Compatibility

- **Fully compatible**: Existing `...f.id()` spread patterns work unchanged
- **No internal changes**: Factory returns use the same key format as before
- **Mixing allowed**: Both shorthand and factory syntaxes can be used in the same builder
- **Gradual migration**: Projects can adopt shorthand at their own pace

No breaking changes. Value-based detection (`value === true`) distinguishes shorthand from factory returns without requiring key format changes.

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

### 2. Key Prefix (`:fieldName`) for Factory Detection

```typescript
// Factory returns use : prefix
...f.id()  // spreads as { ":id": {...} }

// Shorthand uses plain keys
id: true   // plain key "id"
```

**Rejected because**:
- Requires `StripColonPrefix` type transformation in type inference
- Breaking change: all existing tests need key updates
- `wrapByKey` utility modification adds complexity
- Value-based detection is simpler and sufficient

### 3. Object Notation Shorthand (`{ args }`, `{ directives }`)

```typescript
// Shorthand with arguments
formattedDate: { args: { format: "YYYY-MM-DD" } },

// Shorthand with directives
email: { directives: [d.include({ if: $.showEmail })] },
```

**Rejected because**:
- Adds `ScalarShorthandObject` type with union branches
- Type inference for `{ args }` requires additional validation
- Factory syntax already handles these cases cleanly
- Limiting shorthand to `true` only keeps types simple

## References

- Current field selection: `packages/core/src/types/fragment/field-selection.ts`
- Assignable input (IsOptional logic): `packages/core/src/types/fragment/assignable-input.ts`
- Builder implementation: `packages/core/src/composer/fields-builder.ts`
- Fields builder types: `packages/core/src/types/element/fields-builder.ts`
- Document builder: `packages/core/src/composer/build-document.ts`
- Fragment composer: `packages/core/src/composer/fragment.ts`
- Operation composer: `packages/core/src/composer/operation.ts`
- Type inference: `InferFields` type in `field-selection.ts`

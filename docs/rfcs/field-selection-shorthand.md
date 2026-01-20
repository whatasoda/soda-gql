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
| Scalar/Enum with directives | `{ select: true, directives: [...] }` |
| Object fields | **Factory only** - `...f.profile()(...)` |
| Union fields | **Factory only** - `...f.media()(...)` |

### Key Design Choices

1. **Hybrid approach**: Shorthand and factory syntax can be mixed freely
2. **Scalars/Enums only**: Object/Union fields require callbacks (no change)
3. **Variables via callback**: `$` access remains through callback arguments
4. **No meta-field prefixes**: `args`, `select`, `directives` used as-is (collision unlikely with type safety)
5. **Runtime detection**: Value check (`value === true` or `!('parent' in value)`)

## Detailed Design

### Syntax Examples

```typescript
// Basic shorthand
fields: ({ f, $ }) => ({
  // No-arg scalars - shorthand
  id: true,
  name: true,
  status: true,  // Enum OK

  // Scalar with arguments
  formattedDate: { args: { format: "YYYY-MM-DD" } },

  // Scalar with directives
  email: { select: true, directives: [d.include({ if: $.showEmail })] },

  // Arguments + directives
  avatar: { args: { size: 100 }, directives: [d.skip({ if: $.noAvatar })] },

  // Object fields - factory required (unchanged)
  ...f.friends({ first: 10 })(({ f }) => ({
    id: true,
    name: true,
  })),

  // Mixed syntax OK
  ...f.profile()(({ f }) => ({
    bio: true,
    ...f.avatar({ size: 200 }),  // Factory still works
  })),
})
```

### Type Definitions

#### New Types (`types/fragment/field-selection.ts`)

```typescript
/**
 * Object notation for scalar/enum with args or directives
 */
export type ScalarShorthandObject<TArgs extends AnyAssignableInput = AnyAssignableInput> = {
  readonly args?: TArgs;
  readonly directives?: AnyDirectiveRef[];
  readonly select?: true;
};

/**
 * Shorthand values: true or object notation
 */
export type ScalarShorthand<TArgs extends AnyAssignableInput = AnyAssignableInput> =
  | true
  | ScalarShorthandObject<TArgs>;

/**
 * Field value including shorthand
 */
export type AnyFieldValue = AnyFieldSelection | ScalarShorthand;

/**
 * Extended field map
 */
export type AnyFieldsExtended = {
  readonly [alias: string]: AnyFieldValue;
};
```

#### Type Inference (`types/fragment/field-selection.ts`)

```typescript
/**
 * Infer fields with shorthand support
 */
export type InferFieldsExtended<
  TSchema extends AnyGraphqlSchema,
  TTypeName extends keyof TSchema["object"] & string,
  TFields extends AnyFieldsExtended,
> = {
  [_ in TSchema["label"]]: {
    [K in keyof TFields]: InferFieldValue<TSchema, TTypeName, K, TFields[K]>;
  } & {};
}[TSchema["label"]];

type InferFieldValue<
  TSchema extends AnyGraphqlSchema,
  TTypeName extends keyof TSchema["object"] & string,
  TFieldKey,
  TValue,
> =
  // Shorthand: true
  TValue extends true
    ? TFieldKey extends keyof TSchema["object"][TTypeName]["fields"]
      ? InferScalarFieldByName<TSchema, TTypeName, TFieldKey>
      : never
  // Object notation: { args?, directives?, select? }
  : TValue extends ScalarShorthandObject
    ? TFieldKey extends keyof TSchema["object"][TTypeName]["fields"]
      ? InferScalarFieldByName<TSchema, TTypeName, TFieldKey>
      : never
  // Existing: AnyFieldSelection
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

### Runtime Processing (`composer/build-document.ts`)

```typescript
/**
 * Detect shorthand value
 */
function isShorthand(value: AnyFieldValue): value is ScalarShorthand {
  return value === true || (
    typeof value === 'object' &&
    value !== null &&
    !('parent' in value)
  );
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
```

## Implementation Plan

| Phase | Description | Files |
|-------|-------------|-------|
| 1 | Add shorthand types | `types/fragment/field-selection.ts` |
| 2 | Add `InferFieldsExtended` | `types/fragment/field-selection.ts` |
| 3 | Runtime detection and expansion | `composer/build-document.ts` |
| 4 | Extend `FieldsBuilder` types | `types/element/fields-builder.ts` |
| 5 | Update Fragment/Operation builders | `composer/fragment.ts`, `composer/operation.ts` |
| 6 | Add tests | `*.test.ts` |

## Backward Compatibility

- **Fully backward compatible**: Existing `...f.id()` patterns work unchanged
- **Mixing allowed**: Both syntaxes can be used in the same builder
- **Gradual migration**: Projects can adopt shorthand at their own pace

## Alternatives Considered

### 1. Full Object Literal Syntax

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
- Meta-field name collision with GraphQL fields
- Variable access (`$`) becomes awkward
- Union type handling becomes complex
- Significant type system rewrite required

### 2. Prefix for Meta-fields

```typescript
{ $args: {...}, $directives: [...] }
```

**Rejected because**:
- Unnecessary given type safety
- Less readable
- GraphQL already prohibits `$` in field names

## Open Questions

None at this time.

## References

- Current field selection: `packages/core/src/types/fragment/field-selection.ts`
- Builder implementation: `packages/core/src/composer/fields-builder.ts`
- Type inference: `InferFields` type in `field-selection.ts`

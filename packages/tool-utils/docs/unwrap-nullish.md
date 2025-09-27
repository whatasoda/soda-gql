# unwrap-nullish Utility

## Overview

`unwrapNullish` is a utility function for safely unwrapping (extracting as non-null values) values that are treated as nullable (`T | null | undefined`) in the type system but are guaranteed to exist in the code implementation.

## Why is it needed?

TypeScript's type system errs on the safe side and returns nullable types for many operations such as array access and Map lookups. While this is generally good design, it forces redundant null checks when developers have guaranteed the existence of values through prior validation.

### Typical Example

```typescript
// Type system treats arr[2] as string | undefined
const arr: string[] = ["a", "b", "c"];
if (arr.length >= 3) {
  const thirdItem = arr[2]; // string | undefined 😕
  // We want to treat this as string
}
```

## Usage

```typescript
import { unwrapNullish } from "@soda-gql/tool-utils";

const arr: string[] = ["a", "b", "c"];
if (arr.length >= 3) {
  const thirdItem = unwrapNullish(arr[2], "safe-array-item-access");
  // thirdItem can be treated as string ✅
}
```

## Approved Reasons (ApprovedFairReasonToStripNullish)

When using `unwrapNullish`, you must specify a pre-defined "reason". This explicitly documents why the value can be asserted as non-null.

### Currently Approved Reasons

| key | Description |
|-----|-------------|
| `safe-array-item-access` | When the array length has been validated beforehand and the existence of a value at the accessed index is guaranteed |
| `validated-map-lookup` | When the existence of a key in a Map or Object has been validated beforehand |
| `guaranteed-by-control-flow` | When control flow analysis guarantees that a value is non-null |
| `validated-string-split` | When the result of string split is guaranteed to have the expected number of elements |

### Adding New Reasons

When new use cases arise, you can add a new entry to the `ApprovedFairReasonToStripNullish` type:

```typescript
type ApprovedFairReasonToStripNullish =
  | // ... existing reasons
  | {
      key: "your-new-reason";
      description: "Detailed description";
    };
```

**Note**: New reasons are subject to regular human review.

## Error Handling

If a value is null or undefined, `UnwrapNullishError` will be thrown. This error includes the specified reason, making debugging easier.

```typescript
try {
  const value = unwrapNullish(maybeNull, "safe-array-item-access");
} catch (error) {
  if (error instanceof UnwrapNullishError) {
    console.error(error.message);
    // "Value is null or undefined although it was expected to be not null or undefined because: safe-array-item-access"
  }
}
```

## Usage Notes

### ⚠️ Important Limitations

1. **Use only in toolchain**: Use this function only in development tools like builder and cli
2. **Prohibited in runtime**: Do not use in application runtime code
3. **Prohibited in core/runtime packages**: Do not use in @soda-gql/core and @soda-gql/runtime

### Why These Limitations Exist

`unwrapNullish` is designed to clarify developer intent and make toolchain code more concise. End-user applications require proper error handling and defensive programming, making such assertion-like functions inappropriate.

## Usage Examples

### Array Access

```typescript
const tokens = input.split(",");
if (tokens.length >= 2) {
  const secondToken = unwrapNullish(tokens[1], "safe-array-item-access");
  // Use secondToken as string
}
```

### Map Lookup

```typescript
const cache = new Map<string, Value>();
// ... add data to cache

if (cache.has(key)) {
  const value = unwrapNullish(cache.get(key), "validated-map-lookup");
  // Use value as Value
}
```

### Control Flow Guarantees

```typescript
let value: string | null = null;

if (condition) {
  value = "initialized";
}

if (condition) {
  // Same condition so value is definitely non-null
  const nonNullValue = unwrapNullish(value, "guaranteed-by-control-flow");
}
```

## Summary

`unwrapNullish` is a tool to compensate for the limitations of the type system and clearly express developer intent. When used appropriately, it can make toolchain code more readable and maintainable. However, use is limited to development tools, and conventional null checking should be performed in end-user code.
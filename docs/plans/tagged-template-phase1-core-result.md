# Core Result Type Design

## Purpose

Provide a self-contained `Result<T, E>` type in `packages/core/src/graphql/result.ts` so that parser utilities can use typed error handling without adding `neverthrow` to `@soda-gql/core`'s `package.json`.

**Parent plan**: [Phase 1 Implementation Plan](./tagged-template-unification-phase1.md)

## Rationale

- `@soda-gql/core` currently has only `graphql` and `@graphql-typed-document-node/core` as dependencies
- Adding `neverthrow` increases the published package's dependency surface
- The CLAUDE.md scope exception states: "Composer layer code uses throw/try-catch instead of neverthrow"
- The new `packages/core/src/graphql/` files are **parser utilities** (not composer layer), so Result types are appropriate
- A minimal self-contained Result type satisfies this need without external dependencies

## API Surface

```typescript
// packages/core/src/graphql/result.ts

/** Discriminated union: ok=true carries value, ok=false carries error */
export type Result<T, E> = OkResult<T> | ErrResult<E>;

export type OkResult<T> = {
  readonly ok: true;
  readonly value: T;
};

export type ErrResult<E> = {
  readonly ok: false;
  readonly error: E;
};

/** Create a successful Result */
export const ok = <T>(value: T): OkResult<T> => ({
  ok: true,
  value,
});

/** Create a failed Result */
export const err = <E>(error: E): ErrResult<E> => ({
  ok: false,
  error,
});
```

## Usage Pattern

```typescript
import { type Result, ok, err } from "./result";

const parseGraphqlSource = (
  source: string,
  sourceFile: string,
): Result<ParseResult, GraphqlAnalysisError> => {
  try {
    const document = parse(source);
    return ok(extractFromDocument(document, sourceFile));
  } catch (error) {
    return err({
      code: "GRAPHQL_PARSE_ERROR",
      message: `GraphQL parse error: ${error}`,
      filePath: sourceFile,
    });
  }
};

// Consumer pattern -- discriminated union narrowing
const result = parseGraphqlSource(source, file);
if (!result.ok) {
  throw new Error(result.error.message);
}
const { document, operations, fragments } = result.value;
```

## neverthrow Compatibility

The self-contained Result uses **boolean discriminant** (`result.ok`) rather than neverthrow's method-based API (`.isOk()`, `._unsafeUnwrap()`). This is simpler and sufficient for Phase 1.

| Feature | neverthrow | Core Result |
|---------|-----------|-------------|
| Type narrowing | `.isOk()` / `.isErr()` methods | `result.ok` boolean discriminant |
| Value access | `._unsafeUnwrap()` | `result.value` (after narrowing) |
| Error access | `.error` (after narrowing) | `result.error` (after narrowing) |
| Combinators | `.map()`, `.andThen()`, `.mapErr()` | Not provided (not needed in Phase 1) |

## Test Specification

```typescript
describe("Result", () => {
  it("ok() creates OkResult with value", () => {
    const result = ok(42);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(42);
  });

  it("err() creates ErrResult with error", () => {
    const result = err("failure");
    expect(result.ok).toBe(false);
    expect(result.error).toBe("failure");
  });

  it("discriminated union narrows correctly", () => {
    const result: Result<number, string> = ok(42);
    if (result.ok) {
      // TypeScript narrows to OkResult<number>
      expect(result.value).toBe(42);
    }
  });
});
```

## Scope Limitation

This Result type intentionally provides **only** the minimal API needed for Phase 1 parser utilities:
- `ok()` / `err()` factory functions
- `.ok` boolean for type narrowing
- `.value` / `.error` for data access

Combinators (`map`, `andThen`, `mapErr`, `fromPromise`) are NOT provided. If richer error handling is needed in Phase 2, the type can be extended without breaking changes.

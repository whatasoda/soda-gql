# Define Element - Value Sharing and Reuse

## Overview

`define` is an element type for registering arbitrary values as gql definitions.
It passes through builder evaluation while being excluded from the final artifact.

## Why define is Needed

In soda-gql, only code written in the `gql.<schema>(() => ...)` format is subject to builder evaluation.
If you try to directly import values defined in external files and use them in another gql definition,
you'll get an evaluation error.

Using `define` allows you to:
- Register arbitrary values as gql definitions
- Access them via `.value` in other gql definitions
- Pass builder evaluation normally

## Use Cases

### 1. Sharing Configuration Values

Reuse common configuration across multiple operations:

```typescript
// shared/config.ts
import { gql } from "@/graphql-system";

export const ApiConfig = gql.default(({ define }) =>
  define(() => ({
    defaultTimeout: 5000,
    retryCount: 3,
  }))
);
```

```typescript
// queries/user.ts
import { gql } from "@/graphql-system";
import { ApiConfig } from "../shared/config";

export const GetUser = gql.default(({ query, $var }) =>
  query.operation({
    name: "GetUser",
    variables: { ...$var("id").ID("!") },
    metadata: () => ({
      custom: { timeout: ApiConfig.value.defaultTimeout },
    }),
    fields: ({ f, $ }) => ({
      ...f.user({ id: $.id })(({ f }) => ({ ...f.id(), ...f.name() })),
    }),
  })
);
```

### 2. Sharing Helper Functions

```typescript
// shared/helpers.ts
import { gql } from "@/graphql-system";

export const QueryHelpers = gql.default(({ define }) =>
  define(() => ({
    formatHeaders: (requestId: string) => ({
      "X-Request-ID": requestId,
      "X-Client-Version": "1.0.0",
    }),
  }))
);
```

### 3. Sharing Constants

```typescript
// shared/constants.ts
import { gql } from "@/graphql-system";

export const Limits = gql.default(({ define }) =>
  define(() => ({
    MAX_ITEMS: 100,
    DEFAULT_PAGE_SIZE: 20,
  }))
);
```

## Constraints and Notes

### define results are only usable within gql definitions

```typescript
// OK: using .value inside a gql definition
export const MyQuery = gql.default(({ query }) => {
  const config = SharedConfig.value;
  return query.operation({ ... });
});

// Note: using .value outside gql definitions executes during builder evaluation
const config = SharedConfig.value; // Executed during builder evaluation
```

### Excluded from artifact

Values defined with `define` are evaluated during builder evaluation,
but are NOT included in the final `BuilderArtifact`. This is intentional behavior.

### attach() is available

Since it extends GqlElement, the `attach()` method is available:

```typescript
export const MyConfig = gql.default(({ define }) =>
  define(() => ({ base: 42 }))
).attach({
  name: "computed",
  createValue: (el) => ({ doubled: el.value.base * 2 }),
});

// Usage
MyConfig.value.base;      // 42
MyConfig.computed.doubled; // 84
```

## Technical Background

### Why gql definition format is required

soda-gql's builder recognizes the `gql.<schema>(() => ...)` pattern through AST analysis
and evaluates it as an intermediate module. Values defined in other formats
are not subject to evaluation and will cause errors when referenced in another gql definition.

### Evaluation Flow

1. AST analysis: Recognizes `gql.default(({ define }) => define(...))`
2. Intermediate module generation: Registers factory via `registry.addElement()`
3. Element evaluation: Executes factory to generate GqlDefine instance
4. Artifact construction: Skips `type === "define"` in buildArtifacts

## Future Plans

Integration with auto-generation from `.gql` files and other advanced use cases
are planned for future versions.

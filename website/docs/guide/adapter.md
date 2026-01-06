# Adapter

Adapters customize the behavior of your GraphQL system by providing helpers, metadata configuration, and document transformation capabilities.

## Defining an Adapter

Use `defineAdapter` to create a typed adapter:

```typescript
import { defineAdapter } from "@soda-gql/core/adapter";

export const adapter = defineAdapter({
  helpers: {
    // Custom helper functions
  },
  metadata: {
    // Metadata configuration
  },
  transformDocument: ({ document }) => {
    // Schema-wide document transformation
    return document;
  },
});
```

## Helpers

Helpers are custom functions injected into the `gql()` callback context. They provide a centralized place for reusable logic.

### Defining Helpers

```typescript
const adapter = defineAdapter({
  helpers: {
    auth: {
      requiresLogin: () => ({ requiresAuth: true }),
      adminOnly: () => ({ requiresAuth: true, role: "admin" }),
    },
    cache: {
      hint: (seconds: number) => ({ cacheHint: seconds }),
    },
  },
});
```

### Using Helpers

Helpers are available in the `gql()` callback:

```typescript
const userFragment = gql(({ fragment, auth, cache }) =>
  fragment.User({
    metadata: () => ({
      ...auth.requiresLogin(),
      ...cache.hint(300),
    }),
    fields: ({ f }) => ({
      ...f.id(),
      ...f.name(),
    }),
  }),
);
```

### Why Helpers?

| Benefit | Description |
|---------|-------------|
| **Centralized Logic** | Define once, use everywhere |
| **Type Safety** | Full TypeScript inference |
| **Testability** | Helper functions can be unit tested |
| **Consistency** | Ensure consistent patterns across operations |

## Document Transform

Document transformation allows you to modify the GraphQL AST at build time. Common use cases include adding directives, modifying field selections, or injecting metadata.

### Two Levels of Transform

| Level | Receives | When to Use |
|-------|----------|-------------|
| **Adapter** | `schemaLevel`, `fragmentMetadata` | Schema-wide transforms (e.g., add auth directive to all queries) |
| **Operation** | Typed `metadata` | Per-operation transforms based on operation metadata |

### Transform Order

```
Operation Transform → Adapter Transform
```

Operation-level transforms run first, then adapter-level transforms are applied to the result.

### Adapter-level Transform

Runs for all operations. Access schema-level configuration and aggregated fragment metadata:

```typescript
import { Kind, visit } from "graphql";

const adapter = defineAdapter({
  metadata: {
    aggregateFragmentMetadata: (fragments) => ({
      maxCacheHint: Math.max(0, ...fragments.map((f) => f.metadata?.cacheHint ?? 0)),
    }),
    schemaLevel: { defaultCacheHint: 60 },
  },
  transformDocument: ({ document, operationType, schemaLevel, fragmentMetadata }) => {
    // Add @cached directive to all queries
    if (operationType === "query") {
      const cacheHint = fragmentMetadata?.maxCacheHint || schemaLevel?.defaultCacheHint || 0;
      return visit(document, {
        OperationDefinition: (node) => ({
          ...node,
          directives: [
            ...(node.directives ?? []),
            {
              kind: Kind.DIRECTIVE,
              name: { kind: Kind.NAME, value: "cached" },
              arguments: [
                {
                  kind: Kind.ARGUMENT,
                  name: { kind: Kind.NAME, value: "ttl" },
                  value: { kind: Kind.INT, value: String(cacheHint) },
                },
              ],
            },
          ],
        }),
      });
    }
    return document;
  },
});
```

### Operation-level Transform

Runs per-operation with access to typed operation metadata:

```typescript
const operation = gql(({ query, $var }) =>
  query.operation({
    name: "GetUser",
    variables: { ...$var("id").ID("!") },
    metadata: () => ({ addTracing: true, operationId: "get-user" }),
    transformDocument: ({ document, metadata }) => {
      // metadata is typed as { addTracing: boolean; operationId: string }
      if (metadata?.addTracing) {
        return visit(document, {
          OperationDefinition: (node) => ({
            ...node,
            directives: [
              ...(node.directives ?? []),
              {
                kind: Kind.DIRECTIVE,
                name: { kind: Kind.NAME, value: "trace" },
                arguments: [
                  {
                    kind: Kind.ARGUMENT,
                    name: { kind: Kind.NAME, value: "id" },
                    value: { kind: Kind.STRING, value: metadata.operationId },
                  },
                ],
              },
            ],
          }),
        });
      }
      return document;
    },
    fields: ({ f, $ }) => ({
      ...f.user({ id: $.id })(({ f }) => ({
        ...f.id(),
        ...f.name(),
      })),
    }),
  }),
);
```

### Best Practice: Use Helpers for Transform Functions

Even for operation-level transforms, define the transform logic in helpers to keep operations clean and reusable:

```typescript
// Define transform helpers in adapter
const adapter = defineAdapter({
  helpers: {
    transform: {
      addTracing: (operationId: string) =>
        ({ document }: { document: DocumentNode }) => {
          return visit(document, {
            OperationDefinition: (node) => ({
              ...node,
              directives: [
                ...(node.directives ?? []),
                {
                  kind: Kind.DIRECTIVE,
                  name: { kind: Kind.NAME, value: "trace" },
                  arguments: [
                    {
                      kind: Kind.ARGUMENT,
                      name: { kind: Kind.NAME, value: "id" },
                      value: { kind: Kind.STRING, value: operationId },
                    },
                  ],
                },
              ],
            }),
          });
        },
    },
  },
});

// Use helper in operation - clean and declarative
const operation = gql(({ query, $var, transform }) =>
  query.operation({
    name: "GetUser",
    variables: { ...$var("id").ID("!") },
    transformDocument: transform.addTracing("get-user"),
    fields: ({ f, $ }) => ({
      ...f.user({ id: $.id })(({ f }) => ({
        ...f.id(),
        ...f.name(),
      })),
    }),
  }),
);
```

This approach:
- Keeps operation definitions focused on **what** they do
- Centralizes transform logic for reuse and testing
- Makes transforms declarative and self-documenting

## Schema-level Configuration

Schema-level values are fixed configuration available to all operation metadata builders:

```typescript
const adapter = defineAdapter({
  metadata: {
    aggregateFragmentMetadata: (fragments) => fragments,
    schemaLevel: {
      apiVersion: "v2",
      environment: "production",
      defaultTimeout: 30000,
    },
  },
});
```

Access in metadata builders:

```typescript
const operation = gql(({ query }) =>
  query.operation({
    name: "GetUser",
    metadata: ({ schemaLevel }) => ({
      headers: {
        "X-API-Version": schemaLevel?.apiVersion ?? "v1",
      },
    }),
    fields: ({ f }) => ({ ... }),
  }),
);
```

## Fragment Metadata Aggregation

When operations spread fragments, their metadata is aggregated using `aggregateFragmentMetadata`:

```typescript
import type { FragmentMetaInfo } from "@soda-gql/core";

const adapter = defineAdapter({
  metadata: {
    aggregateFragmentMetadata: (fragments: readonly FragmentMetaInfo<{ cacheHint?: number }>[]) => ({
      // Aggregate cache hints from all spread fragments
      maxCacheHint: Math.max(0, ...fragments.map((f) => f.metadata?.cacheHint ?? 0)),
      fragmentCount: fragments.length,
      paths: fragments.map((f) => f.fieldPath),
    }),
  },
});
```

The aggregated metadata is available in:
- Operation metadata builders via `fragmentMetadata` parameter
- Adapter-level `transformDocument` via `fragmentMetadata` argument

## Complete Example

```typescript
import { defineAdapter } from "@soda-gql/core/adapter";
import type { FragmentMetaInfo } from "@soda-gql/core";
import { Kind, visit, type DocumentNode } from "graphql";

type FragmentMeta = { cacheHint?: number; requiresAuth?: boolean };
type AggregatedMeta = { maxCacheHint: number; requiresAuth: boolean };
type SchemaLevel = { defaultCacheHint: number; apiVersion: string };

export const adapter = defineAdapter({
  helpers: {
    auth: {
      requiresLogin: (): FragmentMeta => ({ requiresAuth: true }),
    },
    cache: {
      hint: (seconds: number): FragmentMeta => ({ cacheHint: seconds }),
    },
    transform: {
      addCacheControl: (ttl: number) =>
        ({ document }: { document: DocumentNode }) =>
          visit(document, {
            OperationDefinition: (node) => ({
              ...node,
              directives: [
                ...(node.directives ?? []),
                {
                  kind: Kind.DIRECTIVE,
                  name: { kind: Kind.NAME, value: "cacheControl" },
                  arguments: [
                    {
                      kind: Kind.ARGUMENT,
                      name: { kind: Kind.NAME, value: "maxAge" },
                      value: { kind: Kind.INT, value: String(ttl) },
                    },
                  ],
                },
              ],
            }),
          }),
    },
  },
  metadata: {
    aggregateFragmentMetadata: (fragments: readonly FragmentMetaInfo<FragmentMeta>[]): AggregatedMeta => ({
      maxCacheHint: Math.max(0, ...fragments.map((f) => f.metadata?.cacheHint ?? 0)),
      requiresAuth: fragments.some((f) => f.metadata?.requiresAuth),
    }),
    schemaLevel: {
      defaultCacheHint: 60,
      apiVersion: "v2",
    } satisfies SchemaLevel,
  },
  transformDocument: ({ document, operationType, fragmentMetadata, schemaLevel }) => {
    // Add @auth directive when any fragment requires auth
    if (fragmentMetadata?.requiresAuth) {
      return visit(document, {
        OperationDefinition: (node) => ({
          ...node,
          directives: [
            ...(node.directives ?? []),
            { kind: Kind.DIRECTIVE, name: { kind: Kind.NAME, value: "auth" } },
          ],
        }),
      });
    }
    return document;
  },
});
```

## See Also

- [Metadata Guide](/guide/metadata) - Operation metadata patterns
- [API Reference](/api/packages/core) - Complete type documentation

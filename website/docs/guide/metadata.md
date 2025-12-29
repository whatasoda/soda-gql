# Metadata

Metadata allows you to attach runtime information to operations. This is useful for HTTP headers and application-specific configuration.

## How soda-gql Metadata Differs from GraphQL

Standard GraphQL has limited support for request-level metadata:

| Aspect | GraphQL | soda-gql |
|--------|---------|----------|
| **Request Headers** | Handled outside the query | Declared with the operation |
| **Custom Data** | Not standardized | First-class `custom` property |
| **Type Safety** | None | Full TypeScript inference |

## Metadata Structure

All metadata has two base properties:

| Property | Type | Purpose |
|----------|------|---------|
| `headers` | `Record<string, string>` | HTTP headers to include with the request |
| `custom` | `Record<string, unknown>` | Application-specific values |

## Defining Metadata

Add metadata to an operation using the `metadata` option:

```typescript
export const getUserQuery = gql.default(({ query }, { $var }) =>
  query.operation(
    {
      name: "GetUser",
      variables: [$var("id").scalar("ID:!")],
      metadata: ({ $, document }) => ({
        headers: {
          "X-Request-ID": "get-user-query",
        },
        custom: {
          requiresAuth: true,
          cacheTtl: 300,
        },
      }),
    },
    ({ f, $ }) => [
      //
      f.user({ id: $.id })(({ f }) => [
        //
        f.id(),
        f.name(),
      ]),
    ],
  ),
);
```

### Metadata Callback Parameters

The metadata callback receives:

| Parameter | Description |
|-----------|-------------|
| `$` | Variable references (same as in field selections) |
| `document` | The compiled GraphQL document string |
| `$var` | Helper for accessing variable inner values |

### Dynamic Metadata

Use variables to create dynamic metadata:

```typescript
metadata: ({ $, $var }) => ({
  headers: {
    "X-Trace-ID": `user-${$var.getInner($.id)}`,
  },
  custom: {
    trackedVariables: [$var.getInner($.id)],
  },
}),
```

## Use Cases

### Authentication Headers

Attach authorization headers that your GraphQL client can use:

```typescript
metadata: () => ({
  headers: {
    "Authorization": "Bearer ${token}",
  },
  custom: {
    requiresAuth: true,
    authScopes: ["user:read"],
  },
}),
```

### Request Tracing

Add trace information for debugging:

```typescript
metadata: ({ document }) => ({
  headers: {
    "X-Operation-Name": "GetUser",
    "X-Document-Hash": hashDocument(document),
  },
  custom: {
    tracing: true,
  },
}),
```

### Cache Control

Define caching behavior for your application:

```typescript
metadata: () => ({
  headers: {},
  custom: {
    cache: {
      ttl: 3600,
      staleWhileRevalidate: true,
      tags: ["user", "profile"],
    },
  },
}),
```

### Feature Flags

Control operation behavior based on features:

```typescript
metadata: () => ({
  headers: {},
  custom: {
    features: {
      enableNewUserFields: true,
      useOptimizedResolver: false,
    },
  },
}),
```

## Accessing Metadata

After defining metadata, access it through the operation:

```typescript
// Get metadata for a specific variable set
const meta = getUserQuery.metadata({ id: "123" });

console.log(meta.headers);    // { "X-Request-ID": "get-user-query" }
console.log(meta.custom);     // { requiresAuth: true, cacheTtl: 300 }
```

### Integrating with GraphQL Clients

Use metadata in your GraphQL client implementation:

```typescript
async function graphqlClient<T>(operation: {
  document: string;
  variables: Record<string, unknown>;
  metadata?: (vars: Record<string, unknown>) => Metadata;
}) {
  const meta = operation.metadata?.(operation.variables) ?? {};

  const response = await fetch("/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...meta.headers,
    },
    body: JSON.stringify({
      query: operation.document,
      variables: operation.variables,
    }),
  });

  return response.json();
}
```

## Type Inference

Metadata types are inferred from your definition:

```typescript
type QueryMeta = typeof getUserQuery.$infer.metadata;
// {
//   headers: { "X-Request-ID": string };
//   custom: { requiresAuth: boolean; cacheTtl: number };
// }
```

## Next Steps

- Explore [Fragment Colocation](/guide/colocation) for component-based patterns
- See the [API Reference](/api/packages/core) for complete type documentation

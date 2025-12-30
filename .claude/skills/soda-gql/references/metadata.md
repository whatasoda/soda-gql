# Metadata Guide

Attach runtime information to operations for HTTP headers and application-specific values.

## Overview

Metadata allows attaching runtime information to GraphQL operations:
- HTTP headers for requests
- Application-specific values (auth requirements, cache settings)
- Custom data for client-side handling

## Basic Usage

### Defining Metadata on Operations

```typescript
export const getUserQuery = gql.default(({ query, $var }) =>
  query.operation({
    name: "GetUser",
    variables: { ...$var("userId").ID("!") },
    metadata: ({ $ }) => ({
      headers: {
        "X-Request-ID": "user-query",
        "X-Operation-Name": "GetUser",
      },
      custom: {
        requiresAuth: true,
        cacheTtl: 300,
        retryCount: 3,
      },
    }),
    fields: ({ f, $ }) => ({
      ...f.user({ id: $.userId })(({ f }) => ({
        ...f.id(),
        ...f.name(),
      })),
    }),
  }),
);
```

## Metadata Structure

### Base Properties

All metadata includes these properties:

| Property | Type | Description |
|----------|------|-------------|
| `headers` | `Record<string, string>` | HTTP headers for the GraphQL request |
| `custom` | `Record<string, unknown>` | Application-specific values |

### Headers

Use `headers` for HTTP request configuration:

```typescript
metadata: ({ $ }) => ({
  headers: {
    "Authorization": "Bearer token",
    "X-Request-ID": "unique-id",
    "X-Trace-ID": "trace-123",
    "Cache-Control": "no-cache",
  },
  custom: {},
}),
```

### Custom Data

Use `custom` for application-specific metadata:

```typescript
metadata: ({ $ }) => ({
  headers: {},
  custom: {
    // Authentication
    requiresAuth: true,
    requiredRoles: ["admin", "editor"],

    // Caching
    cacheTtl: 300,
    cacheKey: "user-data",

    // Error handling
    retryCount: 3,
    retryDelay: 1000,

    // Analytics
    trackingId: "user-query-v1",
    priority: "high",

    // Feature flags
    experimentId: "new-user-flow",
  },
}),
```

## Metadata Callback Context

The metadata callback receives context for dynamic values:

```typescript
metadata: ({ $, document }) => ({
  headers: {
    "X-Document-Hash": document.hash,
  },
  custom: {
    variables: Object.keys($),
  },
}),
```

### Context Properties

| Property | Description |
|----------|-------------|
| `$` | Variable references |
| `document` | Document information |

## Variable Integration

### Accessing Variable Information

```typescript
metadata: ({ $, $var }) => ({
  headers: {},
  custom: {
    // Get inner variable reference
    trackedVariables: [$var.getInner($.userId)],
  },
}),
```

### Dynamic Headers Based on Variables

```typescript
const getUserQuery = gql.default(({ query, $var }) =>
  query.operation({
    name: "GetUser",
    variables: {
      ...$var("userId").ID("!"),
      ...$var("authToken").String("?"),
    },
    metadata: ({ $ }) => ({
      headers: {
        "X-User-Context": "user-query",
      },
      custom: {
        hasAuth: true, // Will be determined at runtime
      },
    }),
    fields: ({ f, $ }) => ({
      ...f.user({ id: $.userId })(({ f }) => ({ ...f.id() })),
    }),
  }),
);
```

## Using Metadata at Runtime

### Accessing Metadata

```typescript
// Access metadata from operation
const metadata = getUserQuery.metadata;

// Use in fetch
async function executeQuery(operation, variables) {
  const response = await fetch("/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...operation.metadata?.headers,
    },
    body: JSON.stringify({
      query: operation.document,
      variables,
    }),
  });
  return response.json();
}
```

### Custom Client Integration

```typescript
class GraphQLClient {
  async execute<T>(operation: { document: string; metadata?: Metadata }, variables: any): Promise<T> {
    const { headers = {}, custom = {} } = operation.metadata || {};

    // Apply authentication
    if (custom.requiresAuth) {
      headers["Authorization"] = `Bearer ${this.getToken()}`;
    }

    // Apply caching
    if (custom.cacheTtl) {
      const cached = this.cache.get(operation.document, variables);
      if (cached) return cached;
    }

    // Execute request
    const result = await this.fetch(operation.document, variables, headers);

    // Cache result
    if (custom.cacheTtl) {
      this.cache.set(operation.document, variables, result, custom.cacheTtl);
    }

    return result;
  }
}
```

## Adapter Configuration

For aggregating metadata from spread fragments, configure an adapter:

### Defining an Adapter

```typescript
// adapter.ts
import { defineAdapter } from "@soda-gql/core";

export const adapter = defineAdapter({
  // Aggregate metadata from fragments
  aggregateFragmentMetadata: (fragmentMetadata, operationMetadata) => ({
    headers: {
      ...fragmentMetadata.headers,
      ...operationMetadata.headers,
    },
    custom: {
      ...fragmentMetadata.custom,
      ...operationMetadata.custom,
      // Merge arrays
      requiredRoles: [
        ...(fragmentMetadata.custom?.requiredRoles || []),
        ...(operationMetadata.custom?.requiredRoles || []),
      ],
    },
  }),

  // Helper functions available in metadata callbacks
  helpers: {
    generateRequestId: () => crypto.randomUUID(),
  },

  // Static metadata
  metadata: {
    version: "1.0.0",
    environment: process.env.NODE_ENV,
  },
});
```

### Configuration

```typescript
// soda-gql.config.ts
export default defineConfig({
  schemas: {
    default: {
      schema: "./schema.graphql",
      inject: {
        scalars: "./src/graphql-system/default.inject.ts",
        adapter: "./src/graphql-system/adapter.ts",
      },
    },
  },
});
```

## Common Patterns

### Authentication Metadata

```typescript
metadata: () => ({
  headers: {},
  custom: {
    requiresAuth: true,
    requiredRoles: ["user"],
    authStrategy: "bearer",
  },
}),
```

### Caching Metadata

```typescript
metadata: () => ({
  headers: {
    "Cache-Control": "max-age=300",
  },
  custom: {
    cacheTtl: 300,
    cacheKey: "user-list",
    staleWhileRevalidate: true,
  },
}),
```

### Analytics Metadata

```typescript
metadata: () => ({
  headers: {
    "X-Trace-ID": crypto.randomUUID(),
  },
  custom: {
    trackingEnabled: true,
    analyticsCategory: "user-operations",
    priority: "high",
  },
}),
```

### Error Handling Metadata

```typescript
metadata: () => ({
  headers: {},
  custom: {
    retryCount: 3,
    retryDelay: 1000,
    retryBackoff: "exponential",
    fallbackBehavior: "cache",
  },
}),
```

## Type Safety

Metadata types are inferred from your definitions:

```typescript
const query = gql.default(/* ... */);

// Access typed metadata
const metadata = query.metadata;
// Type: { headers: Record<string, string>; custom: { requiresAuth: boolean; ... } }
```

Create utility types for consistent metadata:

```typescript
// types.ts
interface AuthMetadata {
  requiresAuth: boolean;
  requiredRoles?: string[];
}

interface CacheMetadata {
  cacheTtl?: number;
  cacheKey?: string;
}

interface OperationMetadata extends AuthMetadata, CacheMetadata {
  retryCount?: number;
}
```

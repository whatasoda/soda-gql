# @soda-gql/core

Core runtime library for soda-gql zero-runtime GraphQL generation.

## Type System

This package provides the core type definitions for the soda-gql system:

### Key Types

- **RemoteModel**: Reusable GraphQL fragments with transformation functions
- **QuerySlice**: Domain-specific query definitions  
- **MutationSlice**: Domain-specific mutation definitions
- **PageQuery**: Complete GraphQL operations composed from slices
- **FieldSelection**: Type-safe field selection with relation support

### Design Decisions

#### Relations vs Objects (ADR-001)

GraphQL relations are explicitly marked using the `__relation__` property:

```typescript
type User = {
  id: string;
  profile: { bio: string };        // Regular object - boolean selection only
  __relation__: {
    posts: Post[];                 // Relation - supports nested selection
    company: Company;              // Relation - supports nested selection
  };
};
```

This provides precise control over what constitutes a relation versus an embedded object.
See [ADR-001](../../docs/decisions/001-relation-field-selection.md) for details.

#### Type Brand Safety (ADR-002)

Type brand properties use functions to ensure runtime safety:

```typescript
interface QuerySlice<TData, TArgs> {
  readonly _data: () => TData;     // Function returns type
  readonly _args: () => TArgs;     // Safe to access at runtime
}
```

See [ADR-002](../../docs/decisions/002-type-brand-safety.md) for details.

## Usage

```typescript
import { createGql } from '@soda-gql/core';
import type { RemoteModel, QuerySlice } from '@soda-gql/core';

// Create a typed gql instance
const gql = createGql<MySchema>();

// Define reusable models
const userModel = gql.model<User>({
  typeName: 'User',
  fields: {
    id: true,
    name: true,
    posts: {
      id: true,
      title: true,
    },
  },
  transform: (data) => ({
    ...data,
    displayName: data.name.toUpperCase(),
  }),
});

// Create query slices
const userQuery = gql.query({
  name: 'getUser',
  selections: (query, args: { id: string }) => ({
    user: query.select('user', {
      ...userModel.fields,
      where: { id: args.id },
    }),
  }),
});
```

## Installation

```bash
bun add @soda-gql/core
```

## Development

```bash
# Run tests
bun test

# Type check
bun run typecheck

# Run quality checks
bun run quality
```
# @soda-gql/colocation-tools

Utilities for colocating GraphQL fragments with components in soda-gql. This package provides tools for fragment composition and data masking patterns.

## Features

- **Fragment colocation** - Keep GraphQL fragments close to components that use them
- **Data projection** - Create typed projections from fragment data
- **Type safety** - Full TypeScript support for fragment composition

## Installation

```bash
npm install @soda-gql/colocation-tools
# or
bun add @soda-gql/colocation-tools
```

## Usage

### Fragment Colocation Pattern

```typescript
import { createProjection } from "@soda-gql/colocation-tools";
import { userFragment } from "./graphql-system";

// Create a projection for component props
const useUserData = createProjection(userFragment);

// In your component
function UserCard({ data }: { data: typeof userFragment.$infer }) {
  const user = useUserData(data);
  return <div>{user.name}</div>;
}
```

### Embedding Fragments

Fragments can be embedded in operations:

```typescript
import { gql } from "./graphql-system";
import { userFragment } from "./UserCard";

export const getUserQuery = gql.default(({ query }) =>
  query.operation({ name: "GetUser" }, ({ f }) => [
    f.user({ id: "1" })(userFragment.embed()),
  ]),
);
```

## API

### createProjection

Creates a typed projection function from a fragment definition.

```typescript
import { createProjection } from "@soda-gql/colocation-tools";

const projection = createProjection(fragment);
const data = projection(rawData);
```

## Related Packages

- [@soda-gql/core](../core) - Core types and fragment definitions
- [@soda-gql/runtime](../runtime) - Runtime operation handling

## License

MIT

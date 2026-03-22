# Topic: Metadata

## Concept

soda-gql allows attaching metadata to fragments and operations for build-time processing (e.g., component mapping, documentation generation, cache key computation). Metadata is passed as an argument to the tagged template call — this works in both tagged template and callback builder syntax.

### Metadata APIs

**Static metadata** — pass a plain object after the template call:

```typescript
const frag = gql.default(({ fragment }) =>
  fragment("UserFields", "User")`{
    id
    name
  }`({
    metadata: { component: "UserCard" },
  }),
);
```

**Callback metadata** — receives variables for dynamic values:

```typescript
const frag = gql.default(({ fragment }) =>
  fragment("CachedUser", "User")`($userId: ID!) {
    id
    name
  }`({
    metadata: ({ $ }: { $: { userId: string } }) => ({
      cacheKey: `user:${$.userId}`,
    }),
  }),
);
```

Both forms work in tagged template syntax — no need for the callback builder.

## Code Examples

**Static fragment metadata (tagged template — primary pattern):**
```typescript
const userFragment = gql.default(({ fragment }) =>
  fragment("UserCard", "User")`{
    id
    name
    email
  }`({
    metadata: { component: "UserCard", description: "User profile data" },
  }),
);
```

**Callback metadata with variables (tagged template — primary pattern):**
```typescript
const userFragment = gql.default(({ fragment }) =>
  fragment("CachedUser", "User")`($userId: ID!) {
    id
    name
    email
  }`({
    metadata: ({ $ }: { $: { userId: string } }) => ({
      cacheKey: `user:${$.userId}`,
    }),
  }),
);
```

**Operation metadata (callback builder — fragmentMetadata access):**
```typescript
const q = gql.default(({ query }) =>
  query("GetUser")({
    variables: `($id: ID!)`,
    metadata: ({ $, fragmentMetadata }) => ({
      entityId: $.id,
      fragmentCount: fragmentMetadata?.length ?? 0,
    }),
    fields: ({ f, $ }) => ({
      ...f("user", { id: $.id })(({ f }) => ({
        ...userFragment.spread(),
      })),
    }),
  })({}),
);
```

## Common Patterns

✅ **Component mapping via static metadata (tagged template):**
```typescript
gql.default(({ fragment }) =>
  fragment("UserProfile", "User")`{ id name }`({
    metadata: { component: "UserProfile" },
  }),
);
```

✅ **Dynamic cache key via callback metadata (tagged template):**
```typescript
gql.default(({ fragment }) =>
  fragment("CachedUser", "User")`($id: ID!) { id name }`({
    metadata: ({ $ }: { $: { id: string } }) => ({
      cacheKey: `user:${$.id}`,
    }),
  }),
);
```

✅ **Multiple metadata fields:**
```typescript
gql.default(({ fragment }) =>
  fragment("RichUser", "User")`{ id name email }`({
    metadata: {
      component: "UserCard",
      version: 2,
      deprecated: false,
    },
  }),
);
```

❌ **Expecting metadata to merge across fragments automatically:**
```typescript
// Metadata is per-fragment — there is no automatic merging across fragment spreads
const child = gql.default(({ fragment }) =>
  fragment("Child", "User")`{ id }`({ metadata: { source: "child" } }),
);
const parent = gql.default(({ fragment }) =>
  fragment("Parent", "User")`{ ...${child} name }`({
    metadata: { source: "parent" }, // child metadata is not merged here
  }),
);
```

## Related Topics

- **fragment** — Metadata on fragment definitions
- **operation** — Operation-level metadata with fragmentMetadata access
- **colocation** — $colocate with metadata for component association
- **tagged-template** — Syntax for attaching metadata to tagged template calls

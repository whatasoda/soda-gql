# Topic: Colocation

## Concept

Fragment colocation places fragment definitions near the components that use them, improving code organization and enabling build-time optimizations. The `$colocate` option in the callback builder spread tells the build system to associate a fragment with its component file.

### Why Colocation

- Dead code elimination: unused fragments are removed
- Component–fragment association tracking
- Clear ownership: each fragment belongs to one component

## Code Examples

**Component-colocated fragment (tagged template):**
```typescript
// UserCard.tsx
export const userCardFragment = gql.default(({ fragment }) =>
  fragment("UserCardFields", "User")`{
    id
    name
    email
    avatarUrl
  }`(),
);

export function UserCard({ user }) {
  // Component uses fragment data
}
```

**Operation using $colocate (callback builder spread — required for $colocate):**
```typescript
const userQuery = gql.default(({ query }) =>
  query("GetUser")({
    variables: `($id: ID!)`,
    fields: ({ f, $ }) => ({
      ...f("user", { id: $.id })(({ f }) => ({
        ...f("id")(),
        ...userCardFragment.spread({ $colocate: true }),
      })),
    }),
  })({}),
);
```

**Multiple colocated fragments:**
```typescript
const parentQuery = gql.default(({ query }) =>
  query("GetUserPage")({
    variables: `($id: ID!)`,
    fields: ({ f, $ }) => ({
      ...f("user", { id: $.id })(({ f }) => ({
        ...profileFragment.spread({ $colocate: true }),
        ...settingsFragment.spread({ $colocate: true }),
      })),
    }),
  })({}),
);
```

**Fragment with metadata for component association:**
```typescript
// UserProfile.tsx
export const userProfileFragment = gql.default(({ fragment }) =>
  fragment("UserProfile", "User")`{
    id
    name
    email
    bio
  }`({
    metadata: { component: "UserProfile" },
  }),
);
```

## Common Patterns

✅ **Fragment defined next to the component that uses it:**
```typescript
// UserProfile.tsx
export const userProfileFragment = gql.default(({ fragment }) =>
  fragment("UserProfile", "User")`{
    id
    name
    email
    bio
  }`(),
);

export function UserProfile({ data }) {
  // Use fragment data
}
```

✅ **Parent operation composes colocated fragments:**
```typescript
const parentQuery = gql.default(({ query }) =>
  query("GetUserPage")({
    variables: `($id: ID!)`,
    fields: ({ f, $ }) => ({
      ...f("user", { id: $.id })(({ f }) => ({
        ...profileFragment.spread({ $colocate: true }),
        ...settingsFragment.spread({ $colocate: true }),
      })),
    }),
  })({}),
);
```

✅ **Export fragment from component file:**
```typescript
// Named export so parent can import and spread it
export const userCardFragment = gql.default(/* ... */);
```

❌ **Defining all fragments in a single file away from components:**
```typescript
// graphql/fragments.ts — anti-pattern for large apps
// All fragments in one place → harder to track ownership, no dead code elimination
export const userCardFragment = ...
export const postCardFragment = ...
export const commentFragment = ...
```

## Related Topics

- **fragment** — Fragment spreading and composition
- **metadata** — Component metadata alongside $colocate
- **operation** — How operations compose colocated fragments

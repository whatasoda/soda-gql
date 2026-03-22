# Topic: Operation

## Concept

Operations define the GraphQL query/mutation/subscription structure with variables, arguments, and field selections. **Tagged template syntax is the default** for all operations, including those that spread fragments.

### Operation Types

1. **Tagged template operation** — Default for all operations: simple fields, fragment spreads, aliases, directives
2. **Callback builder operation** — For `$colocate` and programmatic field control only

### Variable Handling

**Operations declare the contract:**
- All variables must be declared at operation level
- Fragment variables are NOT auto-merged
- In tagged templates, use `($name: Type!)` syntax at the start of the selection set
- In callback builder, use `variables: \`($name: Type!)\`` to declare variables

## Code Examples

**Simple query (tagged template):**
```typescript
const getUsers = gql.default(({ query }) =>
  query("GetUsers")`{
    users {
      id
      name
    }
  }`(),
);
```

**Query with variables (tagged template):**
```typescript
const getUser = gql.default(({ query }) =>
  query("GetUser")`($id: ID!) {
    user(id: $id) {
      id
      name
      email
    }
  }`(),
);
```

**Query with fragment spread (tagged template — primary pattern):**
```typescript
const getUserWithFragment = gql.default(({ query }) =>
  query("GetUserWithFragment")`($id: ID!) {
    user(id: $id) {
      ...${userFields}
    }
  }`(),
);
```

**Query with variable-bound spread (callback interpolation in tagged template):**
```typescript
const getUserConditional = gql.default(({ query }) =>
  query("GetUserConditional")`($id: ID!, $includeEmail: Boolean!) {
    user(id: $id) {
      ...${({ $ }) => conditionalFrag.spread({ includeEmail: $.includeEmail })}
    }
  }`(),
);
```

**Mutation (tagged template):**
```typescript
const createUser = gql.default(({ mutation }) =>
  mutation("CreateUser")`($input: CreateUserInput!) {
    createUser(input: $input) {
      id
      name
    }
  }`(),
);
```

**Subscription (tagged template):**
```typescript
const onUserUpdated = gql.default(({ subscription }) =>
  subscription("OnUserUpdated")`($id: ID!) {
    userUpdated(id: $id) {
      id
      name
    }
  }`(),
);
```

**Callback builder — only when $colocate is needed:**
```typescript
const getUserPage = gql.default(({ query }) =>
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

## Common Patterns

✅ **Simple query with inline fields (tagged template):**
```typescript
const getUserQuery = gql.default(({ query }) =>
  query("GetUser")`($id: ID!) {
    user(id: $id) {
      id
      name
      posts {
        id
        title
      }
    }
  }`(),
);
```

✅ **Operation with fragment spread (tagged template):**
```typescript
const getUserQuery = gql.default(({ query }) =>
  query("GetUser")`($id: ID!) {
    user(id: $id) {
      ...${userFields}
    }
  }`(),
);
```

✅ **Operation with multiple variables (tagged template):**
```typescript
const getUserPosts = gql.default(({ query }) =>
  query("GetUserPosts")`($id: ID!, $limit: Int, $offset: Int) {
    user(id: $id) {
      posts(limit: $limit, offset: $offset) {
        id
        title
      }
    }
  }`(),
);
```

❌ **Expecting fragment variable auto-merge (WRONG):**
```typescript
// Fragment declares $includeEmail — but operation must also declare it
const badQuery = gql.default(({ query }) =>
  query("GetUser")`($id: ID!) {
    user(id: $id) {
      ...${conditionalFrag}
    }
  }`(),
  // If conditionalFrag uses $includeEmail, the operation must also declare it
);
```

## Related Topics

- **tagged-template** — Syntax overview and interpolation rules
- **fragment** — Fragment definitions used in operations
- **directive** — Adding directives to operations
- **colocation** — The one case where callback builder is needed ($colocate)

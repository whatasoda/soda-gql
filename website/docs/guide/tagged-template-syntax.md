# Tagged Template Syntax Guide

This guide covers the two API syntaxes for defining GraphQL operations and fragments in soda-gql: **tagged templates** (primary, recommended) and **callback builders** (advanced use cases).

## Introduction

soda-gql provides two syntax styles for defining GraphQL elements:

1. **Tagged templates** — Write GraphQL directly as template literals. Concise, readable, and familiar to developers who know GraphQL syntax.
2. **Callback builders** — Programmatic field selection using TypeScript functions. Required for advanced features like `$colocate` and programmatic field control.

Both syntaxes produce identical runtime artifacts and can be mixed freely within a project.

## Quick Start

```typescript
import { gql } from "@/graphql-system";

// Tagged template — recommended for most use cases
export const GetUser = gql.default(({ query }) =>
  query("GetUser")`($id: ID!) {
    user(id: $id) {
      id
      name
      email
    }
  }`()
);

// Fragment definition
export const UserFields = gql.default(({ fragment }) =>
  fragment("UserFields", "User")`{
    id
    name
    email
  }`()
);
```

The pattern is: `gql.<schemaName>(({ query | mutation | subscription | fragment }) => ...)`.

## Fragment Syntax

### Basic Fragment

```typescript
export const UserFields = gql.default(({ fragment }) =>
  fragment("UserFields", "User")`{
    id
    name
    email
  }`()
);
```

- First argument: fragment name (`"UserFields"`)
- Second argument: type name (`"User"`)
- Template content: field selections wrapped in `{ }`
- Trailing `()` finalizes the fragment (no metadata)

### Fragment with Variables

Fragments can declare variables using the standard GraphQL `$variable` syntax:

```typescript
export const UserPosts = gql.default(({ fragment }) =>
  fragment("UserPosts", "User")`($categoryId: ID) {
    id
    name
    posts(categoryId: $categoryId) {
      id
      title
    }
  }`()
);
```

### Fragment with Metadata

Pass a metadata object or callback as the trailing call argument:

```typescript
export const UserFields = gql.default(({ fragment }) =>
  fragment("UserFields", "User")`{ id name }`({
    metadata: { source: "user-fragment" },
  })
);
```

## Operation Syntax

### Query

```typescript
export const GetUser = gql.default(({ query }) =>
  query("GetUser")`($id: ID!) {
    user(id: $id) {
      id
      name
    }
  }`()
);
```

### Mutation

```typescript
export const CreateUser = gql.default(({ mutation }) =>
  mutation("CreateUser")`($input: CreateUserInput!) {
    createUser(input: $input) {
      id
    }
  }`()
);
```

### Subscription

```typescript
export const OnUserCreated = gql.default(({ subscription }) =>
  subscription("OnUserCreated")`{
    userCreated {
      id
      name
    }
  }`()
);
```

### Operation with Metadata

```typescript
export const GetUser = gql.default(({ query }) =>
  query("GetUser")`{ user(id: "1") { id } }`({
    metadata: { headers: { "X-Test": "value" } },
  })
);
```

## Fragment Spreads

### In Tagged Templates (Interpolation)

Fragment spreads use `${...}` interpolation within tagged templates:

```typescript
const userFields = gql.default(({ fragment }) =>
  fragment("UserFields", "User")`{ id name }`()
);

const GetUser = gql.default(({ query }) =>
  query("GetUser")`{
    user(id: "1") {
      ...${userFields}
    }
  }`()
);
```

### Union Member Selections

Use inline fragments for union types:

```typescript
const Search = gql.default(({ query }) =>
  query("Search")`{
    search {
      ... on Article { id title }
      ... on Video { id duration }
    }
  }`()
);
```

Fragment spreads also work inside union selections:

```typescript
const articleFields = gql.default(({ fragment }) =>
  fragment("ArticleFields", "Article")`{ id title }`()
);

const Search = gql.default(({ query }) =>
  query("Search")`{
    search {
      ... on Article { ...${articleFields} }
      ... on Video { id duration }
    }
  }`()
);
```

### In Options-Object Path (`.spread()`)

For operations that use the options-object path, use `.spread()`:

```typescript
const GetUser = gql.default(({ query }) =>
  query("GetUser")({
    fields: ({ f }) => ({
      ...f("user", { id: "1" })(() => ({
        ...userFields.spread(),
      })),
    }),
  })({}),
);
```

## Metadata

Both syntaxes support metadata — arbitrary data attached to operations and fragments.

### Static Metadata

```typescript
const GetUser = gql.default(({ query }) =>
  query("GetUser")`{ user(id: "1") { id } }`({
    metadata: { headers: { "X-Test": "value" } },
  })
);
```

### Metadata Callback

Access variables and document context through the callback:

```typescript
const GetUser = gql.default(({ query }) =>
  query("GetUser")`($id: ID!) { user(id: $id) { id } }`({
    metadata: ({ $ }) => ({
      hasIdVar: $.id !== undefined,
    }),
  })
);
```

### Fragment Metadata Aggregation

When an operation includes fragments with metadata, the operation's metadata callback receives `fragmentMetadata`:

```typescript
const userFields = gql.default(({ fragment }) =>
  fragment("UserFields", "User")`{ id name }`({
    metadata: { source: "user-fragment" },
  })
);

const GetUser = gql.default(({ query }) =>
  query("GetUser")`{
    user(id: "1") { ...${userFields} }
  }`({
    metadata: ({ fragmentMetadata }) => ({
      fragmentCount: Array.isArray(fragmentMetadata) ? fragmentMetadata.length : 0,
    }),
  })
);
```

## Compat Mode

Compat mode creates a lightweight spec from a tagged template that can be extended into a full operation later. This is useful for gradual adoption or when metadata needs to be added separately.

### Creating a Compat Spec

```typescript
const GetUserCompat = gql.default(({ query }) =>
  query.compat("GetUser")`($id: ID!) { user(id: $id) { id name } }`
);
```

Note: No trailing `()` — compat specs are not finalized operations.

### Extending a Compat Spec

```typescript
const GetUser = gql.default(({ extend }) => extend(GetUserCompat));

// With additional metadata:
const GetUser = gql.default(({ extend }) =>
  extend(GetUserCompat, {
    metadata: ({ $ }) => ({
      headers: { "X-User-Id": String($.id) },
    }),
  })
);
```

## Syntax Comparison

| Feature | Tagged Template | Callback Builder |
|---------|:-:|:-:|
| Basic field selections | Yes | Yes |
| Variables / arguments | Yes | Yes |
| Nested object selections | Yes | Yes |
| Fragment spreads | Yes (`${frag}`) | Yes (`.spread()`) |
| Static metadata | Yes | Yes |
| Metadata callbacks | Yes | Yes |
| Fragment metadata aggregation | Yes | Yes |
| Field aliases | Yes | Yes |
| Field directives (`@skip`, `@include`) | Yes | Yes (`$dir`) |
| `$colocate` query composition | No | Yes |
| Programmatic field control | No | Yes |

> **Note**: Field-level directives (`@skip`, `@include`) and inline fragment directives (`... on Type @defer`) are supported natively in tagged templates using standard GraphQL syntax. The callback builder syntax provides the same functionality via `$dir` for programmatic control.

## When to Use Which

### Use Tagged Templates When

- Writing standard queries, mutations, or subscriptions
- Defining fragments with simple field selections
- You want concise, readable GraphQL that looks like the query language

### Use the Options-Object Path When

- You need **`$colocate`** for composing multiple query fragments
- You need **field aliases** programmatically (e.g., `f("id", null, { alias: "userId" })`)
- You're building operations that require fine-grained programmatic control

### Mixing Both

Tagged templates and the options-object path can be mixed freely. A common pattern is to define fragments with tagged templates and use the options-object path for complex operations:

```typescript
// Fragment: tagged template (simple)
const UserFields = gql.default(({ fragment }) =>
  fragment("UserFields", "User")`{ id name email }`()
);

// Operation: tagged template with directives (simple)
const GetUser = gql.default(({ query }) =>
  query("GetUser")`($id: ID!, $hideEmail: Boolean!) {
    user(id: $id) {
      userId: id
      name
      email @skip(if: $hideEmail)
      ...${UserFields}
    }
  }`()
);

// Operation: options-object path (needs $colocate or programmatic control)
const GetUserAdvanced = gql.default(({ query, $dir }) =>
  query("GetUserAdvanced")({
    variables: `($id: ID!)`,
    fields: ({ f, $ }) => ({
      ...f("user", { id: $.id })(({ f }) => ({
        ...f("id", null, { alias: "userId" })(),
        ...f("name")(),
        ...f("email", null, { directives: [$dir.skip({ if: true })] })(),
        ...UserFields.spread(),
      })),
    }),
  })({}),
);
```

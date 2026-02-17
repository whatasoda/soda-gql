---
name: gql:guide
description: Interactive guide to soda-gql features and patterns
user-invocable: true
argument-hint: [topic or question]
allowed-tools: Read, Grep, Glob, AskUserQuestion
---

# GraphQL Guide Skill

This skill provides interactive guidance on soda-gql features, syntax patterns, and best practices. Use `$ARGUMENTS` to route to specific topics, or ask the user to choose a topic.

## Topic Routing

Parse `$ARGUMENTS` to determine the user's intent, or use AskUserQuestion to offer topic selection.

### Available Topics

1. **tagged-template** — Tagged template syntax for fragments and operations
2. **fragment** — Fragment definitions and spreading patterns
3. **operation** — Query, mutation, and subscription operations
4. **union** — Union type handling and member selection
5. **directive** — GraphQL directives (@include, @skip, custom directives)
6. **metadata** — Fragment metadata and field-level callbacks
7. **setup** — Project setup, config, and initial codegen
8. **lsp** — LSP integration, editor setup, and diagnostics
9. **codegen** — Schema codegen, typegen, and build integration
10. **colocation** — Fragment colocation patterns ($colocate directive)

### Topic Selection

If `$ARGUMENTS` is empty or unclear, use AskUserQuestion:

**Question:** "What would you like guidance on?"
**Options:**
- "Tagged template syntax" → tagged-template
- "Fragment patterns" → fragment
- "Operations (queries/mutations)" → operation
- "Union types" → union
- "Directives" → directive
- "Metadata and callbacks" → metadata
- "Project setup" → setup
- "LSP and editor integration" → lsp
- "Codegen and build tools" → codegen
- "Fragment colocation" → colocation

## Topic Content

For each topic, provide:
1. Concept explanation
2. References to documentation files
3. Code examples from playground
4. Common patterns and anti-patterns
5. Related topics

---

## Topic 1: tagged-template

### Concept

soda-gql supports tagged template syntax for writing GraphQL fragments and operations:

```typescript
import { fragment, query } from './graphql/generated/runtime';

// Fragment with tagged template
const userFragment = fragment('User')`
  id
  name
  email
`;

// Operation with tagged template
const getUserQuery = query`
  query GetUser($id: ID!) {
    user(id: $id) {
      id
      name
    }
  }
`;
```

### When to Use Tagged Template vs Callback Builder

**Decision Tree:**

1. **Fragment definition:**
   - ✅ Use tagged template: Simple field selection, no aliases
   - ❌ Use callback builder: Field aliases needed

2. **Fragment spreading (Fragment → Fragment):**
   - ✅ Use tagged template interpolation: `...${fragment}`

3. **Operation definition:**
   - ✅ Use tagged template: No fragment spreads, no aliases, no $colocate
   - ❌ Use callback builder: Has fragment spreads via `.spread()`, aliases, or $colocate

4. **Special features:**
   - Union member selection → callback builder only
   - Metadata callbacks → callback builder only
   - Directive with variables → callback builder only

### Key Constraint

**Both tagged templates reject interpolation with values:**
- `fragment\`field: ${value}\`` → ❌ Throws error
- `query\`query { field(id: ${id}) }\`` → ❌ Throws error

Operations with fragment spreads MUST use callback builder syntax with `.spread()` instead of tagged template interpolation.

### Documentation References

- **Core API:** `packages/core/README.md` — Fragment and operation APIs
- **Builder flow:** `docs/guides/builder-flow.md` — Processing pipeline
- **Callback-only features:** `playgrounds/vite-react/src/graphql/callback-builder-features.ts`

### Code Examples

**Tagged template fragment:**
```typescript
// playgrounds/vite-react/src/graphql/fragments.ts
const userFields = fragment('User')`
  id
  name
  email
  createdAt
`;
```

**Tagged template operation (no spreads):**
```typescript
// playgrounds/vite-react/src/graphql/operations.ts
const simpleQuery = query`
  query GetUsers {
    users {
      id
      name
    }
  }
`;
```

**Callback builder operation (with spreads):**
```typescript
// playgrounds/vite-react/src/graphql/operations.ts
const userQuery = query.operation({
  user: query.field({
    args: { id: query.var('ID!') },
    select: (user) => [
      ...userFields.spread(user),
      user.posts({ select: (post) => [post.id, post.title] }),
    ],
  }),
});
```

### Common Patterns

✅ **Simple fragment with tagged template:**
```typescript
const fields = fragment('User')`id name email`;
```

✅ **Fragment spreading another fragment (tagged template):**
```typescript
const extendedFields = fragment('User')`
  ${userFields}
  posts { id title }
`;
```

❌ **Operation with fragment spread (WRONG - tagged template):**
```typescript
// This will FAIL - cannot use tagged template interpolation for fragment spreads in operations
const query = query`
  query {
    user {
      ${userFields}
    }
  }
`;
```

✅ **Operation with fragment spread (CORRECT - callback builder):**
```typescript
const userQuery = query.operation({
  user: query.field({
    select: (user) => [...userFields.spread(user)],
  }),
});
```

### Related Topics

- **fragment** — Fragment definition and spreading patterns
- **operation** — Operation structure and variable handling
- **metadata** — Callback-builder-only metadata feature

---

## Topic 2: fragment

### Concept

Fragments define reusable field selections with type safety. They can be spread into operations or composed into other fragments.

### Fragment Types

1. **Tagged template fragment** — Simple field selection
2. **Callback builder fragment** — Aliases, nested spreads, metadata
3. **Fragment spreading** — Composing fragments together

### Variable Declaration Pattern

**"Fragments declare requirements; operations declare contract"**

- Fragments can declare variables they need: `fragment('User', { includeEmail: 'Boolean!' })`
- Operations must explicitly declare ALL variables, including fragment requirements
- No auto-merge: operation variables are the source of truth

### Documentation References

- **Core API:** `packages/core/README.md` — Fragment API documentation
- **Spread patterns:** `playgrounds/vite-react/src/graphql/fragment-spread-patterns.md`
- **Nested spreads:** `playgrounds/vite-react/src/graphql/nested-fragment-verification.ts`

### Code Examples

**Simple fragment:**
```typescript
const userBasic = fragment('User')`id name email`;
```

**Fragment with variables:**
```typescript
const userConditional = fragment('User', { includeEmail: 'Boolean!' })`
  id
  name
  email @include(if: $includeEmail)
`;
```

**Fragment spreading (Fragment → Fragment):**
```typescript
const userExtended = fragment('User')`
  ${userBasic}
  createdAt
  updatedAt
`;
```

**Operation spreading fragment:**
```typescript
const getUserQuery = query.operation({
  user: query.field({
    args: { id: query.var('ID!') },
    select: (user) => [...userBasic.spread(user)],
  }),
});
```

### Common Patterns

✅ **Fragment composition via tagged template:**
```typescript
const baseFields = fragment('User')`id name`;
const extendedFields = fragment('User')`${baseFields} email`;
```

✅ **Operation declares all variables:**
```typescript
const query = query.operation(
  { id: 'ID!', includeEmail: 'Boolean!' }, // ALL variables
  {
    user: query.field({
      args: { id: query.var('ID!') },
      select: (u) => [...userConditional.spread(u)],
    }),
  }
);
```

❌ **Auto-merge expectation (WRONG):**
```typescript
// Fragment declares $includeEmail
const frag = fragment('User', { includeEmail: 'Boolean!' })`...`;

// Operation does NOT auto-inherit variables
const query = query.operation({ id: 'ID!' }, { // Missing includeEmail!
  user: query.field({ select: (u) => [...frag.spread(u)] }),
});
```

### Related Topics

- **tagged-template** — Syntax for fragment definitions
- **operation** — How operations use fragments
- **metadata** — Fragment-level metadata callbacks

---

## Topic 3: operation

### Concept

Operations define the GraphQL query/mutation/subscription structure with variables, arguments, and field selections.

### Operation Types

1. **Tagged template operation** — Simple operations without fragment spreads
2. **Callback builder operation** — Complex operations with spreads, aliases, $colocate

### Variable Handling

**Operations declare the contract:**
- All variables must be declared at operation level
- Fragment variables are NOT auto-merged
- Use `query.var('Type')` to reference variables in args

### Documentation References

- **Core API:** `packages/core/README.md` — Operation APIs
- **Builder flow:** `docs/guides/builder-flow.md` — Operation processing
- **Examples:** `playgrounds/vite-react/src/graphql/operations.ts`

### Code Examples

**Simple query (tagged template):**
```typescript
const getUsers = query`
  query GetUsers {
    users {
      id
      name
    }
  }
`;
```

**Query with variables (callback builder):**
```typescript
const getUser = query.operation(
  { id: 'ID!' },
  {
    user: query.field({
      args: { id: query.var('ID!') },
      select: (user) => [user.id, user.name, user.email],
    }),
  }
);
```

**Query with fragment spread:**
```typescript
const getUserWithFragment = query.operation({
  user: query.field({
    args: { id: query.var('ID!') },
    select: (user) => [...userFields.spread(user)],
  }),
});
```

**Mutation:**
```typescript
const createUser = mutation.operation(
  { input: 'CreateUserInput!' },
  {
    createUser: mutation.field({
      args: { input: mutation.var('CreateUserInput!') },
      select: (result) => [
        result.success,
        result.user({ select: (u) => [u.id, u.name] }),
      ],
    }),
  }
);
```

### Common Patterns

✅ **Query with nested selections:**
```typescript
query.operation({
  user: query.field({
    select: (u) => [
      u.id,
      u.posts({ select: (p) => [p.id, p.title] }),
    ],
  }),
});
```

✅ **Operation with multiple variables:**
```typescript
query.operation(
  { id: 'ID!', limit: 'Int', offset: 'Int' },
  {
    user: query.field({
      args: { id: query.var('ID!') },
      select: (u) => [
        u.posts({
          args: { limit: query.var('Int'), offset: query.var('Int') },
          select: (p) => [p.id, p.title],
        }),
      ],
    }),
  }
);
```

### Related Topics

- **tagged-template** — Operation syntax options
- **fragment** — Using fragments in operations
- **directive** — Adding directives to operations

---

## Topic 4: union

### Concept

Union types in GraphQL represent a value that could be one of several types. soda-gql provides type-safe union member selection.

### Union Member Selection

**Callback builder only** — Union member selection requires callback builder syntax:

```typescript
query.field({
  select: (result) => [
    result.__typename,
    result.$on('User', (user) => [user.id, user.name]),
    result.$on('Organization', (org) => [org.id, org.name, org.members]),
  ],
});
```

### Documentation References

- **Callback-only features:** `playgrounds/vite-react/src/graphql/callback-builder-features.ts`
- **Union verification:** `playgrounds/vite-react/src/graphql/union-type-verification.ts`

### Code Examples

**Union field selection:**
```typescript
const searchQuery = query.operation({
  search: query.field({
    args: { term: query.var('String!') },
    select: (result) => [
      result.__typename,
      result.$on('User', (user) => [user.id, user.name, user.email]),
      result.$on('Post', (post) => [post.id, post.title, post.content]),
    ],
  }),
});
```

**Union with fragment spread:**
```typescript
const userFields = fragment('User')`id name email`;
const postFields = fragment('Post')`id title content`;

const searchQuery = query.operation({
  search: query.field({
    select: (result) => [
      result.__typename,
      result.$on('User', (user) => [...userFields.spread(user)]),
      result.$on('Post', (post) => [...postFields.spread(post)]),
    ],
  }),
});
```

### Common Patterns

✅ **Always include __typename:**
```typescript
result => [
  result.__typename, // Needed for type discrimination
  result.$on('TypeA', ...),
  result.$on('TypeB', ...),
];
```

✅ **Exhaustive member handling:**
```typescript
// Handle all possible union members
result => [
  result.$on('User', (u) => [...]),
  result.$on('Organization', (o) => [...]),
  result.$on('Bot', (b) => [...]),
];
```

### Related Topics

- **fragment** — Using fragments with union members
- **metadata** — Type-specific metadata callbacks

---

## Topic 5: directive

### Concept

GraphQL directives modify field behavior (@include, @skip) or provide metadata for tools. soda-gql supports standard and custom directives.

### Directive Types

1. **Standard directives:** `@include(if: Boolean)`, `@skip(if: Boolean)`
2. **Custom directives:** Defined in schema, used for metadata or tooling

### Directive Syntax

**Tagged template with static values:**
```typescript
fragment('User')`
  id
  name
  email @include(if: true)
`;
```

**Callback builder with variables:**
```typescript
fragment('User', { includeEmail: 'Boolean!' })`
  id
  name
  email @include(if: $includeEmail)
`;
```

### Documentation References

- **Directive verification:** `playgrounds/vite-react/src/graphql/directive-verification.ts`

### Code Examples

**@include directive:**
```typescript
const conditionalFields = fragment('User', { showEmail: 'Boolean!' })`
  id
  name
  email @include(if: $showEmail)
`;
```

**@skip directive:**
```typescript
const fields = fragment('User', { hideEmail: 'Boolean!' })`
  id
  name
  email @skip(if: $hideEmail)
`;
```

**Custom directive:**
```typescript
// Assuming schema has: directive @sensitive on FIELD_DEFINITION
const userFields = fragment('User')`
  id
  name
  socialSecurityNumber @sensitive
`;
```

### Common Patterns

✅ **Conditional field inclusion:**
```typescript
query.operation(
  { includeDetails: 'Boolean!' },
  {
    user: query.field({
      select: (u) => [
        u.id,
        u.name,
        // Use fragment with @include directive
        ...detailsFragment.spread(u),
      ],
    }),
  }
);
```

### Related Topics

- **fragment** — Directives in fragment definitions
- **metadata** — Directive metadata for tooling

---

## Topic 6: metadata

### Concept

soda-gql allows attaching metadata to fragments and fields for build-time processing (e.g., component mapping, documentation generation).

### Metadata APIs

**Callback builder only** — Metadata requires callback builder syntax:

```typescript
fragment('User').metadata(
  { component: 'UserCard' },
  (user) => [
    user.id,
    user.name.metadata({ label: 'Display Name' }),
  ]
);
```

### Documentation References

- **Callback-only features:** `playgrounds/vite-react/src/graphql/callback-builder-features.ts`
- **Metadata verification:** `playgrounds/vite-react/src/graphql/metadata-verification.ts`

### Code Examples

**Fragment-level metadata:**
```typescript
const userFragment = fragment('User').metadata(
  { component: 'UserCard', description: 'User profile data' },
  (user) => [user.id, user.name, user.email]
);
```

**Field-level metadata:**
```typescript
const userFragment = fragment('User', (user) => [
  user.id,
  user.name.metadata({ label: 'Full Name', required: true }),
  user.email.metadata({ label: 'Email Address', format: 'email' }),
]);
```

**Nested metadata:**
```typescript
const query = query.operation({
  user: query.field({
    select: (user) => [
      user.posts({
        select: (post) => [
          post.id,
          post.title.metadata({ maxLength: 100 }),
        ],
      }).metadata({ component: 'PostList' }),
    ],
  }),
});
```

### Common Patterns

✅ **Component mapping:**
```typescript
fragment('User').metadata({ component: 'UserProfile' }, ...);
```

✅ **Field documentation:**
```typescript
user.email.metadata({ description: 'User email for notifications' });
```

### Related Topics

- **fragment** — Metadata on fragments
- **colocation** — $colocate with metadata

---

## Topic 7: setup

### Concept

Setting up a new soda-gql project involves config file creation, schema setup, and initial codegen.

### Setup Steps

1. **Install dependencies:**
   ```bash
   bun add @soda-gql/core @soda-gql/builder
   bun add -d @soda-gql/cli
   ```

2. **Add framework plugin (optional but recommended):**
   ```bash
   # For Vite
   bun add -d @soda-gql/vite-plugin
   # For Next.js
   bun add -d @soda-gql/next-plugin
   ```

3. **Create config file (`soda-gql.config.ts`):**
   ```typescript
   import { defineConfig } from '@soda-gql/config';

   export default defineConfig({
     outdir: './src/graphql/generated',
     schemas: {
       default: {
         schemaFiles: ['./schema.graphql'],
       },
     },
   });
   ```

4. **Run initial codegen:**
   ```bash
   bun run soda-gql codegen schema
   ```

5. **Configure build plugin (Vite example):**
   ```typescript
   // vite.config.ts
   import { sodaGql } from '@soda-gql/vite-plugin';

   export default {
     plugins: [sodaGql()],
   };
   ```

### Documentation References

- **Main README:** `README.md` — Installation and quick start
- **Core README:** `packages/core/README.md` — API overview
- **Plugin selection:** `docs/guides/plugin-selection.md` — Choosing build plugin

### Common Issues

**Issue: codegen fails with "config not found"**
- Check config file is named correctly: `soda-gql.config.{ts,js,mjs}`
- Check config exports with `export default`

**Issue: "Cannot find module '@soda-gql/core'"**
- Run `bun install` to install dependencies
- Check package.json includes @soda-gql packages

**Issue: Types not updating in editor**
- Restart TypeScript server
- Check outdir matches tsconfig include paths

### Related Topics

- **codegen** — Running codegen and typegen
- **lsp** — Editor integration

---

## Topic 8: lsp

### Concept

soda-gql provides LSP (Language Server Protocol) integration for real-time diagnostics, autocomplete, and hover information in editors.

### LSP Features

1. **Real-time diagnostics:** Type errors, invalid fields, syntax errors
2. **Autocomplete:** Field names, types, directives
3. **Hover information:** Type info, documentation
4. **Go to definition:** Jump to schema type definitions

### Editor Setup

**VS Code:**
1. Install LSP extension (if available)
2. Configure workspace settings:
   ```json
   {
     "soda-gql.configPath": "./soda-gql.config.ts"
   }
   ```

**Other editors:**
- Use language server client compatible with your editor
- Point to soda-gql LSP server

### Documentation References

- **LSP workflow:** `docs/guides/lsp-workflow.md` — LSP development and usage

### LSP Diagnostics

The LSP validates:
- Field existence on types
- Argument types and required args
- Fragment type compatibility
- Variable types
- Directive usage

### Common Issues

**Issue: LSP not providing diagnostics**
- Check config file is found (`found: true` in project detection)
- Restart editor/LSP server
- Check LSP logs for errors

**Issue: False positive errors**
- Run `bun run soda-gql codegen schema` to sync generated types
- Check schema files are up to date

### Related Topics

- **setup** — Initial LSP configuration
- **codegen** — Keeping LSP in sync with schema

---

## Topic 9: codegen

### Concept

soda-gql codegen generates TypeScript types from GraphQL schemas (schema codegen) and validates/generates types from tagged templates (typegen).

### Codegen Commands

1. **Schema codegen:**
   ```bash
   bun run soda-gql codegen schema
   ```
   - Reads schema files from config
   - Generates runtime type system in outdir
   - Creates fragment and query builder types

2. **Type generation (typegen):**
   ```bash
   bun run soda-gql typegen
   ```
   - Scans codebase for tagged templates
   - Validates field selections against schema
   - Generates TypeScript types for fragments/operations

### Build Integration

**Development workflow:**
1. Edit schema files
2. Run `bun run soda-gql codegen schema`
3. Edit fragments/operations
4. Build plugin auto-runs typegen during build

**Watch mode (if supported):**
```bash
bun run soda-gql codegen schema --watch
```

### Documentation References

- **Monorepo infrastructure:** `docs/guides/monorepo-infrastructure.md` — Build system
- **Plugin selection:** `docs/guides/plugin-selection.md` — Build plugin setup
- **Troubleshooting:** `docs/troubleshooting.md` — Common codegen issues

### Common Issues

**Issue: "Schema file not found"**
- Check schemaFiles paths in config are relative to config file
- Use Read tool to verify file exists at expected path

**Issue: Typegen shows "unknown field"**
- Run schema codegen first: `bun run soda-gql codegen schema`
- Check field name spelling matches schema

**Issue: Generated types not updating**
- Delete generated directory and re-run codegen
- Check outdir in config matches import paths

### Related Topics

- **setup** — Initial codegen configuration
- **lsp** — Real-time validation vs build-time codegen

---

## Topic 10: colocation

### Concept

Fragment colocation places fragment definitions near the components that use them, improving code organization and enabling build-time optimizations.

### Colocation Patterns

**$colocate directive:**
```typescript
query.operation({
  user: query.field({
    select: (user) => [
      user.id,
      ...userFragment.spread(user, { $colocate: true }),
    ],
  }),
});
```

**Component colocation:**
```typescript
// UserCard.tsx
export const userCardFragment = fragment('User')`
  id
  name
  email
  avatarUrl
`;

export function UserCard({ user }) {
  // Component uses fragment data
}
```

### Build-Time Processing

Colocation enables:
- Dead code elimination (unused fragments removed)
- Component-fragment association tracking
- Automatic fragment composition

### Documentation References

- **Callback-only features:** `playgrounds/vite-react/src/graphql/callback-builder-features.ts` — $colocate examples

### Common Patterns

✅ **Component-fragment pair:**
```typescript
// UserProfile.tsx
const userProfileFragment = fragment('User')`
  id name email bio
`;

function UserProfile({ data }) {
  // Use fragment data
}
```

✅ **Fragment composition with colocation:**
```typescript
const parentQuery = query.operation({
  user: query.field({
    select: (u) => [
      ...profileFragment.spread(u, { $colocate: true }),
      ...settingsFragment.spread(u, { $colocate: true }),
    ],
  }),
});
```

### Related Topics

- **fragment** — Fragment spreading and composition
- **metadata** — Component metadata with colocation

---

## Interactive Mode

If the user's question doesn't match a specific topic, use Grep to search documentation:

1. Extract keywords from user's question
2. Use Grep to search docs/guides/, packages/core/README.md, and playgrounds/
3. Read matching files and synthesize answer
4. Reference specific documentation sections

### Example: User asks "How do I add pagination?"

1. Grep for "pagination" in docs and playground
2. If not found, explain general approach:
   - Add limit/offset arguments to field
   - Use variables in operation
   - Show example with args
3. Suggest related topics: operation, fragment

## Validation Checklist

Before completing this skill, ensure:
- ✅ Topic was identified from $ARGUMENTS or user selection
- ✅ Relevant documentation was referenced
- ✅ Code examples were provided from playground or synthesized
- ✅ Common patterns and anti-patterns were shown
- ✅ Related topics were suggested for further exploration

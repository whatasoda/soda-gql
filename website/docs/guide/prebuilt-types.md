# Prebuilt Types

Prebuilt types pre-calculate fragment and operation types at build time, replacing runtime type inference with a static type registry for faster IDE responsiveness and reliable type resolution across bundler boundaries.

## How It Works

When you run `typegen`, it scans your source files for fragment and operation definitions, computes their precise input/output types, and writes them to a `types.prebuilt.ts` registry. The main `index.ts` module automatically references this registry — no path aliases or import changes needed.

## Setup

```bash
# First generate the GraphQL system
bun run soda-gql codegen schema

# Then generate prebuilt types
bun run soda-gql typegen
```

This produces the following output structure:

```
{config.outdir}/
├── _internal.ts       # Schema composers and internal definitions
├── index.ts           # Main module with prebuilt type resolution
└── types.prebuilt.ts  # Pre-calculated type registry (populated by typegen)
```

When `codegen` runs for the first time, it creates `types.prebuilt.ts` as an empty stub. Running `typegen` populates the registry with actual types. Subsequent `codegen` runs preserve the existing `types.prebuilt.ts` file.

## Fragment Keys

For fragments to be included in the prebuilt registry, they must have a `key` property:

```typescript
export const userFragment = gql.default(({ fragment }) =>
  fragment.User("UserFields")`
    id
    name
  `(),
);
```

:::warning Fragments Without Keys
Fragments without a `key` property are **silently skipped** during prebuilt type generation. They will not appear in `types.prebuilt.ts`.
:::

### Operations

Operations use their `name` property as the key automatically — no additional configuration needed:

```typescript
export const getUserQuery = gql.default(({ query, $var }) =>
  query.operation({
    name: "GetUser",  // Used as key automatically
    variables: { ...$var("userId").ID("!") },
    fields: ({ f, $ }) => ({
      ...f.user({ id: $.userId })(({ f }) => ({
        ...f.id(),
        ...f.name(),
      })),
    }),
  }),
);
```

## Next Steps

- Learn about [Fragment Keys](/guide/fragments#fragment-keys) in detail
- See [CLI Reference](/api/packages/cli) for all codegen options

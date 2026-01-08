# Prebuilt Types

Prebuilt types solve type inference issues that occur when bundling soda-gql with tools like tsdown, rollup-plugin-dts, or other bundlers that merge declaration files.

## The Problem

When bundlers merge `.d.ts` files, complex type inference (like `InferFields`) can be lost at module boundaries. This means your fragments and operations may lose their precise input/output types in the bundled output.

## The Solution

Generate a prebuilt types module that pre-calculates all types at build time:

```bash
bun run soda-gql codegen --prebuilt
```

This creates additional files:

```
{config.outdir}/
├── index.ts           # Regular module with full type inference
└── prebuilt/
    ├── index.ts       # Prebuilt module using type registry
    └── types.ts       # Pre-calculated type definitions
```

## Fragment Keys

For fragments to be included in the prebuilt registry, they must have a `key` property:

```typescript
export const userFragment = gql.default(({ fragment }) =>
  fragment.User({
    key: "UserFields",  // Required for prebuilt types
    fields: ({ f }) => ({
      ...f.id(),
      ...f.name(),
    }),
  }),
);
```

:::warning Fragments Without Keys
Fragments without a `key` property are **silently skipped** during prebuilt type generation. They will not appear in `prebuilt/types.ts`.
:::

### Operations

Operations use their `name` property as the key automatically - no additional configuration needed:

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

## Bundler Configuration

Configure your bundler to use the prebuilt module via path aliases:

### tsdown / tsconfig.json

```json
{
  "compilerOptions": {
    "paths": {
      "<outdir>": ["<outdir>/prebuilt"]
    }
  }
}
```

### Vite

```typescript
export default {
  resolve: {
    alias: {
      "<outdir>": "<outdir>/prebuilt"
    }
  }
}
```

### Webpack

```typescript
module.exports = {
  resolve: {
    alias: {
      "<outdir>": "<outdir>/prebuilt"
    }
  }
}
```

Replace `<outdir>` with your actual codegen output directory (e.g., `./src/graphql-system`).

## Development vs Production

The same source code works in both modes:

| Mode | Type Resolution |
|------|-----------------|
| Development | Full type inference at IDE/compile time |
| Bundled/Production | Prebuilt types from registry |

No code changes needed between environments.

## Next Steps

- Learn about [Fragment Keys](/guide/fragments#fragment-keys) in detail
- See [CLI Reference](/api/packages/cli) for all codegen options

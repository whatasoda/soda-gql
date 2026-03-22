# Topic: Setup

## Concept

Setting up a new soda-gql project involves config file creation, schema setup, and initial codegen. The process is: install packages, create config, run schema codegen, then optionally configure a build plugin.

### Setup Steps

1. **Install dependencies:**
   ```bash
   bun add @soda-gql/core @soda-gql/builder
   bun add -d @soda-gql/tools
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

## Code Examples

**Minimal config:**
```typescript
// soda-gql.config.ts
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

**Config with multiple schemas:**
```typescript
// soda-gql.config.ts
import { defineConfig } from '@soda-gql/config';

export default defineConfig({
  outdir: './src/graphql/generated',
  schemas: {
    default: {
      schemaFiles: ['./schema.graphql', './schema-extensions.graphql'],
    },
    admin: {
      schemaFiles: ['./admin-schema.graphql'],
    },
  },
});
```

**Using the generated runtime:**
```typescript
import { gql } from './src/graphql/generated'; // matches outdir in config

const userFragment = gql.default(({ fragment }) =>
  fragment("UserFields", "User")`{
    id
    name
    email
  }`(),
);
```

## Common Patterns

✅ **Config file in project root:**
```
my-project/
  soda-gql.config.ts    ← here
  schema.graphql
  src/
    graphql/
      generated/        ← outdir
```

✅ **Schema paths relative to config file:**
```typescript
schemaFiles: ['./schema.graphql'],  // relative to soda-gql.config.ts location
```

❌ **Wrong config filename:**
```
soda-gql.config.json    ← unsupported
sodagql.config.ts       ← not detected
```

## Common Issues

**Issue: codegen fails with "config not found"**
- Check config file is named correctly: `soda-gql.config.{ts,js,mjs}`
- Check config exports with `export default`

**Issue: "Cannot find module '@soda-gql/core'"**
- Run `bun install` to install dependencies
- Check package.json includes @soda-gql packages

**Issue: Types not updating in editor**
- Restart TypeScript server
- Check outdir matches tsconfig include paths

## Related Topics

- **codegen** — Running schema codegen and typegen
- **lsp** — Editor integration after setup
- **tagged-template** — First steps writing fragments and operations

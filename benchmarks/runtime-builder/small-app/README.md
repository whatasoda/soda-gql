# Small App Benchmark Fixture

**Scale:** Minimal application for baseline performance testing

## Metrics
- **Schema:** ~15 LOC, 1 entity (Product), 3 types
- **Operations:** 2 (1 query, 1 mutation)
- **Source files:** 6 total
  - 1 schema.graphql
  - 1 entity definition (product.ts)
  - 2 operations (product-list.page.ts, product-create.mutation.ts)
  - 2 config files (tsconfig.json, babel.config.js)

## Structure
```
small-app/
├── schema.graphql           # GraphQL schema definition
├── tsconfig.json            # TypeScript configuration
├── babel.config.js          # Babel configuration
├── graphql-system/          # Codegen output (generated)
│   └── index.ts
└── src/
    ├── entities/
    │   └── product.ts       # Product model + slice
    └── pages/
        ├── product-list.page.ts        # Query operation
        └── product-create.mutation.ts  # Mutation operation
```

## Usage

### Generate TypeScript runtime
The runtime is automatically generated when running performance tests. To manually generate:
```bash
bun run soda-gql codegen \
  --schema:default ./benchmarks/runtime-builder/small-app/schema.graphql \
  --out ./benchmarks/runtime-builder/small-app/graphql-system/index.ts \
  --runtime-adapter:default ./benchmarks/runtime-builder/small-app/runtime-adapter.ts \
  --scalar:default ./benchmarks/runtime-builder/small-app/runtime-adapter.ts \
  --format typescript
```

### Run builder (runtime mode)
```bash
bun run soda-gql builder --mode runtime --entry "./benchmarks/runtime-builder/small-app/src/**/*.ts" --out ./.cache/soda-gql/benchmarks/small-app-runtime.json
```

### Performance testing
```bash
bun run perf:builder --fixture small-app
```

## Determinism
This fixture is manually created with deterministic structure:
- Fixed entity/operation naming
- Sorted imports
- Consistent formatting
- No dynamic timestamps or random values

# Medium App Benchmark Fixture

**Scale:** Medium-complexity application for intermediate performance testing

## Metrics
- **Schema:** ~110 LOC, 3 entities (Product, Order, Category), 12 types (including enums, input types, connections)
- **Operations:** 6 (3 queries, 2 mutations, 1 subscription)
- **Source files:** 13 total
  - 1 schema.graphql
  - 3 entity definitions (product.ts, order.ts, category.ts)
  - 6 operation files (3 queries, 2 mutations, 1 subscription)
  - 2 config files (tsconfig.json, babel.config.js)
  - 1 README.md

## Structure
```
medium-app/
├── schema.graphql           # GraphQL schema definition (~110 LOC)
├── tsconfig.json            # TypeScript configuration
├── babel.config.js          # Babel configuration
├── graphql-system/          # Codegen output (generated)
│   └── index.ts
└── src/
    ├── entities/
    │   ├── product.ts       # Product model + slice (with category fragment)
    │   ├── order.ts         # Order model + slice
    │   └── category.ts      # Category model + slice
    └── pages/
        ├── product-list.page.ts         # Product query with pagination
        ├── product-create.mutation.ts   # Create product mutation
        ├── order-list.page.ts           # Order query
        ├── create-order.mutation.ts     # Create order mutation
        ├── category-list.page.ts        # Category query
        └── order-status.subscription.ts # Order status subscription
```

## Features
- **Pagination:** ProductConnection with edges/pageInfo pattern
- **Nested relations:** Product → Category, Order → OrderItem → Product
- **Enums:** OrderStatus enum
- **Input types:** CreateProductInput, UpdateProductInput, OrderItemInput
- **Subscriptions:** Real-time order status updates

## Usage

### Generate TypeScript runtime
```bash
bun run soda-gql codegen --schema ./benchmarks/runtime-builder/medium-app/schema.graphql --out ./benchmarks/runtime-builder/medium-app/graphql-system/index.ts
```

### Run builder (runtime mode)
```bash
bun run soda-gql builder --mode runtime --entry "./benchmarks/runtime-builder/medium-app/src/**/*.ts" --out ./.cache/soda-gql/benchmarks/medium-app-runtime.json
```

### Performance testing
```bash
bun run perf:builder --fixture medium-app
```

## Determinism
This fixture is manually created with deterministic structure:
- Fixed entity/operation naming (alphabetically sorted where applicable)
- Sorted imports
- Consistent formatting
- No dynamic timestamps or random values

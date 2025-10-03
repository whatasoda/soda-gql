# Large App Benchmark Fixture

**Scale:** Large-scale e-commerce application for comprehensive performance testing

## Metrics
- **Schema:** ~350 LOC, 6 entities (Product, Category, Brand, Order, User, Review, Cart), 28 types (including enums, input types, connections, analytics)
- **Operations:** 15 total
  - 9 queries (product list/detail/search, category list, brand list, order list/detail, user profile, cart)
  - 5 mutations (create product/order, add to cart, add review, update user)
  - 2 subscriptions (order status, cart updates)
- **Source files:** 25 total
  - 1 schema.graphql (~350 LOC)
  - 6 entity definitions (product.ts, category.ts, brand.ts, order.ts, user.ts, review.ts)
  - 3 feature modules (cart-entity.ts, cart.page.ts, add-to-cart.mutation.ts, cart-updated.subscription.ts, add-review.mutation.ts)
  - 15 operation files across pages and features
  - 2 config files (tsconfig.json, babel.config.js)
  - 1 README.md

## Structure
```
large-app/
├── schema.graphql           # GraphQL schema definition (~350 LOC)
├── tsconfig.json            # TypeScript configuration
├── babel.config.js          # Babel configuration
├── graphql-system/          # Codegen output (generated)
│   └── index.ts
└── src/
    ├── entities/
    │   ├── product.ts       # Product model (with images, attributes, nested category/brand)
    │   ├── category.ts      # Category model + slice
    │   ├── brand.ts         # Brand model + slice
    │   ├── order.ts         # Order model + slice (with items, addresses)
    │   ├── user.ts          # User model + slice
    │   └── review.ts        # Review model + slice
    ├── pages/
    │   ├── product-list.page.ts         # Product query with pagination
    │   ├── product-detail.page.ts       # Product detail with related products
    │   ├── product-search.page.ts       # Product search query
    │   ├── product-create.mutation.ts   # Create product mutation
    │   ├── category-list.page.ts        # Category query
    │   ├── brand-list.page.ts           # Brand query
    │   ├── order-list.page.ts           # Order query with pagination
    │   ├── order-detail.page.ts         # Order detail query
    │   ├── order-create.mutation.ts     # Create order mutation
    │   ├── order-status.subscription.ts # Order status subscription
    │   ├── user-profile.page.ts         # User profile query
    │   └── update-user.mutation.ts      # Update user mutation
    └── features/
        ├── cart/
        │   ├── cart-entity.ts            # Cart model + slice
        │   ├── cart.page.ts              # Cart query
        │   ├── add-to-cart.mutation.ts   # Add to cart mutation
        │   └── cart-updated.subscription.ts # Cart update subscription
        └── reviews/
            └── add-review.mutation.ts    # Add review mutation
```

## Features
- **Complex Pagination:** ProductConnection, OrderConnection with edges/pageInfo
- **Deep Nesting:** Product → Brand, Category, Images, Attributes, Reviews
- **Rich Relations:** Order → User, OrderItems → Products, Addresses
- **Enums:** OrderStatus, PaymentStatus, UserRole, AddressType
- **Input Types:** Multiple complex input types for mutations
- **Subscriptions:** Real-time order status and cart updates
- **Feature Modules:** Organized cart and reviews as separate feature domains
- **Analytics Types:** ProductAnalytics, SalesAnalytics (unused in operations but present in schema)

## Complexity Highlights
- **45+ source files** across entities, pages, and features
- **28 GraphQL types** including 4 enums and 8 input types
- **Deep fragment composition** (3-4 levels)
- **Mixed operation types** across queries, mutations, subscriptions
- **Feature-based organization** mimicking real-world project structure

## Usage

### Generate TypeScript runtime
```bash
bun run soda-gql codegen --schema ./benchmarks/runtime-builder/large-app/schema.graphql --out ./benchmarks/runtime-builder/large-app/graphql-system/index.ts
```

### Run builder (runtime mode)
```bash
bun run soda-gql builder --mode runtime --entry "./benchmarks/runtime-builder/large-app/src/**/*.ts" --out ./.cache/soda-gql/benchmarks/large-app-runtime.json
```

### Performance testing
```bash
bun run perf:builder --fixture large-app
```

## Determinism
This fixture is manually created with deterministic structure:
- Fixed entity/operation naming (alphabetically sorted where applicable)
- Sorted imports and fields
- Consistent formatting across all files
- No dynamic timestamps or random values
- Predictable file structure for reproducible benchmarking

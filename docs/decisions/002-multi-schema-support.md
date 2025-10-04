# ADR-002: Multi-Schema GraphQL Support

Date: 2025-01-28

## Status

Proposed

## Context

Currently, soda-gql only supports a single GraphQL schema per project. However, real-world applications often need to interact with multiple GraphQL endpoints, each with its own schema (e.g., public API, admin API, internal services). We need to extend the system to support multiple schemas while maintaining:

- Type safety for each schema
- Zero-runtime overhead
- Minimal API changes
- Compatibility with existing build tools (builder, plugin-babel)

## Decision

We will implement multi-schema support using a named-access pattern where each schema is accessed through a property on the `gql` object.

### API Design

```typescript
import { gql } from "@/graphql-system";

// All schemas accessed by name with array-based API
const userModel = gql.default(({ model }) =>
  model.User(
    {},
    ({ f }) => [
      //
      f.id(),
      f.name(),
    ],
    (selected) => selected,
  )
);

const adminUser = gql.admin(({ model }) =>
  model.AdminUser(
    {},
    ({ f }) => [
      //
      f.id(),
      f.permissions(),
    ],
    (selected) => selected,
  )
);

// Users can choose short names for convenience
const post = gql._(({ model }) =>  // "_" as main schema
  model.Post({}, ({ f }) => [ /* ... */ ], (s) => s)
);
```

### Configuration

```json
{
  "schemas": {
    "default": "./schema.graphql",
    "admin": "./admin-schema.graphql"
  },
  "inject-from": "./src/graphql/adapter.ts",
  "out": "./src/graphql-system/index.ts"
}
```

### Implementation Strategy

1. **Phase 1: Core Types & Factory** (packages/core)
   - Add `MultiSchemaConfig` type
   - Create `createMultiSchemaGql` factory function
   - Maintain backward compatibility with `createGql`

2. **Phase 2: Code Generation** (packages/codegen)
   - Extend generator to handle multiple schemas
   - Generate separate type definitions per schema
   - Create unified `gql` export with named properties

3. **Phase 3: CLI Support** (packages/cli)
   - Add config file loader
   - Support `--schema:{name}` CLI arguments
   - Update help documentation

4. **Phase 4: Build Tools** (packages/builder, plugin-babel)
   - Extend pattern recognition for `gql.{schema}()` calls
   - Include schema name in canonical IDs
   - Update AST transformations

## Detailed Implementation Plan

### 1. packages/core Changes

#### New Files:
- `src/types/multi-schema.ts`
  ```typescript
  export type SchemaConfig<TSchema, TAdapter> = {
    schema: TSchema;
    adapter: TAdapter;
  };

  export type MultiSchemaConfig = {
    [schemaName: string]: SchemaConfig<any, any>;
  };

  export type GqlFactory = {
    [schemaName: string]: <T>(
      factory: (helpers: SchemaHelpers) => T
    ) => T;
  };
  ```

- `src/factories/multi-schema.ts`
  ```typescript
  export const createMultiSchemaGql = (
    configs: MultiSchemaConfig
  ): GqlFactory => {
    const factory: GqlFactory = {};

    Object.entries(configs).forEach(([name, config]) => {
      const instance = createGql(config);
      factory[name] = (fn) => fn(instance);
    });

    return factory;
  };
  ```

#### Modified Files:
- `src/index.ts`: Export new types and factory

### 2. packages/codegen Changes

#### Modified Files:
- `src/runner.ts`
  - Add `runMultiSchemaCodegen` function
  - Parse multiple schema files
  - Validate schema names

- `src/generator.ts`
  - Add `generateMultiSchemaModule` function
  - Generate per-schema instances
  - Create unified gql export

- `src/types.ts`
  ```typescript
  export type MultiSchemaCodegenOptions = {
    schemas: Record<string, string>; // name -> path
    injectFromPath: string;
    outPath: string;
  };
  ```

#### Template Output:
```typescript
// Generated code structure
import { createGql } from "@soda-gql/core";
import { adapter, scalar } from "./adapter";

// Per-schema definitions
const defaultSchema = { /* ... */ };
const adminSchema = { /* ... */ };

// Create instances
const defaultInstance = createGql({ schema: defaultSchema, adapter });
const adminInstance = createGql({ schema: adminSchema, adapter });

// Export unified gql
export const gql = {
  default: (fn) => fn(defaultInstance),
  admin: (fn) => fn(adminInstance),
};
```

### 3. packages/cli Changes

#### New Files:
- `src/config/loader.ts`
  ```typescript
  export const loadConfig = (path: string): Result<Config, Error>;
  export const validateConfig = (config: unknown): Result<Config, Error>;
  ```

#### Modified Files:
- `src/commands/codegen.ts`
  - Support config file with `--config` flag
  - Support inline schema definitions `--schema:name path`
  - Detect single vs multi-schema mode

- `src/schemas/codegen-args.ts`
  - Add config file option
  - Add dynamic schema arguments

### 4. packages/builder Changes

#### Modified Files:
- `src/discover.ts`
  - Pattern: `/gql\.(\w+)\s*\(/g`
  - Extract schema name from matches
  - Store schema context in analysis

- `src/types.ts`
  ```typescript
  export type ModuleAnalysis = {
    // ... existing fields
    schemaName?: string; // Added field
  };
  ```

- `src/module-loader.ts`
  - Include schema name in module metadata
  - Pass through to artifact generation

### 5. packages/plugin-babel Changes

#### Modified Files:
- `src/plugin.ts`
  - Extend `gqlMethodNames` pattern matching
  - Handle `gql.{schema}.{method}` pattern
  - Include schema in canonical ID: `file::export::schema::method`

```typescript
// Pattern recognition update
const isGqlCall = (node: t.CallExpression): {
  schema: string;
  method: string;
} | null => {
  if (!t.isMemberExpression(node.callee)) return null;

  // Handle gql.schema.method pattern
  if (t.isMemberExpression(node.callee.object)) {
    const obj = node.callee.object;
    if (!t.isIdentifier(obj.object, { name: "gql" })) return null;
    if (!t.isIdentifier(obj.property)) return null;
    if (!t.isIdentifier(node.callee.property)) return null;

    return {
      schema: obj.property.name,
      method: node.callee.property.name,
    };
  }

  return null;
};
```

## Testing Strategy

1. **Unit Tests**:
   - Test multi-schema factory creation
   - Validate type inference per schema
   - Test config validation

2. **Integration Tests**:
   - Generate code from multiple schemas
   - Build and transform with plugin-babel
   - Verify runtime execution

3. **E2E Tests**:
   - Create example with 2-3 schemas
   - Test full workflow from codegen to runtime
   - Verify type safety across schemas

## Migration Guide

For users upgrading from single-schema:

```typescript
// Before
import { gql } from "@/graphql-system";
const user = gql.model("User", /* ... */);

// After (with default schema)
import { gql } from "@/graphql-system";
const user = gql.default(({ model }) =>
  model("User", /* ... */)
);
```

## Consequences

### Positive
- Support for multiple GraphQL endpoints
- Each schema has independent type definitions
- Flexible naming (users choose schema names)
- Clear schema selection at definition time
- No runtime overhead

### Negative
- Breaking change for existing users
- Slightly more verbose API
- Additional complexity in build tools

### Neutral
- Config file becomes practically required for multi-schema
- Schema name included in all canonical IDs

## Implementation Order

1. Core types and factory (packages/core)
2. Code generation (packages/codegen)
3. CLI support (packages/cli)
4. Builder updates (packages/builder)
5. Babel plugin updates (packages/plugin-babel)
6. Documentation and examples
7. Migration tooling (optional)

## Critical Considerations

### Type Safety
- Each schema must have completely isolated type definitions
- The factory pattern ensures type inference works correctly
- Generic constraints prevent mixing types between schemas

### Zero-Runtime Compatibility
- All schema selection happens at build time
- The factory pattern is eliminated during transformation
- No runtime schema lookup or switching

### Build Pipeline Integration
- Canonical IDs must uniquely identify schema+export+method
- Artifact format needs schema context per reference
- Source cache must handle multi-schema imports

### Validation Requirements
- Schema names must be valid JavaScript identifiers
- Reserved names should be blocked (e.g., `prototype`, `constructor`)
- Duplicate schema names must be detected early

## Open Questions

1. Should we provide a migration codemod for existing code?
2. Should schema names be validated (e.g., no reserved words)?
3. Should we support lazy loading of schemas?

## References

- [ADR-000: ADR Process](./000-adr-process.md)
- [ADR-001: Zero-runtime GraphQL-in-JS](./001-zero-runtime-gql-in-js.md)
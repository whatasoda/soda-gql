# Implementation Plan: Zero-runtime GraphQL Query Generation System (Revised)

**Branch**: `001-zero-runtime-gql-in-js` | **Date**: 2025-09-14 | **Spec**: `/specs/001-zero-runtime-gql-in-js/spec.md`

## Summary

Develop a zero-runtime GraphQL query generation system similar to PandaCSS's CSS-in-JS approach. The system allows developers to write GraphQL queries in TypeScript with full type safety, which are then statically analyzed and transformed at build time into optimized GraphQL documents.

## Core Type System Architecture

The implementation is built around three foundational type definition files in `packages/core/src/types`:

### schema.ts - GraphQL Schema Type System
- **GraphqlSchema**: Core type representing the entire GraphQL schema
- **Type Factories**: `defineScalar`, `defineEnum`, `defineInputType`, `defineObjectType`, `defineUnionType`
- **Type References**: System for referencing types with nullability and list modifiers
- **Type Inference**: Utilities for inferring TypeScript types from GraphQL schema

### document.ts - GraphQL Document Structure
- **GraphqlDocument**: Type-safe representation of GraphQL queries/mutations/subscriptions
- **FieldSelection**: Type system for selecting fields with arguments and directives
- **InlineFragment**: Support for union types and interfaces
- **Type Inference**: `InferFromSelectedFields` for deriving result types

### model.ts - Model API Interface
- **ModelFn**: Main function type for creating reusable GraphQL models
- **InlineModelFn**: Function type for inline model composition
- **ModelFactory**: Factory pattern for field selection with type safety
- **Transform Functions**: Data normalization at model level

## Implementation Phases

### Phase 1: Codegen Package - Schema Parser
**Goal**: Parse GraphQL schema files and generate TypeScript `GraphqlSchema` objects

**Key Components**:
1. **GraphQL Schema Parser**
   - Parse `.graphql` schema files using GraphQL AST
   - Extract all types (scalars, enums, inputs, objects, unions)
   - Handle field arguments and type modifiers (nullable, lists)

2. **TypeScript Code Generation**
   - Generate `defineScalar()`, `defineEnum()`, etc. calls
   - Create proper type inference with generic parameters
   - Handle type references with correct nullability

3. **Schema Structure** (as shown in debug.test.ts):
   ```typescript
   export const schema = {
     schema: { query: "query_root", mutation: "mutation_root", subscription: "subscription_root" },
     scalar: { /* generated scalars */ },
     enum: { /* generated enums */ },
     input: { /* generated inputs */ },
     object: { /* generated objects */ },
     union: { /* generated unions */ }
   } satisfies GraphqlSchema;
   ```

### Phase 2: Core Package Implementation
**Goal**: Implement runtime GraphQL utilities using the type system

**Key Components**:
1. **gql.model() Implementation**
   - Accept typed schema from Phase 1
   - Provide field selection tools with full type inference
   - Support argument passing and directives
   - Return structured model objects

2. **gql.inlineModel() Implementation**
   - Simplified model for inline composition
   - Type-safe nested selections
   - Integration with parent models

3. **Query/Mutation/Subscription Builders**
   - Compose multiple models into documents
   - Handle variable definitions
   - Generate executable GraphQL strings

4. **Document Generation**
   - Convert type-safe selections to GraphQL AST
   - Optimize query structure
   - Handle deduplication

### Phase 3: Codegen Package - gql Instance Generation
**Goal**: Generate the complete `graphql-system` directory with configured gql instance

**Key Components**:
1. **gql Instance Creation**
   - Instantiate gql with generated schema
   - Export all utilities (model, inlineModel, query, mutation, etc.)
   - Provide type inference helpers

2. **Directory Structure**:
   ```
   graphql-system/
   ├── index.ts        # Main export with configured gql
   ├── schema.ts       # Generated GraphqlSchema
   ├── types.ts        # Type exports for user code
   └── utilities.ts    # Helper functions
   ```

3. **Type Exports**
   - Export inferred types for all schema types
   - Provide utility types for common patterns
   - Enable `gql.infer<typeof model>` pattern

### Phase 4: Builder Package - Static Analysis
**Goal**: Analyze TypeScript code to extract and optimize GraphQL operations

**Key Components**:
1. **AST Analysis**
   - Parse TypeScript files using TypeScript Compiler API
   - Identify all gql.model() and related calls
   - Extract selection patterns and transforms

2. **Dependency Resolution**
   - Track model dependencies across files
   - Handle re-exports and barrel files
   - Create dependency graph

3. **Document Generation**
   - Execute extracted model code
   - Generate optimized GraphQL documents
   - Create mapping for transformation

4. **Output Format**
   - JSON manifest with document mappings
   - Preserved transform functions
   - Source location tracking

### Phase 5: Plugin-babel Package - Build Transformation
**Goal**: Transform runtime code to zero-runtime using builder output

**Key Components**:
1. **Babel Plugin**
   - Visitor pattern for AST transformation
   - Replace gql calls with pre-generated documents
   - Hoist query definitions to module level

2. **Code Transformation**
   - Runtime model calls → static documents
   - Preserve transform functions
   - Optimize for tree-shaking

3. **React Optimization**
   - Move queries outside render functions
   - Prevent re-creation on re-renders
   - Maintain referential stability

### Phase 6: CLI Package - Developer Tools
**Goal**: Provide user-friendly commands for schema generation and validation

**Key Components**:
1. **Commands**
   - `soda-gql init`: Initialize project configuration
   - `soda-gql generate`: Generate graphql-system from schema
   - `soda-gql watch`: Watch mode for development
   - `soda-gql check`: Validate without generation

2. **Configuration**
   - Schema file location
   - Output directory settings
   - Plugin-specific options

3. **Developer Experience**
   - Clear error messages with context
   - Progress indicators
   - Schema change detection

## Key Implementation Principles

### Type Safety First
- No type tests needed - focus on implementation tests
- Let TypeScript's type system validate correctness
- Use discriminated unions for better inference

### Progressive Enhancement
1. Start with runtime implementation (immediate value)
2. Add build-time optimization (performance)
3. Maintain backward compatibility

### Testing Strategy
- Skip unit tests for type definitions
- Focus on integration tests with real schemas
- Test actual GraphQL document generation
- Use debug.test.ts pattern for validation

## Technical Constraints

### No External Type Imports
- Types in packages/core/src/types are canonical
- No imports from /specs directory
- Each package self-contained

### Pure Functions
- All utilities as pure functions
- No class-based state management
- Dependency injection for testability

### Error Handling
- Use Result types (neverthrow)
- No exceptions in normal flow
- Detailed error context

## Development Workflow

### Monorepo Structure
```
packages/
├── core/           # Runtime utilities with type system
├── codegen/        # Schema parsing and generation
├── builder/        # Static analysis engine
├── plugin-babel/   # Babel transformation
└── cli/            # Command-line interface
```

### TypeScript Configuration
- Direct TS imports during development
- Bun's native TypeScript support
- Build configuration deferred until publishing

### Import Conventions
- No file extensions in imports
- Workspace protocol for internal deps
- TypeScript project references

## Success Criteria

1. **Type Safety**: Full inference from schema to query results
2. **Zero Runtime**: No query parsing in production builds
3. **Developer Experience**: Intuitive API matching examples
4. **Performance**: Instant type feedback during development
5. **Compatibility**: Works with existing GraphQL servers

## Next Steps

1. Implement GraphQL schema parser in codegen package
2. Build core gql.model() function with type inference
3. Create document generation from model selections
4. Develop static analysis in builder package
5. Implement Babel plugin for transformation
6. Package as CLI with user-friendly commands

---
*Based on existing plan.md structure with adaptations for new type-driven architecture*
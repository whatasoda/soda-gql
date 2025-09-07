# Data Model: Zero-runtime GraphQL Query Generation

## Core Entities

### RemoteModel
Represents a type-safe GraphQL fragment with transformation capabilities.

**Fields**:
- `typeName: keyof SchemaTypes` - GraphQL type this model represents (type-safe)
- `fields: (relation: RelationFunction<T>, args?: TParams) => FieldSelection` - Field selector function with context-aware relations
- `parameters: ParameterDefinition[]` - Injectable parameters for relationships
- `transform: TransformFunction` - Data normalization function
- `_brand: unique symbol` - Type brand for type safety

**Validation Rules**:
- `typeName` must match a valid GraphQL type in schema
- `fields` must be valid selections for the type
- `transform` must be a pure function
- Parameters must have unique names within model

**State Transitions**:
- Created → Validated → Registered → Referenced

### QuerySlice
Domain-specific query definition for focused concerns.

**Fields**:
- `name: string` - Unique identifier for the slice
- `remoteModels: RemoteModelReference[]` - Referenced remote models
- `arguments: ArgumentDefinition[]` - Query arguments
- `selections: SelectionSet` - Query selections
- `transform: TransformFunction` - Result transformation

**Validation Rules**:
- `name` must be unique within module
- All referenced models must be registered
- Arguments must have valid GraphQL types
- Selections must be valid for query type

**State Transitions**:
- Defined → Validated → Merged → Generated

### MutationSlice
Domain-specific mutation definition.

**Fields**:
- `name: string` - Unique identifier
- `remoteModels: RemoteModelReference[]` - Referenced models
- `arguments: ArgumentDefinition[]` - Mutation arguments
- `selections: SelectionSet` - Result selections
- `transform: TransformFunction` - Result transformation

**Validation Rules**:
- Same as QuerySlice but for mutation operations
- Must specify mutation field from schema

### SubscriptionSlice
Domain-specific subscription definition.

**Fields**:
- `name: string` - Unique identifier
- `remoteModels: RemoteModelReference[]` - Referenced models
- `arguments: ArgumentDefinition[]` - Subscription arguments
- `selections: SelectionSet` - Event selections
- `transform: TransformFunction` - Event transformation

**Validation Rules**:
- Same as QuerySlice but for subscription operations
- Must handle streaming responses

### PageQuery
Composite query combining multiple slices.

**Fields**:
- `name: string` - Page identifier
- `slices: SliceReference[]` - Combined slices
- `argumentMapping: ArgumentMap` - Cross-slice argument mapping
- `document: GraphQLDocument` - Generated document
- `registrationId: symbol` - Unique registration key

**Validation Rules**:
- All slices must be compatible (no conflicts)
- Argument mappings must be type-compatible
- Document must be valid GraphQL
- Must have unique registration ID

**State Transitions**:
- Composed → Deduplicated → Generated → Registered

### FieldSelection
Represents selected fields in a GraphQL type.

**Fields**:
- `scalar: string[]` - Scalar field names
- `nested: Map<string, FieldSelection>` - Nested selections
- `parameters: Map<string, Parameter>` - Field parameters
- `aliases: Map<string, string>` - Field aliases

**Validation Rules**:
- Fields must exist in GraphQL type
- Nested selections must match field types
- Parameters must be valid for fields

### TransformFunction
Function for transforming raw GraphQL data.

**Fields**:
- `input: TypeReference` - Expected input type
- `output: TypeReference` - Transformed output type
- `function: Function` - Transformation logic
- `pure: boolean` - Must be pure function

**Validation Rules**:
- Must handle null/undefined gracefully
- Must not have side effects
- Must be serializable for build process

### GraphQLDocument
Generated GraphQL document.

**Fields**:
- `query: string` - GraphQL query string
- `variables: VariableDefinition[]` - Variable definitions
- `fragments: FragmentDefinition[]` - Inline fragments
- `checksum: string` - Document hash for caching

**Validation Rules**:
- Must be valid GraphQL syntax
- Variables must match usage in query
- Fragments must be used in query

### Registration
Top-level document registration.

**Fields**:
- `id: symbol` - Unique identifier
- `document: GraphQLDocument` - Registered document
- `transforms: Map<string, TransformFunction>` - Transform functions
- `timestamp: number` - Registration time

**Validation Rules**:
- ID must be unique in application
- Document must be valid
- Transforms must match document structure

## Relationships

### RemoteModel → FieldSelection
- One-to-one: Each RemoteModel has one FieldSelection
- The FieldSelection defines what fields to fetch

### QuerySlice → RemoteModel
- Many-to-many: Slices can reference multiple models
- Models can be used by multiple slices

### PageQuery → QuerySlice
- One-to-many: PageQuery combines multiple slices
- Each slice belongs to one PageQuery at runtime

### PageQuery → Registration
- One-to-one: Each PageQuery has one Registration
- Registration prevents re-evaluation

### TransformFunction → RemoteModel
- One-to-one: Each model has one transform
- Transform is applied to fetched data

## Type System Integration

### Type Inference Chain
```
RemoteModel<T> → FieldSelection → GraphQLType → TransformFunction<T> → InferredType<T>
```

### Parameter Injection Flow
```
PageQuery.arguments → ArgumentMapping → SliceParameters → RemoteModelParameters
```

### Registration Lifecycle
```
Definition → Analysis → Generation → Registration → Reference → Execution
```

## Generated Schema Structure

The generated `graphql-system` directory contains:

```
graphql-system/
├── index.ts           # Main export with gql API
├── types.ts           # SchemaTypes definitions
├── inputs.ts          # SchemaInputTypes definitions
├── scalars.ts         # SchemaScalarTypes definitions
├── enums.ts           # SchemaEnumTypes definitions
├── react.ts           # React hooks (if configured)
└── package.json       # Package configuration

```

## Validation Schemas (Zod)

```typescript
const RemoteModelSchema = z.object({
  typeName: z.enum(Object.keys(SchemaTypes)),
  fields: z.function(),
  parameters: z.array(ParameterSchema).optional(),
  transform: z.function()
});

const QuerySliceSchema = z.object({
  name: z.string(),
  remoteModels: z.array(z.string()),
  arguments: z.array(ArgumentSchema),
  selections: SelectionSetSchema,
  transform: z.function()
});

const PageQuerySchema = z.object({
  name: z.string(),
  slices: z.array(z.string()),
  argumentMapping: z.record(z.string()),
  document: z.string(),
  registrationId: z.symbol()
});
```

## Constraints

### Performance Constraints
- Transform functions must execute in < 1ms
- Registration lookup must be O(1)
- Document generation must be < 100ms per file

### Memory Constraints
- Registrations use WeakMap for GC
- Maximum 1000 registered documents
- Transform functions must be < 10KB serialized

### Concurrency Constraints
- Registration must be thread-safe
- Transforms must be pure (no shared state)
- Document generation can be parallelized
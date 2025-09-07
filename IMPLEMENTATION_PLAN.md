# Zero-Runtime GraphQL Query Generation Tool - Implementation Plan

## Project Overview

This project aims to create a zero-runtime GraphQL query generation system, similar to how PandaCSS handles CSS-in-JS. The system will allow developers to write GraphQL queries in TypeScript with full type safety, then statically analyze and generate optimized GraphQL documents at build time.

### Key Benefits

- **Zero Runtime Overhead**: All GraphQL document generation happens at build time
- **Type Safety**: Full TypeScript type inference without manual code generation steps
- **Modular Architecture**: Support for Feature-Sliced Design with fine-grained dependency management
- **Advanced Patterns**: Enable parameterized fragments and other advanced concepts outside GraphQL spec
- **Improved DX**: No need for frequent codegen runs during development

## Core Concepts

### 1. Remote Models

Remote Models define the shape of data fetched from GraphQL types, similar to fragments but with built-in transformation logic.

### 2. Query/Mutation/Subscription Slices

Slices are modular units that define specific GraphQL operations scoped to entities or features.

### 3. Page Queries

Page Queries combine multiple slices to create complete GraphQL documents for specific pages or components.

## Runtime Behavior Specification

### Expected Runtime Code Structure

#### Fragment Definition Runtime

```typescript
// Runtime: Type-safe fragment definition with transformation
// Pattern 1: Simple object selection
const userFragmentSimple = gql.model(
  "User",
  {
    id: true,
    name: true,
    email: true,
  },
  (data) => ({
    id: data.id,
    displayName: data.name.toUpperCase(),
    email: data.email,
  })
);

// Pattern 2: Function returning selection (for consistency/lazy evaluation)
const userFragment = gql.model(
  "User",
  () => ({
    id: true,
    name: true,
    email: true,
    posts: {
      id: true,
      title: true,
    },
  }),
  (data) => ({
    id: data.id,
    displayName: data.name.toUpperCase(),
    email: data.email,
    postCount: data.posts.length,
  })
);

// Type inference should work seamlessly
type User = gql.infer<typeof userFragment>;
// Results in: { id: string; displayName: string; email: string; postCount: number; }

// Parameterized fragments with relation builder
const postFragment = gql.model(
  [
    "Post",
    {
      includeAuthor: gql.arg.boolean().default(false),
      commentLimit: gql.arg.int().optional(),
      // Using gql.input.fromQuery to extract input types
      ...gql.input.fromQuery("posts.comments", {
        prefix: "comments_",
        pick: { where: true, limit: true, orderBy: true },
      }),
    },
  ],
  (relation, args) => ({
    // First param is 'relation', not 'fields'
    id: true,
    title: true,
    content: true,
    ...(args.includeAuthor && {
      author: relation("author", userFragment()), // Fragments can be invoked
    }),
    ...(args.commentLimit && {
      comments: relation(
        [
          "comments",
          {
            limit: args.commentLimit,
            where: args.comments_where,
            orderBy: args.comments_orderBy,
          },
        ],
        commentFragment()
      ),
    }),
  }),
  (data) => ({
    id: data.id,
    title: data.title,
    content: data.content,
    author: data.author ? userFragment.transform(data.author) : null,
    comments: data.comments?.map((c) => commentFragment.transform(c)) ?? [],
  })
);

// Using parameterized fragments
const detailedPost = postFragment({
  includeAuthor: true,
  commentLimit: 10,
});
```

#### Query Slice Runtime

```typescript
// Runtime: Define reusable query slices
const getUserSlice = gql.querySlice(
  ["getUser", { id: gql.arg.uuid() }],
  (query, args) => ({
    user: query(["user", { id: args.id }], userFragment),
  }),
  (data) => data.user
);

// Slices can compose other slices - note the argument name stays generic
const getPostWithAuthor = gql.querySlice(
  ["getPost", { id: gql.arg.uuid() }], // Using 'id' instead of 'postId'
  (query, args) => ({
    post: query(["post", { id: args.id }], {
      ...postFragment({ includeAuthor: true }),
      author: getUserSlice.fragment,
    }),
  })
);
```

#### Page Query Composition Runtime

```typescript
// Runtime: Compose multiple slices into page queries
const pageQuery = gql.query(
  [
    "PostDetailPage",
    {
      postId: gql.arg.uuid(),
      commentLimit: gql.arg.int().optional(),
    },
  ],
  (_, args) => ({
    // Slice arguments can be mapped to different names in the page query
    post: getPostSlice({
      id: args.postId, // Mapping 'postId' from page query to 'id' in slice
      commentLimit: args.commentLimit ?? 10,
    }),
    relatedPosts: getRelatedPostsSlice({
      id: args.postId, // Same mapping flexibility
    }),
    currentUser: getCurrentUserSlice(),
  })
);

// Usage with React hooks
const { data, loading } = useQuery(pageQuery, {
  variables: { postId: "123", commentLimit: 20 },
});
```

#### Static Analysis Output and Document Hoisting

After static analysis, queries are hoisted to prevent re-evaluation:

**Original Code (before transformation):**

```typescript
// src/components/PostDetail.tsx
export function PostDetailComponent({ postId }: Props) {
  // Query defined inside component
  const { data } = useQuery(
    gql.query(["PostDetail", { postId: gql.arg.uuid() }], (_, args) => ({
      post: getPostSlice({ id: args.postId }),
    })),
    { variables: { postId } }
  );

  return <div>{data.post.title}</div>;
}
```

**Transformed Code (after build):**

```typescript
// src/components/PostDetail.tsx

// GraphQL document hoisted and registered at module level
const __gql_PostDetail_query = __gqlRegistry.register({
  id: "PostDetail_query_a1b2c3d4",
  document: `
    query PostDetail($postId: UUID!) {
      post(id: $postId) {
        id
        title
        content
      }
    }
  `,
  operationName: "PostDetail",
  variables: ["postId"],
  fragments: ["PostFragment_a1b2c3d4"],
});

export function PostDetailComponent({ postId }: Props) {
  // Component now references the registered query
  const { data } = useQuery(__gql_PostDetail_query, { variables: { postId } });

  return <div>{data.post.title}</div>;
}
```

**Registry Implementation:**

```typescript
// Generated registry module (runtime)
const __gqlRegistry = (() => {
  const documents = new Map<string, RegisteredDocument>();

  return {
    register(doc: DocumentDefinition): RegisteredDocument {
      if (!documents.has(doc.id)) {
        documents.set(doc.id, {
          ...doc,
          // Parse once at registration
          parsed: parseGraphQL(doc.document),
          // Create reusable document node
          documentNode: gql`
            ${doc.document}
          `,
        });
      }
      return documents.get(doc.id)!;
    },

    get(id: string): RegisteredDocument | undefined {
      return documents.get(id);
    },
  };
})();
```

This approach ensures:

- GraphQL documents are parsed only once at module load time
- No re-evaluation in React render cycles
- Better performance in hot module replacement (HMR)
- Easier debugging with stable document IDs

### Runtime API Design Principles

1. **Composability First**: All components (fragments, slices, queries) should be composable
2. **Type Inference**: Minimize explicit type annotations through powerful inference
3. **Progressive Enhancement**: Simple use cases should be simple, complex ones possible
4. **Build-Time Optimization**: Runtime code focuses on type safety and DX, optimization happens at build
5. **Framework Agnostic**: Core runtime should work with any GraphQL client

## Implementation Architecture

### Package Structure

```
packages/
├── @soda-gql/core           # Core runtime API and type system
├── @soda-gql/analyzer        # Static analysis engine
├── @soda-gql/generator       # GraphQL document generation
├── @soda-gql/cli            # Command-line interface
├── @soda-gql/vite-plugin    # Vite integration
├── @soda-gql/webpack-plugin  # Webpack integration
└── @soda-gql/react          # React-specific utilities
```

### Phase 1: Core Type System (Week 1-2)

#### Package: `@soda-gql/core`

**Objectives:**

- Implement type-safe fragment definition system
- Create powerful type inference utilities
- Build argument type builders

**Key Components:**

```typescript
// src/types.ts - Core type definitions
type Fragment<T, R, Args = void> = {
  __type: T;
  __result: R;
  __args: Args;
  definition: FragmentDefinition;
  transform: (data: T) => R;
  // Callable with no args (for consistency) or with args (when parameterized)
  (): Args extends void ? Fragment<T, R, void> : never;
  (args: Args): AppliedFragment<T, R>;
};

type AppliedFragment<T, R> = {
  __type: T;
  __result: R;
  definition: FragmentDefinition;
  transform: (data: T) => R;
};

// src/fragment.ts - Fragment builder (overloaded for all patterns)
// Pattern 1: Simple object selection
function fragment<T, S, R>(
  typeName: string,
  selection: S,
  transform: (data: Infer<T, S>) => R
): Fragment<T, R, void>;

// Pattern 2: Function returning selection (for consistency)
function fragment<T, S, R>(
  typeName: string,
  selection: () => S,
  transform: (data: Infer<T, S>) => R
): Fragment<T, R, void>;

// Pattern 3: Parameterized with relation builder
function fragment<T, Args, S, R>(
  definition: [string, ArgsDefinition<Args>],
  selection: (relation: RelationBuilder<T>, args: Args) => S,
  transform: (data: Infer<T, S>) => R
): Fragment<T, R, Args>;

// src/inference.ts - Type inference utilities
type Infer<F> = F extends Fragment<any, infer R, any>
  ? R
  : F extends AppliedFragment<any, infer R>
  ? R
  : never;
```

**Testing Strategy (TDD):**

1. Write failing tests for type inference
2. Implement minimal type system
3. Add tests for nested fragments
4. Implement composition
5. Test edge cases (circular refs, unions, interfaces)

### Phase 2: Query/Mutation System (Week 2-3)

#### Package: `@soda-gql/core` (continued)

**Objectives:**

- Implement query/mutation slice builders
- Create slice composition system
- Build page query aggregator

**Key Components:**

```typescript
// src/slice.ts
function querySlice<Args, Result>(
  name: string | [string, ArgsDefinition<Args>],
  query: (q: QueryBuilder, args: Args) => QuerySelection,
  transform?: (data: any) => Result
): QuerySlice<Args, Result>;

// src/query.ts
function query<Args, Slices>(
  name: string | [string, ArgsDefinition<Args>],
  composer: (builder: QueryBuilder, args: Args) => Slices
): Query<Args, InferSlices<Slices>>;
```

**Testing Strategy:**

1. Test basic slice creation
2. Test argument passing and validation
3. Test slice composition
4. Test complex nested queries
5. Test error cases

### Phase 3: Static Analysis and Transform (Week 3-4)

#### Package: `@soda-gql/analyzer`

**Objectives:**

- Parse TypeScript AST to extract GraphQL operations
- Analyze dependencies between fragments and slices
- Build operation registry
- Transform code to hoist query documents

**Key Components:**

```typescript
// src/parser.ts
class ASTParser {
  parseFile(filePath: string): ParsedOperations;
  extractFragments(): Fragment[];
  extractSlices(): Slice[];
  extractQueries(): Query[];
}

// src/analyzer.ts
class DependencyAnalyzer {
  analyze(operations: ParsedOperations): DependencyGraph;
  detectCircular(): CircularDependency[];
  optimize(): OptimizedGraph;
}

// src/transformer.ts - AST transformation for document hoisting
class QueryHoistingTransformer {
  transform(sourceFile: ts.SourceFile): ts.SourceFile {
    const queries = this.findQueryDefinitions(sourceFile);
    const hoisted = this.hoistToModuleLevel(queries);
    return this.replaceWithReferences(sourceFile, hoisted);
  }

  private findQueryDefinitions(node: ts.Node): QueryDefinition[] {
    // Find all gql.query/mutation/subscription calls
  }

  private hoistToModuleLevel(queries: QueryDefinition[]): HoistedQuery[] {
    // Generate unique IDs and create registry calls
    return queries.map((q) => ({
      id: generateStableId(q),
      registryCall: this.createRegistryCall(q),
      reference: this.createReference(q),
    }));
  }

  private createRegistryCall(query: QueryDefinition): ts.Statement {
    // Create __gqlRegistry.register() call
  }
}
```

**Testing Strategy:**

1. Test AST parsing for simple cases
2. Test complex TypeScript patterns
3. Test dependency resolution
4. Test circular dependency detection
5. Test optimization strategies

### Phase 4: Document Generation (Week 4-5)

#### Package: `@soda-gql/generator`

**Objectives:**

- Generate optimized GraphQL documents
- Implement fragment deduplication
- Create operation merging logic

**Key Components:**

```typescript
// src/generator.ts
class DocumentGenerator {
  generateFragment(fragment: Fragment): GraphQLFragment;
  generateQuery(query: Query): GraphQLQuery;
  optimizeDocument(doc: GraphQLDocument): GraphQLDocument;
}

// src/optimizer.ts
class QueryOptimizer {
  deduplicateFragments(fragments: Fragment[]): Fragment[];
  mergeSelections(selections: Selection[]): Selection;
  eliminateUnused(doc: Document): Document;
}
```

**Testing Strategy:**

1. Test basic document generation
2. Test fragment spreading
3. Test variable handling
4. Test optimization passes
5. Snapshot testing for generated documents

### Phase 5: Build Tool Integration (Week 5-6)

#### Package: `@soda-gql/cli` & plugins

**Objectives:**

- Create CLI for standalone usage
- Implement watch mode
- Build Vite/Webpack plugins

**Key Components:**

```typescript
// cli/src/commands/build.ts
class BuildCommand {
  execute(options: BuildOptions): Promise<void>;
  watch(options: WatchOptions): Promise<void>;
}

// vite-plugin/src/index.ts
function sodaGqlPlugin(options?: PluginOptions): Plugin {
  return {
    name: "soda-gql",
    transform(code, id) {
      /* ... */
    },
    buildStart() {
      /* ... */
    },
  };
}
```

**Testing Strategy:**

1. Test CLI commands
2. Test file watching
3. Test plugin integration
4. Test HMR support
5. End-to-end testing

## Technical Decisions

### Type System

- Use TypeScript's template literal types for GraphQL schema representation
- Leverage conditional types for deep type inference
- Use branded types for type safety

### Static Analysis

- Use TypeScript Compiler API for AST parsing
- Implement custom transformer for build-time processing
- Cache analysis results for performance

### Code Generation

- Generate standard GraphQL documents
- Support operation name generation
- Implement smart fragment inlining

### Developer Experience

- Provide detailed error messages with code frames
- Support incremental compilation
- Implement source maps for debugging

## Testing Philosophy (t_wada TDD)

### Test-Driven Development Process

1. **Red Phase**: Write a failing test that describes desired behavior
2. **Green Phase**: Write minimal code to make test pass
3. **Refactor Phase**: Improve code while keeping tests green

### Test Categories

- **Unit Tests**: Individual functions and type inference
- **Integration Tests**: Component interaction
- **E2E Tests**: Full compilation pipeline
- **Snapshot Tests**: Generated GraphQL documents
- **Type Tests**: TypeScript type correctness

### Example Test Flow

```typescript
// 1. RED: Write failing test
test("fragment should infer correct type", () => {
  const fragment = gql.model("User", { id: true, name: true });
  type Result = gql.infer<typeof fragment>;
  // @ts-expect-error - should have id property
  const user: Result = { name: "John" };
});

// 2. GREEN: Implement minimal solution
// 3. REFACTOR: Improve implementation
```

## Performance Considerations

### Build Time

- Incremental compilation support
- Parallel processing of files
- Caching of analysis results
- Minimal AST traversal

### Runtime

- Zero runtime overhead (all processing at build time)
- Tree-shakeable output
- Minimal bundle size impact
- Lazy loading support

## Migration Strategy

### From Existing GraphQL Codegen

1. Gradual migration support (both systems can coexist)
2. Migration guide and codemods
3. Compatibility layer for existing queries
4. Type compatibility with existing codegen

## Coding Standards and Architectural Principles

### Class Usage Guidelines

Classes are only permitted for:

1. **DTOs (Data Transfer Objects)** - Pure data structures with validation
2. **Error definitions** - Custom error classes extending base Error
3. **Pure method collections** - Stateless utility classes with pure functions

Classes are **NOT** permitted for:

- State management
- Singleton patterns
- Service containers
- Dependency injection containers

#### Acceptable Class Usage Examples

```typescript
// ✅ DTO with validation
class FragmentDefinition {
  constructor(
    public readonly name: string,
    public readonly typeName: string,
    public readonly selection: SelectionSet
  ) {
    // Validation only, no state management
    if (!name) throw new Error("Fragment name is required");
    if (!typeName) throw new Error("Type name is required");
  }

  // Pure computed property
  get fragmentName(): string {
    return `${this.typeName}_${this.name}`;
  }
}

// ✅ Error class definition
class GraphQLSystemError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "GraphQLSystemError";
  }
}

// ✅ Pure method collection
class GraphQLDocumentFormatter {
  // All methods are pure functions
  formatQuery(query: QueryNode): string {
    return this.formatOperation("query", query);
  }

  private formatOperation(type: string, node: OperationNode): string {
    // Pure transformation, no side effects
    return `${type} ${node.name} { ... }`;
  }
}
```

### State Management Patterns

Use closures and factory functions to encapsulate mutable state:

```typescript
// ✅ State encapsulation with closure
function createFragmentRegistry() {
  // Private mutable state
  let fragments = new Map<string, FragmentDefinition>();
  let locked = false;

  // Public immutable interface
  return {
    register(fragment: FragmentDefinition): Result<void, RegistryError> {
      if (locked) {
        return err({ type: "REGISTRY_LOCKED" } as const);
      }
      if (fragments.has(fragment.name)) {
        return err({
          type: "DUPLICATE_FRAGMENT",
          name: fragment.name,
        } as const);
      }
      fragments.set(fragment.name, fragment);
      return ok(undefined);
    },

    get(name: string): FragmentDefinition | undefined {
      return fragments.get(name);
    },

    getAll(): ReadonlyArray<FragmentDefinition> {
      return Array.from(fragments.values());
    },

    lock(): void {
      locked = true;
    },

    // For testing only
    _reset(): void {
      fragments = new Map();
      locked = false;
    },
  } as const;
}

// ✅ Scoped mutable state with IIFE
const analyzer = (() => {
  let cache: Map<string, AnalysisResult> | null = null;

  const analyze = (path: string): Result<AnalysisResult, AnalysisError> => {
    // Check cache first
    if (cache?.has(path)) {
      return ok(cache.get(path)!);
    }

    // Perform analysis
    const result = performAnalysis(path);

    // Update cache on success
    if (result.isOk() && cache) {
      cache.set(path, result.value);
    }

    return result;
  };

  const clearCache = () => {
    cache = null;
  };

  const enableCache = () => {
    cache = new Map();
  };

  return { analyze, clearCache, enableCache } as const;
})();
```

### Pure Function Extraction

Extract pure logic for better testability:

```typescript
// ✅ Pure functions extracted for testing
// Pure business logic
export const pure = {
  // Fragment merging logic
  mergeSelections(a: SelectionSet, b: SelectionSet): SelectionSet {
    const merged = new Map([...a.fields, ...b.fields]);
    return { fields: merged };
  },

  // Query variable extraction
  extractVariables(
    operation: OperationNode
  ): ReadonlyArray<VariableDefinition> {
    const variables = new Set<VariableDefinition>();

    const traverse = (node: ASTNode): void => {
      if (node.type === "Variable") {
        variables.add(node.definition);
      }
      node.children?.forEach(traverse);
    };

    traverse(operation);
    return Array.from(variables);
  },

  // Fragment dependency analysis
  analyzeFragmentDependencies(
    fragments: ReadonlyArray<FragmentDefinition>
  ): Result<DependencyGraph, CircularDependencyError> {
    const graph = new Map<string, Set<string>>();

    // Build dependency graph
    for (const fragment of fragments) {
      const deps = extractFragmentReferences(fragment.selection);
      graph.set(fragment.name, new Set(deps));
    }

    // Check for cycles
    const cycle = detectCycle(graph);
    if (cycle) {
      return err({
        type: "CIRCULAR_DEPENDENCY",
        fragments: cycle,
      } as const);
    }

    return ok({ graph });
  },
} as const;

// Impure wrapper that uses pure functions
function createAnalyzer(config: AnalyzerConfig) {
  return {
    async analyzeFile(path: string): Promise<Result<Analysis, AnalysisError>> {
      // IO operation
      const content = await readFile(path);
      if (content.isErr()) return content;

      // Pure transformation
      const ast = pure.parseTypeScript(content.value);
      if (ast.isErr()) return ast;

      // Pure analysis
      const fragments = pure.extractFragments(ast.value);
      const dependencies = pure.analyzeFragmentDependencies(fragments);

      return dependencies;
    },
  };
}
```

### Testing Strategy for Pure Functions

```typescript
// Easy to test pure functions
describe("pure.mergeSelections", () => {
  it("should merge non-overlapping selections", () => {
    const a = {
      fields: new Map([
        ["id", true],
        ["name", true],
      ]),
    };
    const b = { fields: new Map([["email", true]]) };

    const result = pure.mergeSelections(a, b);

    expect(result.fields.size).toBe(3);
    expect(result.fields.has("id")).toBe(true);
    expect(result.fields.has("name")).toBe(true);
    expect(result.fields.has("email")).toBe(true);
  });

  it("should override duplicate fields", () => {
    const a = {
      fields: new Map([
        ["id", true],
        ["name", true],
      ]),
    };
    const b = {
      fields: new Map([
        ["name", false],
        ["email", true],
      ]),
    };

    const result = pure.mergeSelections(a, b);

    expect(result.fields.get("name")).toBe(false);
  });
});

describe("pure.analyzeFragmentDependencies", () => {
  it("should detect circular dependencies", () => {
    const fragments = [
      new FragmentDefinition("A", "User", { references: ["B"] }),
      new FragmentDefinition("B", "User", { references: ["C"] }),
      new FragmentDefinition("C", "User", { references: ["A"] }),
    ];

    const result = pure.analyzeFragmentDependencies(fragments);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.type).toBe("CIRCULAR_DEPENDENCY");
      expect(result.error.fragments).toEqual(["A", "B", "C"]);
    }
  });
});
```

## Technical Implementation Details

### Error Handling Strategy

Using `neverthrow` for type-safe error handling throughout the internal implementation:

```typescript
// src/analyzer/parser.ts - Example of type-safe file reading
import { z } from "zod";
import { Result, ok, err } from "neverthrow";

// Schema definitions for configuration
const ConfigSchema = z.object({
  schemaPath: z.string(),
  outputPath: z.string().optional(),
  watch: z.boolean().default(false),
  generateRuntime: z.boolean().default(true),
});

type Config = z.infer<typeof ConfigSchema>;

// Discriminated unions for detailed error types
type ParseError =
  | { type: "FILE_NOT_FOUND"; path: string }
  | { type: "INVALID_SYNTAX"; line: number; column: number; message: string }
  | { type: "SCHEMA_VALIDATION_FAILED"; errors: z.ZodError };

type AnalysisError =
  | { type: "CIRCULAR_DEPENDENCY"; fragments: string[] }
  | { type: "UNDEFINED_FRAGMENT"; name: string; location: string }
  | { type: "TYPE_MISMATCH"; expected: string; actual: string };

// Internal implementation with Result types
class ConfigLoader {
  load(path: string): Result<Config, ParseError> {
    return (() => {
      const content = this.readFileSync(path);
      if (!content) {
        return err({ type: "FILE_NOT_FOUND", path } as const);
      }

      const parsed = this.parseJson(content);
      if (parsed.isErr()) {
        return err({
          type: "INVALID_SYNTAX",
          ...parsed.error,
        } as const);
      }

      const validated = ConfigSchema.safeParse(parsed.value);
      if (!validated.success) {
        return err({
          type: "SCHEMA_VALIDATION_FAILED",
          errors: validated.error,
        } as const);
      }

      return ok(validated.data);
    })();
  }

  private readFileSync(path: string): string | null {
    // Implementation
  }

  private parseJson(
    content: string
  ): Result<unknown, { line: number; column: number; message: string }> {
    // Implementation using IIFE to avoid try-catch nesting
    return (() => {
      const lines = content.split("\n");
      // Custom JSON parser that returns Result type
      // No try-catch, no type casting
    })();
  }
}
```

### GraphQL System Module Generation

The `@/gql-system` module referenced in examples is auto-generated based on the GraphQL schema:

#### Generated Module Structure

```typescript
// Generated: gql-system/index.ts
export const gql = {
  // Fragment builder with full type inference
  fragment: createFragmentBuilder(schemaTypes),

  // Query/Mutation/Subscription slice builders
  querySlice: createQuerySliceBuilder(schemaTypes),
  mutationSlice: createMutationSliceBuilder(schemaTypes),
  subscriptionSlice: createSubscriptionSliceBuilder(schemaTypes),

  // Page-level query/mutation builders
  query: createQueryBuilder(schemaTypes),
  mutation: createMutationBuilder(schemaTypes),
  subscription: createSubscriptionBuilder(schemaTypes),

  // Argument type builders with validation
  arg: {
    string: () => createArgBuilder(z.string()),
    int: () => createArgBuilder(z.number().int()),
    float: () => createArgBuilder(z.number()),
    boolean: () => createArgBuilder(z.boolean()),
    uuid: () => createArgBuilder(z.string().uuid()),
    // Custom scalars from schema
    timestamptz: () => createArgBuilder(TimestamptzSchema),
  },

  // Input type helpers for complex arguments
  input: {
    fromQuery: createInputFromQuery(schemaTypes),
    fromMutation: createInputFromMutation(schemaTypes),
  },

  // Type inference utility
  infer: {} as InferUtility,
} as const;

// Generated type definitions based on schema
export namespace SchemaTypes {
  // Generated from GraphQL schema types
  export interface User {
    id: string;
    name: string;
    email: string;
    createdAt: string;
    updatedAt: string;
    posts: Post[];
    comments: Comment[];
  }

  export interface Post {
    id: string;
    title: string;
    content: string;
    userId: string;
    published: boolean;
    user: User;
    comments: Comment[];
  }

  // Input types
  export interface UserWhereInput {
    id?: UuidComparisonExp;
    name?: StringComparisonExp;
    // ... etc
  }
}
```

#### Generation Process

1. **Schema Analysis Phase**

```typescript
// Internal implementation with Result types
function analyzeSchema(
  schemaPath: string
): Result<SchemaAnalysis, AnalysisError> {
  return (() => {
    // Parse GraphQL schema file
    const schemaContent = loadSchemaFile(schemaPath);
    if (schemaContent.isErr()) return schemaContent;

    // Validate schema with zod
    const validated = GraphQLSchemaSchema.safeParse(schemaContent.value);
    if (!validated.success) {
      return err({
        type: "SCHEMA_VALIDATION_FAILED",
        errors: validated.error,
      } as const);
    }

    // Extract types, scalars, inputs
    const types = extractTypes(validated.data);
    const scalars = extractScalars(validated.data);
    const inputs = extractInputTypes(validated.data);

    return ok({ types, scalars, inputs });
  })();
}
```

2. **Code Generation Phase**

```typescript
// Generates the gql-system module without exposing Result types
function generateGqlSystem(analysis: SchemaAnalysis): string {
  const typeDefinitions = generateTypeDefinitions(analysis.types);
  const argBuilders = generateArgBuilders(analysis.scalars);
  const apiBuilders = generateApiBuilders();

  return `
    // Auto-generated by soda-gql
    import { z } from 'zod';
    import { 
      createFragmentBuilder,
      createQuerySliceBuilder,
      createQueryBuilder,
      createArgBuilder,
    } from '@soda-gql/runtime';
    
    ${typeDefinitions}
    ${argBuilders}
    ${apiBuilders}
    
    export const gql = {
      fragment: createFragmentBuilder(schemaTypes),
      querySlice: createQuerySliceBuilder(schemaTypes),
      query: createQueryBuilder(schemaTypes),
      arg: argBuilders,
      infer: {} as InferUtility,
    } as const;
  `;
}
```

3. **Runtime API (User-facing)**

```typescript
// Public API - no Result types exposed
export function fragment<T, S, R>(
  typeName: string,
  selection: S,
  transform: (data: Infer<T, S>) => R
): Fragment<T, R, void> {
  // Internal implementation uses Result types
  const result = validateAndCreateFragment(typeName, selection, transform);

  // But public API throws on error (fail-fast for developer)
  if (result.isErr()) {
    throw new GraphQLSystemError(result.error);
  }

  return result.value;
}
```

### Module Resolution Strategy

The `@/gql-system` import is resolved through TypeScript path mapping:

```json
// tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@/gql-system": ["./node_modules/.soda-gql/generated/index.ts"],
      "@/gql-system/*": ["./node_modules/.soda-gql/generated/*"]
    }
  }
}
```

Build tools generate the module to `.soda-gql/generated/` directory, which is:

- Git-ignored by default
- Regenerated on schema changes
- Cached for performance
- Type-checked incrementally

## Success Metrics

- **Type Safety**: 100% type coverage without manual annotations
- **Build Performance**: < 100ms incremental build time
- **Bundle Size**: Zero runtime overhead
- **Developer Experience**: No manual codegen steps required
- **Adoption**: Easy migration from existing solutions

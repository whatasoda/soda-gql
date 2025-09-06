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
const userFragment = gql.fragment(
  "User",
  {
    id: true,
    name: true,
    email: true,
    posts: {
      id: true,
      title: true
    }
  },
  (data) => ({
    id: data.id,
    displayName: data.name.toUpperCase(),
    email: data.email,
    postCount: data.posts.length
  })
);

// Type inference should work seamlessly
type User = gql.infer<typeof userFragment>; 
// Results in: { id: string; displayName: string; email: string; postCount: number; }

// Parameterized fragments for flexible field selection
const postFragment = gql.fragment(
  ["Post", {
    includeAuthor: gql.arg.boolean().default(false),
    commentLimit: gql.arg.int().optional(),
  }],
  (fields, args) => ({
    id: true,
    title: true,
    content: true,
    ...(args.includeAuthor && {
      author: fields.relation("author", userFragment)
    }),
    ...(args.commentLimit && {
      comments: fields.relation(
        ["comments", { limit: args.commentLimit }],
        commentFragment
      )
    })
  }),
  (data) => ({
    id: data.id,
    title: data.title,
    content: data.content,
    author: data.author ? userFragment.transform(data.author) : null,
    comments: data.comments?.map(c => commentFragment.transform(c)) ?? []
  })
);

// Using parameterized fragments
const detailedPost = postFragment({ 
  includeAuthor: true, 
  commentLimit: 10 
});
```

#### Query Slice Runtime
```typescript
// Runtime: Define reusable query slices
const getUserSlice = gql.querySlice(
  ["getUser", { id: gql.arg.uuid() }],
  (query, args) => ({
    user: query(
      ["user", { id: args.id }],
      userFragment
    )
  }),
  (data) => data.user
);

// Slices can compose other slices - note the argument name stays generic
const getPostWithAuthor = gql.querySlice(
  ["getPost", { id: gql.arg.uuid() }],  // Using 'id' instead of 'postId'
  (query, args) => ({
    post: query(
      ["post", { id: args.id }],
      {
        ...postFragment({ includeAuthor: true }),
        author: getUserSlice.fragment
      }
    )
  })
);
```

#### Page Query Composition Runtime
```typescript
// Runtime: Compose multiple slices into page queries
const pageQuery = gql.query(
  ["PostDetailPage", {
    postId: gql.arg.uuid(),
    commentLimit: gql.arg.int().optional()
  }],
  (_, args) => ({
    // Slice arguments can be mapped to different names in the page query
    post: getPostSlice({ 
      id: args.postId,  // Mapping 'postId' from page query to 'id' in slice
      commentLimit: args.commentLimit ?? 10 
    }),
    relatedPosts: getRelatedPostsSlice({ 
      id: args.postId  // Same mapping flexibility
    }),
    currentUser: getCurrentUserSlice()
  })
);

// Usage with React hooks
const { data, loading } = useQuery(pageQuery, {
  variables: { postId: "123", commentLimit: 20 }
});
```

#### Static Analysis Output
After static analysis, the above code should generate:
```graphql
query PostDetailPage($postId: UUID!, $commentLimit: Int) {
  post(id: $postId) {
    id
    title
    content
    author {
      id
      name
      email
    }
    comments(limit: $commentLimit) {
      id
      content
      createdAt
    }
  }
  relatedPosts(postId: $postId) {
    id
    title
    slug
  }
  currentUser {
    id
    name
    avatar
  }
}
```

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
  // Callable when parameterized
  (args: Args): AppliedFragment<T, R>;
};

type AppliedFragment<T, R> = {
  __type: T;
  __result: R;
  definition: FragmentDefinition;
  transform: (data: T) => R;
};

// src/fragment.ts - Fragment builder (overloaded for parameters)
function fragment<T, S, R>(
  typeName: string,
  selection: S,
  transform: (data: Infer<T, S>) => R
): Fragment<T, R, void>;

function fragment<T, Args, S, R>(
  definition: [string, ArgsDefinition<Args>],
  selection: (fields: FieldSelector<T>, args: Args) => S,
  transform: (data: Infer<T, S>) => R
): Fragment<T, R, Args>;

// src/inference.ts - Type inference utilities
type Infer<F> = F extends Fragment<any, infer R, any> ? R : 
                F extends AppliedFragment<any, infer R> ? R : never;
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

### Phase 3: Static Analysis (Week 3-4)

#### Package: `@soda-gql/analyzer`

**Objectives:**
- Parse TypeScript AST to extract GraphQL operations
- Analyze dependencies between fragments and slices
- Build operation registry

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
    name: 'soda-gql',
    transform(code, id) { /* ... */ },
    buildStart() { /* ... */ }
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
test('fragment should infer correct type', () => {
  const fragment = gql.fragment('User', { id: true, name: true });
  type Result = gql.infer<typeof fragment>;
  // @ts-expect-error - should have id property
  const user: Result = { name: 'John' };
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

## Success Metrics

- **Type Safety**: 100% type coverage without manual annotations
- **Build Performance**: < 100ms incremental build time
- **Bundle Size**: Zero runtime overhead
- **Developer Experience**: No manual codegen steps required
- **Adoption**: Easy migration from existing solutions
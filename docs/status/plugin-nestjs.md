# @soda-gql/plugin-nestjs - Current Status

> **🚨 DEPRECATED**: This package has been split into separate packages in v0.1.0:
> - **`@soda-gql/plugin-tsc`** - TypeScript compiler plugin for NestJS
> - **`@soda-gql/plugin-swc`** - SWC compiler plugin for NestJS
> - **`@soda-gql/plugin-webpack`** - Webpack loader and plugin (includes NestJS utilities)
>
> This document is kept for historical reference only. Please refer to individual package documentation.

**Release Target**: v0.1.0 (Pre-release)
**Implementation Level**: 🔶 **Minimal (Detection-only)**
**Last Updated**: 2025-10-19 (marked as deprecated)

> ⚠️ **Pre-release Warning**: This plugin is under active development. The compiler plugins (TypeScript/SWC) currently provide infrastructure and detection but do not perform full AST transformation yet. See [Gaps](#gaps--not-yet-supported) below.

**Related Documentation**:
- [Plugin Plan](../plans/plugin-ecosystem/plugin-nestjs.md)
- [Package README](../../packages/plugin-nestjs/README.md)
- [Examples](../../examples/README.md)

---

## Snapshot

The `@soda-gql/plugin-nestjs` package provides three integration methods for NestJS applications:

1. **TypeScript Compiler Plugin** - Webpack-free, works with `nest build` using `tsc`
2. **SWC Compiler Plugin** - Ultra-fast builds with SWC compiler
3. **Webpack Plugin** - Mature implementation with integrated watch mode

**Current State**: TypeScript and SWC adapters are **minimal implementations** - they successfully detect `gql.default` calls with operations and establish transformation infrastructure, but do not yet perform full AST replacement or runtime code elimination.

---

## Capabilities Today

### ✅ Infrastructure & Detection

**TypeScript Adapter** (`packages/plugin-shared/src/adapters/typescript-adapter.ts:66`):
- ✅ Detects `gql.default(({ operation }) => operation.query(...))` and similar patterns
- ✅ Mode gating (`runtime` vs `zero-runtime`)
- ✅ AST traversal and node identification
- ✅ Transformer factory integration with Nest CLI

**SWC Adapter** (`packages/plugin-shared/src/adapters/swc-adapter.ts:60`):
- ✅ Detects same operation patterns as TypeScript adapter
- ✅ SWC AST node construction (plain object literals)
- ✅ Handles SWC-specific type differences (`ImportDeclaration.imported`, `MemberExpression.property`)
- ✅ Transformer factory integration with Nest CLI

**Coordinator Integration** (`packages/plugin-nestjs/src/compiler/core/prepare-transform-state.ts:54`):
- ✅ Coordinator-based artifact management (no file I/O)
- ✅ Synchronous bridge for async coordinator operations via `blocking.ts`
- ✅ Module-level consumer caching with automatic subscriptions
- ✅ Error handling for missing/invalid configs
- ✅ Structured error reporting via `PluginError`

**Nest CLI Integration**:
- ✅ TypeScript transformer entry point (`packages/plugin-nestjs/src/compiler/tsc/transformer.ts:61`)
- ✅ SWC plugin entry point (`packages/plugin-nestjs/src/compiler/swc/transformer.ts:63`)
- ✅ Configuration via `nest-cli.json` with `plugins` or `swcPlugins`

**Webpack Integration** (`packages/plugin-nestjs/src/webpack/plugin.ts:1`):
- ✅ Full implementation with AST transformation
- ✅ Automatic artifact generation during build
- ✅ Development mode error reporting
- ✅ Hot module replacement support
- ✅ `withSodaGql` configuration helper (`packages/plugin-nestjs/src/config/with-soda-gql.ts:1`)

---

## Gaps / Not Yet Supported

### ❌ Transformation & Code Generation

**Compiler Plugins (TypeScript/SWC)**:
- ❌ **Full AST replacement** - Adapters return original AST unchanged
  - See TODO comments: `packages/plugin-shared/src/adapters/typescript-adapter.ts:55`
  - Integration tests expect unmodified output: `tests/integration/plugin-nestjs/compiler/tsc.test.ts:48`
- ❌ **Runtime code elimination** - No pruning of original `gql` calls
- ❌ **Runtime import insertion** - Detection only, no `import { gqlRuntime }` generation
- ❌ **Zero-runtime execution** - Operations still evaluated at runtime

**Operation Types**:
- ❌ `gql.model()` - Not detected or transformed
- ❌ Slice definitions within `gql.default(({ slice }) => ...)` - Not detected separately
- ✅ Only `gql.default(({ operation }) => operation.*)` calls are detected (supported kinds: `["query", "mutation", "subscription", "fragment"]`)
  - See: `packages/plugin-shared/src/adapters/typescript-adapter.ts:164`

---

## Known Limitations & Workarounds

### 1. Synchronous Coordinator Access

**Limitation**: Transformer APIs require synchronous execution, but coordinator operations are async.

**Solution**: Blocking bridge using `SharedArrayBuffer` + `Atomics.wait()`.

**Requirements**:
- Node.js >= 16 (for SharedArrayBuffer support)
- Main thread only (blocking operations not suitable for workers)

**Impact**:
- Initial coordinator setup blocks main thread during transformation
- Subsequent calls use cached coordinator consumer
- Automatic subscription keeps cache synchronized with artifact updates

**Code Reference**:
- `packages/plugin-nestjs/src/compiler/core/blocking.ts:35` - Synchronous bridge
- `packages/plugin-nestjs/src/compiler/core/prepare-transform-state.ts:54` - Coordinator integration

### 2. Minimal Adapter Implementation

**Limitation**: Current adapters are intentional stubs for infrastructure validation.

**Impact**:
- `zero-runtime` mode still emits original `gql` calls
- No build-time performance benefits yet
- Runtime mode fallback required

**Evidence**: Integration tests acknowledge stub state:
```typescript
// tests/integration/plugin-nestjs/compiler/tsc.test.ts:48
// Note: Current TypeScript adapter is minimal implementation
// It detects gql.default calls but doesn't perform actual transformation yet
expect(emittedCode).toContain("gql.default");
expect(emittedCode).toContain("operation.query");
```

**Next Milestone**: v0.1.0 will add full AST replacement + runtime IR emission

### 3. Test Coverage

**Current State**: Integration tests guard "no crash" scenarios only.

**What's Tested**:
- ✅ Plugin loads without errors
- ✅ Detection logic identifies operations
- ✅ Build completes successfully
- ✅ Original code passes through unchanged

**Not Tested**:
- ❌ Transformation correctness (no transformation yet)
- ❌ Runtime code elimination
- ❌ Generated runtime imports

---

## Architecture Snapshot

### TypeScript Adapter Flow

**Entry Point**: `packages/plugin-nestjs/src/compiler/tsc/transformer.ts:62`

```
nest build (tsc mode)
    ↓
createSodaGqlTransformer(program, config)
    ↓
prepareTransformState({ configPath, project, importIdentifier })
    ├─ runPromiseSync(() => preparePluginState(...)) → Block on async coordinator
    ├─ registerConsumer(coordinatorKey) → Create consumer with ref counting
    ├─ consumer.ensureLatest() → Get latest artifact snapshot
    └─ Subscribe to coordinator events for cache updates
    ↓
TypeScriptTransformAdapterFactory.create({ sourceFile, context, typescript })
    ↓
adapter.transformProgram(context)
    ├─ Traverse AST with ts.visitEachChild
    ├─ detectGqlOperationCall() → Identify gql.default with operation composition
    ├─ TODO: analyzeCallExpression() → Extract operation metadata
    └─ TODO: transformCallExpression() → Replace with runtime registration
    ↓
Return original SourceFile (no changes yet)
```

**Key Files**:
- `packages/plugin-nestjs/src/compiler/tsc/transformer.ts` - Plugin factory
- `packages/plugin-shared/src/adapters/typescript-adapter.ts` - AST transformation logic
- `packages/plugin-nestjs/src/compiler/core/prepare-transform-state.ts` - Coordinator integration
- `packages/plugin-nestjs/src/compiler/core/blocking.ts` - Synchronous bridge

### SWC Adapter Flow

**Entry Point**: `packages/plugin-nestjs/src/compiler/swc/transformer.ts:64`

```
nest build (swc mode)
    ↓
createSodaGqlSwcPlugin(config)
    ↓
prepareTransformState({ configPath, project, importIdentifier })
    ├─ runPromiseSync(() => preparePluginState(...)) → Block on async coordinator
    ├─ registerConsumer(coordinatorKey) → Create consumer with ref counting
    ├─ consumer.ensureLatest() → Get latest artifact snapshot
    └─ Subscribe to coordinator events for cache updates
    ↓
SwcTransformAdapterFactory.create({ module, swc, filename })
    ↓
adapter.transformProgram(context)
    ├─ Traverse AST with swc visitor pattern
    ├─ detectGqlOperationCall() → Identify gql.default with operation composition
    ├─ Handle SWC-specific types (MemberExpression.property, ImportDeclaration.imported)
    ├─ TODO: analyzeCallExpression() → Extract operation metadata
    └─ TODO: transformCallExpression() → Replace with runtime registration
    ↓
Return original Module (no changes yet)
```

**Key Differences from TypeScript**:
- Uses plain object literals for node construction (no factory)
- `MemberExpression.property` is `Identifier | ComputedPropName` (no `computed` boolean)
- `ImportDeclaration.imported` is `undefined` for default imports (not `null`)

**Key Files**:
- `packages/plugin-nestjs/src/compiler/swc/transformer.ts` - Plugin factory
- `packages/plugin-shared/src/adapters/swc-adapter.ts` - AST transformation logic
- Same coordinator integration as TypeScript

### Webpack Plugin (Mature Implementation)

**Entry Point**: `packages/plugin-nestjs/src/webpack/loader.ts:1`

This is a **fully functional** implementation that:
- ✅ Performs complete AST transformation
- ✅ Generates runtime registrations
- ✅ Eliminates original `gql` calls
- ✅ Supports integrated watch mode
- ✅ Auto-generates artifacts during build

**Delegation**: Re-exports from `@soda-gql/plugin-webpack`:
```typescript
// packages/plugin-nestjs/src/webpack/plugin.ts:1
export { SodaGqlWebpackPlugin } from '@soda-gql/plugin-webpack';
```

---

## Example Coverage

### Working Examples

1. **nestjs-compiler-tsc** (`examples/nestjs-compiler-tsc/`)
   - Demonstrates TypeScript compiler plugin configuration
   - Full NestJS application with GraphQL operations
   - **Current Behavior**: Build succeeds, operations evaluated at runtime (detection-only)

2. **nestjs-compiler-swc** (`examples/nestjs-compiler-swc/`)
   - Demonstrates SWC compiler plugin configuration
   - Same application structure as TSC example
   - **Current Behavior**: Build succeeds with faster compilation, runtime evaluation

3. **nestjs-app** (`examples/nestjs-app/`)
   - Demonstrates webpack plugin (full transformation)
   - **Current Behavior**: Zero-runtime transformation working

### How to Reproduce Detection

```bash
# From repository root
cd examples/nestjs-compiler-tsc

# Generate GraphQL system
bun run codegen

# Build (plugin uses coordinator for in-memory artifacts)
bun run build

# Check output - original gql.default calls remain
grep -r "gql.default" dist/
grep -r "operation.query" dist/
```

**Expected**: Build completes without errors, but `dist/` contains original `gql.default` and `operation.query/mutation` calls.

**Note**: No separate artifact generation step needed - coordinator manages artifacts in-memory.

---

## Communication of "Minimal Implementation"

We use a consistent **🔶 Minimal (Detection-only)** badge across documentation to set accurate expectations:

- **README**: Top-level status block with badge
- **Status Doc** (this file): Detailed breakdown with code references
- **Examples**: README notes clarifying detection-only behavior
- **Tests**: Comments acknowledging stub state

### Verbatim TODO References

From `packages/plugin-shared/src/adapters/typescript-adapter.ts:45`:
```typescript
// TODO: Implement full transformation logic
// Current implementation is minimal - detection only
// Next steps:
// 1. Analyze detected operation calls
// 2. Extract metadata for runtime registration
// 3. Replace calls with runtime imports and registrations
// 4. Validate transformation correctness
```

### Setting Expectations

**In Documentation**:
> "Build succeeds; operations are still runtime-evaluated until v0.1.0."

**In Test Comments**:
```typescript
// Note: Current adapter is minimal implementation
// It detects gql.operation calls but doesn't perform transformation yet
```

---

## Next Steps

### Immediate (v0.1.0)

1. **Implement AST Replacement**
   - Replace `gql.default(({ operation }) => ...)` calls with runtime registrations
   - Generate `import { gqlRuntime } from '@soda-gql/core/runtime'`
   - Emit operation metadata from artifact

2. **Add Runtime IR Emission**
   - Use artifact data to generate registration calls
   - Handle variable bindings and type information
   - Validate against operation schema

3. **Expand Test Coverage**
   - Add transformation correctness tests
   - Verify runtime elimination
   - Test error scenarios

### Future Enhancements

- Support `gql.model()` transformations
- Support slice definitions within `gql.default(({ slice }) => ...)`
- Async artifact loading (investigate transformer API limitations)
- Performance benchmarks (TypeScript vs SWC vs Webpack)
- Watch mode integration for compiler plugins

---

## Testing Notes

**Current Integration Tests** (`tests/integration/plugin-nestjs/compiler/`):

**What They Guard**:
- Plugin loads without crashing
- Detection logic runs successfully
- Build completes with exit code 0
- Original AST passes through unchanged

**Contribution Opportunity**: Tests are ready for transformation assertions once adapters implement full replacement logic.

---

## Support

- **Issues**: [GitHub Issues](https://github.com/anthropics/soda-gql/issues)
- **Discussions**: [GitHub Discussions](https://github.com/anthropics/soda-gql/discussions)
- **Examples**: See `examples/` directory for working integrations
- **Plan Document**: [Plugin Ecosystem Plan](../plans/plugin-ecosystem/plugin-nestjs.md)

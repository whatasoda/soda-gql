# PE-Shared: Shared Abstraction Layer

**Task ID**: PE-Shared
**Status**: Planned
**Duration**: 5-6 days
**Dependencies**: [PL-1: Foundation Portability](../core-platform/foundation-portability.md)

---

## Background

The existing `plugin-babel` contains bundler-agnostic logic that should be extracted into a reusable shared package to avoid duplication across Vite, Metro, and NestJS plugins.

---

## Goals

1. Extract reusable abstractions from `plugin-babel`
2. Create `@soda-gql/plugin-shared` package
3. Refactor `plugin-babel` to use shared layer
4. Establish patterns for plugin implementations

---

## Entry Criteria

- [ ] PL-1 complete (portability layer available)
- [ ] `plugin-babel` tests passing
- [ ] Understanding of what needs to be shared

---

## Tasks

### 1. Options Normalization (`src/options.ts`)

**File**: `packages/plugin-shared/src/options.ts`

```typescript
export interface SodaGqlPluginOptions {
  mode: 'runtime' | 'zero-runtime'
  importIdentifier?: string
  diagnostics?: 'console' | 'json' | 'off'
  artifactSource:
    | { type: 'file'; path: string }
    | { type: 'builder'; config: BuilderConfig }
}

export function normalizePluginOptions(
  options: Partial<SodaGqlPluginOptions>
): Result<NormalizedOptions, PluginError>
```

**Extracts from**:
- `packages/plugin-babel/src/options.ts:1` - Option defaults and validation
- Artifact source discriminated union handling

---

### 2. State Management (`src/state.ts`)

**File**: `packages/plugin-shared/src/state.ts`

```typescript
export interface PluginState {
  artifact: BuilderArtifact
  options: NormalizedOptions
  diagnostics: DiagnosticCollector
}

export function prepareArtifactState(
  options: NormalizedOptions
): Result<PluginState, PluginError>
```

**Extracts from**:
- `packages/plugin-babel/src/state.ts:1` - Artifact loading (file/builder)
- Error mapping to `PluginError` variants

---

### 3. Cache Layer (`src/cache.ts`)

**File**: `packages/plugin-shared/src/cache.ts`

```typescript
export class PluginCache {
  private artifactHash: string
  private builderService?: BuilderService

  // Memoize artifact by config hash
  async getOrLoadArtifact(
    options: NormalizedOptions
  ): Result<BuilderArtifact, PluginError>

  // Invalidate on file changes
  invalidate(changedFiles: string[]): void
}
```

**Features**:
- Hash-based artifact caching
- Singleton `BuilderService` per plugin instance
- Watch mode invalidation

---

### 4. Transform Abstraction (`src/transform/index.ts`)

**File**: `packages/plugin-shared/src/transform/index.ts`

```typescript
export interface TransformContext {
  artifact: BuilderArtifact
  options: NormalizedOptions
  filePath: string
  source: string
}

export interface TransformResult {
  code: string
  map?: SourceMap
  diagnostics: Diagnostic[]
}

// AST-agnostic transformer interface
export interface Transformer {
  transform(context: TransformContext): Result<TransformResult, PluginError>
}
```

**Extracts from**:
- Runtime call builders from `packages/plugin-babel/src/transform/runtime-builders.ts:1`
- Common transformation logic

---

### 5. Error Handling (`src/errors.ts`)

**File**: `packages/plugin-shared/src/errors.ts`

```typescript
export type PluginError =
  | { type: 'InvalidOptions'; details: string }
  | { type: 'ArtifactLoadFailed'; path: string; cause: Error }
  | { type: 'BuilderFailed'; config: BuilderConfig; cause: Error }
  | { type: 'TransformFailed'; filePath: string; cause: Error }
```

**Uses**:
- neverthrow `Result` types throughout
- Explicit error variants for observability

---

### 6. Refactor plugin-babel

**File**: `packages/plugin-babel/src/plugin.ts`

```typescript
import {
  normalizePluginOptions,
  prepareArtifactState,
  PluginCache,
} from '@soda-gql/plugin-shared'

export function createSodaGqlBabelPlugin(options: SodaGqlPluginOptions) {
  const cache = new PluginCache()

  return {
    name: 'soda-gql',
    visitor: {
      // Use shared state and transform logic
    }
  }
}
```

**Changes**:
- Remove local options/state implementations
- Import from `@soda-gql/plugin-shared`
- Validate existing tests still pass

---

## Exit Criteria

- [ ] `@soda-gql/plugin-shared` package created with all modules
- [ ] `plugin-babel` refactored to use shared layer
- [ ] All `plugin-babel` tests pass (no regressions)
- [ ] Shared package has 100% unit test coverage
- [ ] Documentation updated with usage examples

---

## Validation

### Unit Tests

**File**: `packages/plugin-shared/tests/options.test.ts`

```typescript
describe('normalizePluginOptions', () => {
  it('should set default mode to runtime', () => {
    const result = normalizePluginOptions({})
    expect(result._unsafeUnwrap().mode).toBe('runtime')
  })

  it('should reject invalid artifact source', () => {
    const result = normalizePluginOptions({
      artifactSource: { type: 'builder' } // missing config
    })
    expect(result.isErr()).toBe(true)
  })
})
```

### Integration Tests

Ensure `plugin-babel` works identically before and after refactor:

```typescript
describe('plugin-babel with shared layer', () => {
  it('transforms gql calls identically', async () => {
    const before = await transformWithOldBabel(source)
    const after = await transformWithNewBabel(source)

    expect(after.code).toBe(before.code)
  })
})
```

---

## Rollback Strategy

- Keep original `plugin-babel` code in a separate branch
- Feature flag to switch between old/new implementation
- Can revert shared layer extraction if issues arise

---

## Next Tasks

After PE-Shared completion:
- [PE-Vite: Vite Plugin](./plugin-vite.md)
- [PE-Metro: Metro Plugin](./plugin-metro.md)
- [PE-NestJS: NestJS Plugin](./plugin-nestjs.md)

---

## References

- Original plugin implementation: `packages/plugin-babel/`
- Builder artifact types: `packages/builder/src/types.ts`
- Portability layer: `packages/common/src/portable/`

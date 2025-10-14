# Plugin Architecture Simplification

**Status**: In Progress
**Started**: 2025-10-13
**Target Version**: v0.1.0 (pre-release)

## Overview

This document outlines the refactoring plan to simplify the plugin architecture by removing unnecessary builder injection patterns and consolidating duplicate code between `plugin-shared` and `plugin-babel`.

## Problem Statement

### 1. Unnecessary Builder Injection Complexity

Current plugin interface requires injecting builder configuration:

```typescript
// Current (problematic) pattern
const plugin = sodaGqlPlugin({
  artifactSource: {
    type: 'config',
    config: createTestConfig(...) // Must inject builder config
  }
});
```

**Issues**:
- Plugins assume builder exists but force injection indirection
- `preparePluginState` simply forwards injected config to `createBuilderService`
- Leaks internal builder structure to plugin integration points
- Runtime transformation depends on builder artifacts anyway

### 2. Code Duplication

Duplicate implementations between packages:

| Feature | plugin-shared | plugin-babel |
|---------|---------------|--------------|
| Options normalization | `src/options.ts` | `src/internal/options.ts` |
| Artifact loading | `src/cache.ts` | `src/internal/artifact.ts` |
| State preparation | `src/state.ts` | `src/internal/state.ts` |
| Transform helpers | `src/transform/*` | `src/internal/transform/*` |
| Metadata collection | `src/metadata.ts` | `src/internal/metadata/collector.ts` |
| Runtime builders | `src/runtime.ts` | `src/internal/transform/runtime-builders.ts` |

Tests target duplicated internals, preventing cleanup.

## Goals

1. **Simplify plugin interface** by removing builder injection pattern
2. **Consolidate duplicate code** into `plugin-shared` as single source of truth
3. **Make builder dependency explicit** as a prerequisite
4. **Maintain flexibility** for testing and edge cases
5. **Improve type safety** and maintainability

## Proposed Architecture

### Core Principles

- `@soda-gql/plugin-shared` is the single source of truth
- Plugins assume project builder is available
- Config discovery happens automatically
- Override mechanism for tests/CI remains available

### New Plugin Options Schema

```typescript
interface PluginOptions {
  // Config auto-discovery (default: cwd)
  configPath?: string;
  project?: string;

  // Optional overrides for tests/CI
  artifact?: {
    useBuilder?: boolean; // default: true
    path?: string;        // override artifact location
  };

  // Entry glob tweaks (optional)
  entries?: string[];
}
```

### PluginRuntime (New)

Central runtime that encapsulates:

```typescript
class PluginRuntime {
  // Config discovery
  private async loadConfig(): Promise<ResolvedSodaGqlConfig>

  // Builder service lifecycle
  private createBuilderService(): BuilderService

  // Artifact access via provider
  private artifactProvider: ArtifactProvider

  // Memoized state management
  public getPluginState(): PluginState

  // Rich diagnostics
  public getDiagnostics(): Diagnostic[]
}
```

### ArtifactProvider Abstraction

```typescript
interface ArtifactProvider {
  loadArtifact(): Promise<BuilderArtifact>;
  watchArtifact?(onChange: () => void): Disposable;
}

class BuilderArtifactProvider implements ArtifactProvider {
  constructor(private builderService: BuilderService) {}
  // Builder-backed implementation (default)
}

class FileArtifactProvider implements ArtifactProvider {
  constructor(private artifactPath: string) {}
  // File-based implementation (tests/legacy)
}
```

## Implementation Plan

### Phase 1: Redesign Shared Options Contract

**Files to modify**:
- `packages/plugin-shared/src/types.ts`
- `packages/plugin-shared/src/options.ts`

**Tasks**:
1. Define new `PluginOptions` interface
2. Add config-loading logic using `loadConfigOrThrow`
3. Collapse `artifactSource` discriminated union into simple override
4. Default to builder mode
5. Update option validation

**Breaking Changes**:
- Remove `artifactSource: { type: 'config' | 'file' }` union
- Simplify to `artifact?: { useBuilder?, path? }`

---

### Phase 2: Introduce ArtifactProvider Abstraction

**Files to create**:
- `packages/plugin-shared/src/artifact/provider.ts` (interface)
- `packages/plugin-shared/src/artifact/builder-provider.ts`
- `packages/plugin-shared/src/artifact/file-provider.ts`

**Files to modify**:
- `packages/plugin-shared/src/state.ts`
- `packages/plugin-shared/src/cache.ts`

**Tasks**:
1. Define `ArtifactProvider` interface
2. Implement `BuilderArtifactProvider` (default)
3. Implement `FileArtifactProvider` (test/legacy)
4. Update state preparation to use providers
5. Add provider selection logic based on options

---

### Phase 3: Create PluginRuntime

**Files to create**:
- `packages/plugin-shared/src/runtime/plugin-runtime.ts`
- `packages/plugin-shared/src/runtime/index.ts`

**Files to modify**:
- `packages/plugin-shared/src/index.ts` (export runtime)
- `packages/plugin-shared/src/state.ts` (delegate to runtime)

**Tasks**:
1. Implement `PluginRuntime` class
2. Encapsulate config discovery
3. Manage builder service lifecycle
4. Integrate artifact providers
5. Provide memoized state access
6. Export unified API: `createPluginRuntime(options)`

---

### Phase 4: Update plugin-babel

**Files to delete**:
- `packages/plugin-babel/src/internal/**` (entire directory)

**Files to modify**:
- `packages/plugin-babel/src/plugin.ts`
- `packages/plugin-babel/src/index.ts`
- Test files importing from `internal/`

**Tasks**:
1. Remove `src/internal/**` directory
2. Update imports to use `@soda-gql/plugin-shared`
3. Consume new `PluginRuntime` API
4. Update tests to use shared testing utilities
5. Fix path aliases and imports

**Migration Example**:

```typescript
// Before
import { preparePluginState } from './internal/state';
const state = await preparePluginState({ artifactSource: { type: 'config', config } });

// After
import { createPluginRuntime } from '@soda-gql/plugin-shared/runtime';
const runtime = await createPluginRuntime({ configPath: './soda-gql.config.ts' });
const state = runtime.getPluginState();
```

---

### Phase 5: Update Other Plugins

**Affected packages**:
- `packages/plugin-nestjs`
- Future bundler plugins

**Tasks**:
1. Apply same pattern as plugin-babel
2. Use new shared runtime API
3. Remove builder injection code
4. Update documentation

---

### Phase 6: Testing & Documentation

**Testing**:
- [ ] Unit tests for config resolution
- [ ] Unit tests for artifact providers
- [ ] Contract tests for Babel plugin (builder mode)
- [ ] Contract tests for Babel plugin (file override mode)
- [ ] Contract tests for NestJS plugin
- [ ] Regression tests for zero-runtime transforms
- [ ] Integration tests for full workflow

**Documentation**:
- [ ] Update `packages/plugin-shared/README.md`
- [ ] Update `packages/plugin-babel/README.md`
- [ ] Create migration guide for v0.1.0
- [ ] Document new options schema
- [ ] Document artifact override for CI/tests
- [ ] Add JSDoc comments to public APIs

---

## Testing Strategy

### Shared Testing Utilities

Export from `@soda-gql/plugin-shared/testing`:

```typescript
export {
  createTestArtifact,
  createTestRuntime,
  mockBuilderService,
  // ... other test helpers
};
```

### Test Coverage Requirements

1. **Config Discovery**: Auto-discovery from cwd, custom paths, project selection
2. **Artifact Providers**: Both builder-backed and file-based modes
3. **State Management**: Memoization, cache invalidation, diagnostics
4. **Transform Behavior**: Runtime registration, zero-runtime output
5. **Error Handling**: Missing config, invalid artifact, builder failures

---

## Migration Guide (v0.1.0)

### Breaking Changes

#### 1. Plugin Options Schema

**Before**:
```typescript
sodaGqlPlugin({
  artifactSource: {
    type: 'config',
    config: builderConfig
  }
})
```

**After**:
```typescript
// Default (auto-discovery)
sodaGqlPlugin()

// With custom config path
sodaGqlPlugin({
  configPath: './configs/soda-gql.config.ts'
})

// Test override
sodaGqlPlugin({
  artifact: {
    path: './test-fixtures/artifact.json'
  }
})
```

#### 2. Import Paths

**Before**:
```typescript
import { preparePluginState } from '@soda-gql/plugin-babel/internal/state';
```

**After**:
```typescript
import { createPluginRuntime } from '@soda-gql/plugin-shared/runtime';
```

### Benefits

- **Simpler API**: No need to inject builder configuration
- **Better defaults**: Auto-discovery works out of the box
- **Explicit dependencies**: Builder is a clear prerequisite
- **Less code duplication**: Single source of truth in `plugin-shared`
- **Improved type safety**: Clearer interfaces and contracts

---

## Success Criteria

- [ ] All tests passing with new architecture
- [ ] No duplicate code between plugin packages
- [ ] Plugin options simplified (no builder injection)
- [ ] Config auto-discovery working
- [ ] File override mode working for tests
- [ ] Documentation complete
- [ ] Migration guide available
- [ ] All plugins updated to new API

---

## Timeline

| Phase | Estimated Time | Status |
|-------|----------------|--------|
| Phase 1: Options redesign | 2-3 hours | Not started |
| Phase 2: Artifact providers | 2-3 hours | Not started |
| Phase 3: PluginRuntime | 3-4 hours | Not started |
| Phase 4: plugin-babel update | 2-3 hours | Not started |
| Phase 5: Other plugins | 1-2 hours | Not started |
| Phase 6: Testing & docs | 3-4 hours | Not started |

**Total**: ~13-19 hours

---

## Risks & Mitigations

### Risk: Breaking existing integrations

**Mitigation**:
- Project is pre-release (v0.1.0)
- Breaking changes acceptable
- No migration paths required
- Clear migration guide provided

### Risk: Config auto-discovery edge cases

**Mitigation**:
- Provide explicit `configPath` override
- Document common scenarios (monorepo, custom locations)
- Add rich diagnostics for troubleshooting

### Risk: Test complexity increase

**Mitigation**:
- Export testing utilities from `plugin-shared`
- Provide clear examples in documentation
- Maintain file override mode for fixtures

---

## Future Enhancements

- **Plugin composition**: Allow plugins to depend on other plugins
- **Hot reload**: Watch mode for artifact changes
- **Performance monitoring**: Track transformation times
- **Plugin hooks**: Before/after transformation callbacks
- **Custom providers**: Allow third-party artifact providers

---

## References

- Codex conversation ID: `0199dc10-ec81-7cd1-bd07-d11d5b61436d`
- Related issue: Plugin architecture complexity
- PandaCSS reference: Zero-runtime CSS-in-JS pattern

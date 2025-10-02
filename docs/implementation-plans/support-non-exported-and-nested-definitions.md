# Implementation Plan: Support Non-Exported and Nested gql Definitions

## Overview

Extend intermediate-module generation to support **all** gql definitions for Babel plugin replacement, including:
- Non-exported definitions
- Non-top-level (nested) definitions

## Goals

1. Track all `gql.*` calls regardless of export status or nesting level
2. Generate AST-based paths for precise location identification
3. Migrate from `filePath::exportName` to `filePath::astPath` canonical IDs
4. Support Babel plugin replacements for any gql definition

## Breaking Changes

⚠️ **This is a breaking change**:
- Canonical ID format changes: `filePath::exportName` → `filePath::astPath`
- All artifacts, caches, and consumers must be regenerated
- Builder version bump required

## Implementation Steps

### Phase 1: Analyzer Extension

**Goal**: Extend `ModuleDefinition` and analyzer to track all gql definitions with rich metadata.

#### 1.1 Update Type Definitions

**File**: `packages/builder/src/ast/analyzer-types.ts`

- [ ] Extend `ModuleDefinition`:
  ```typescript
  export type ModuleDefinition = {
    readonly exportName: string; // Keep for backward compat during migration
    readonly astPath: string; // New: AST-derived path
    readonly isTopLevel: boolean; // New: top-level vs nested
    readonly isExported: boolean; // New: exported vs non-exported
    readonly exportBinding?: string; // New: export name if exported
    readonly loc: SourceLocation;
    readonly expression: string;
  };
  ```

#### 1.2 Implement AST Path Generation

**File**: `packages/builder/src/ast/adapters/typescript.ts`

- [ ] Create scope stack tracking system:
  ```typescript
  type ScopeFrame = {
    nameSegment: string; // "MyComponent", "useQuery", "arrow#1"
    kind: 'function' | 'class' | 'variable' | 'property' | 'expression';
    occurrence: number; // For disambiguation
  };
  ```

- [ ] Implement `buildAstPath(stack: ScopeFrame[]): string`
  - Concatenate segments with `.`
  - Handle anonymous functions with positional markers
  - Ensure uniqueness within file

- [ ] Update `collectTopLevelDefinitions` → `collectAllDefinitions`:
  - Remove top-level restriction
  - Track scope stack during AST traversal
  - Set `isTopLevel` based on stack depth
  - Set `isExported` based on export analysis
  - Generate `astPath` for each definition

- [ ] Remove "NON_TOP_LEVEL_DEFINITION" diagnostic

#### 1.3 Update SWC Adapter

**File**: `packages/builder/src/ast/adapters/swc.ts`

- [ ] Mirror TypeScript adapter changes
- [ ] Ensure SWC and TypeScript produce identical `astPath` values
- [ ] Update fallback merge logic to use `astPath`

#### 1.4 Add Tests

**File**: `tests/unit/builder/module_analysis.test.ts`

- [ ] Test exported top-level definitions
- [ ] Test non-exported top-level definitions
- [ ] Test nested definitions (in functions, classes, hooks)
- [ ] Test AST path generation and uniqueness
- [ ] Test anonymous function handling

### Phase 2: Canonical ID Migration

**Goal**: Update canonical ID format throughout codebase.

#### 2.1 Update Registry

**File**: `packages/builder/src/registry.ts`

- [ ] Update `createCanonicalId(filePath, astPath)` signature
- [ ] Add migration notes in comments

#### 2.2 Update Dependency Graph

**File**: `packages/builder/src/dependency-graph.ts`

- [ ] Update `DependencyGraphNode`:
  ```typescript
  export type DependencyGraphNode = {
    readonly id: CanonicalId;
    readonly filePath: string;
    readonly astPath: string; // Renamed from localPath
    readonly isExported: boolean;
    readonly isTopLevel: boolean; // New
    readonly exportBinding?: string; // New
    readonly definition: ModuleDefinition;
    readonly dependencies: readonly CanonicalId[];
    readonly moduleSummary: ModuleSummary;
  };
  ```

- [ ] Update `ModuleSummary`:
  ```typescript
  export type ModuleSummary = {
    readonly filePath: string;
    readonly runtimeImports: readonly ModuleImport[];
    readonly gqlExports: readonly CanonicalId[]; // Exported only
    readonly gqlAll: readonly CanonicalId[]; // All definitions
  };
  ```

- [ ] Update `buildDependencyGraph` to:
  - Include all definitions (exported and non-exported)
  - Use `definition.astPath` for canonical IDs
  - Populate new fields

#### 2.3 Update Artifact Types

**File**: `packages/builder/src/types.ts`

- [ ] Update artifact schema to use `astPath`
- [ ] Add migration notes

#### 2.4 Update Artifact Builder

**File**: `packages/builder/src/artifact.ts`

- [ ] Update error messages to reference `astPath`
- [ ] Update `canonicalToFilePath` usage (can stay for now)
- [ ] Ensure artifact generation works with new IDs

### Phase 3: Intermediate Module Restructure

**Goal**: Emit all definitions using `registry.addBuilder()` and support non-top-level definitions.

#### 3.1 Update Pseudo Registry

**File**: `packages/core/src/intermediate/pseudo-module.ts`

- [ ] Add `addBuilder(id: string, builder: Builder)` method:
  ```typescript
  addBuilder(id: string, builder: Builder): void {
    Builder.setContext(builder, { canonicalId: id });
    this.builders.set(id, builder);
  }
  ```

- [ ] Update `evaluate()` to use builder list instead of return values
- [ ] Keep `register()`/`import()` for backward compatibility

#### 3.2 Restructure Emission Logic

**File**: `packages/builder/src/intermediate-module.ts`

- [ ] Update `buildTree` to handle all definitions
- [ ] Separate definitions into categories:
  - Top-level exported
  - Top-level non-exported
  - Non-top-level

- [ ] Implement new emission strategy:
  ```typescript
  // Top-level definitions (exported and non-exported)
  const exportedDef = gql.model(...);
  registry.addBuilder("file::path", exportedDef);

  const nonExportedDef = gql.model(...);
  registry.addBuilder("file::path2", nonExportedDef);

  // Non-top-level definitions (just before return)
  registry.addBuilder("file::Component.hook.def", gql.model(...));

  // Return only exported definitions
  return { exportedDef };
  ```

- [ ] Update `renderRegistryBlock` to use new structure
- [ ] Update import handling for nested → top-level references

#### 3.3 Update Module Summaries

**File**: `packages/builder/src/dependency-graph.ts`

- [ ] Update `buildModuleSummaries` to populate `gqlAll`
- [ ] Keep `gqlExports` for import filtering

### Phase 4: Update Consumers

#### 4.1 Update Tests

- [ ] Update dependency graph tests
- [ ] Update intermediate module tests
- [ ] Add integration tests for:
  - Non-exported definitions
  - Nested definitions
  - Mixed scenarios

#### 4.2 Update Documentation

- [ ] Document breaking changes in CHANGELOG
- [ ] Update README with new capabilities
- [ ] Add examples for Babel plugin usage

### Phase 5: Validation

- [ ] Run full test suite
- [ ] Run quality checks
- [ ] Verify artifact generation
- [ ] Test with real-world fixtures

## Testing Strategy

### Unit Tests

- Analyzer: All definition types, AST path generation
- Dependency Graph: Include non-exported/nested definitions
- Intermediate Module: Correct emission for all categories

### Integration Tests

- End-to-end build with mixed definitions
- Babel plugin replacement scenarios
- Nested → top-level references

### Regression Tests

- Ensure existing exported top-level definitions still work
- Verify backward compatibility where possible

## Rollout Plan

1. Implement Phase 1 (Analyzer) + tests → commit
2. Implement Phase 2 (Canonical IDs) + tests → commit
3. Implement Phase 3 (Intermediate Module) + tests → commit
4. Implement Phase 4 (Consumers) + documentation → commit
5. Phase 5 validation → final commit
6. Bump version, update CHANGELOG

## Risks and Mitigations

**Risk**: Breaking existing artifacts
- **Mitigation**: Clear version bump, regeneration instructions

**Risk**: AST path collisions
- **Mitigation**: Robust uniqueness checks, ordinal suffixes

**Risk**: Non-top-level → non-top-level references fail
- **Mitigation**: Document limitation, runtime error is acceptable

**Risk**: Performance impact from tracking all definitions
- **Mitigation**: Profile and optimize if needed

## Success Criteria

- [ ] All `gql.*` calls tracked regardless of location
- [ ] AST paths uniquely identify each definition
- [ ] Babel plugin can replace any gql definition
- [ ] All tests pass
- [ ] No regressions for existing use cases
- [ ] Documentation updated

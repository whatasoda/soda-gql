# Canonical ID Abstraction: Implementation Plan

**Status:** Planning
**Created:** 2025-10-02
**Author:** System-generated from analysis

## Overview

This document outlines the plan to abstract canonical ID knowledge from `plugin-babel` to `builder`, creating a reusable abstraction that can be shared across multiple plugin types (Babel, SWC, TypeScript, etc.) without sacrificing performance.

## Background

### Current State

**Builder:**
- `createCanonicalId` generates IDs in `filePath::astPath` format
- TypeScript/SWC adapters compute `astPath` during their own AST traversals
- Shared scope helpers exist in `packages/builder/src/ast/common/scope.ts`

**plugin-babel:**
- Reimplements scope/occurrence counter logic in `collectGqlDefinitionMetadata`
- Manages scope stack during its own traversal
- Uses `resolveCanonicalId` to lookup artifacts

### Problem

The same logic for generating `astPath` is duplicated across:
- `packages/builder/src/ast/common/scope.ts:7-43` (shared by builder adapters)
- `packages/plugin-babel/src/plugin.ts:59-153` (plugin-specific implementation)

All implementations follow the same pattern:
- Maintain scope stack of `{nameSegment, kind, occurrence}` frames
- Track occurrence counts for uniqueness
- Detect top-level/exported definitions
- Generate `filePath::astPath` canonical IDs

## Critical Requirements

### Performance Constraint

**The shared logic MUST NOT perform its own AST analysis.**

Rationale:
- Each plugin already performs AST traversal using its visitor pattern (Babel visitor, SWC visitor, etc.)
- We cannot afford to traverse the AST multiple times
- The abstraction must work as a "helper" that plugins call during their existing traversal

### Design Pattern

```
Plugin performs AST traversal (Babel/SWC/TS visitor)
    ↓
During traversal, plugin calls shared utilities
    ↓
Shared utilities provide state management
    ↓
Plugin receives canonical ID information
```

**No separate AST analysis in shared code.**

## Proposed Solution

### CanonicalPathTracker Helper

A pure state management helper that encapsulates:
- Scope stack management
- Occurrence counting
- Unique path bookkeeping
- Top-level/export detection

**Key characteristic:** Does not touch any concrete AST types.

### API Design

```typescript
// Factory function
createCanonicalTracker(options: {
  filePath: string
  getExportName?: (localName: string) => string | undefined
}): CanonicalPathTracker

// Tracker methods
interface CanonicalPathTracker {
  // Called by plugin when entering a scope during traversal
  enterScope(options: {
    segment: string
    kind: ScopeKind
    stableKey?: string
  }): ScopeHandle

  // Called by plugin when exiting a scope
  exitScope(handle: ScopeHandle): void

  // Called when plugin discovers a definition
  registerDefinition(): {
    astPath: string
    isTopLevel: boolean
    exportBinding?: string
  }

  // Utility methods
  currentDepth(): number
  resolveCanonicalId(astPath: string): CanonicalId
  registerExportBinding(local: string, exported: string): void
}
```

### Integration Pattern

#### Babel Plugin Example

```typescript
// At Program entry
const tracker = createCanonicalTracker({ filePath, getExportName })

// In visitor callbacks
const babelVisitor = {
  FunctionDeclaration: {
    enter(path) {
      const handle = tracker.enterScope({
        segment: path.node.id.name,
        kind: 'function'
      })
      // ... other logic
    },
    exit(path) {
      tracker.exitScope(handle)
    }
  },

  // When discovering a GQL definition
  CallExpression(path) {
    if (isGqlDefinition(path)) {
      const { astPath, isTopLevel, exportBinding } = tracker.registerDefinition()
      const canonicalId = tracker.resolveCanonicalId(astPath)
      // ... use canonicalId
    }
  }
}
```

#### Builder Adapter Example

```typescript
// In TypeScript/SWC analyzer
function analyzeFile(sourceFile: ts.SourceFile) {
  const tracker = createCanonicalTracker({ filePath })

  function visit(node: ts.Node) {
    let handle: ScopeHandle | undefined

    if (isScopeNode(node)) {
      handle = tracker.enterScope({
        segment: getNodeName(node),
        kind: getScopeKind(node)
      })
    }

    if (isDefinition(node)) {
      const { astPath, isTopLevel } = tracker.registerDefinition()
      // ... use astPath
    }

    ts.forEachChild(node, visit)

    if (handle) {
      tracker.exitScope(handle)
    }
  }

  visit(sourceFile)
}
```

## Implementation Plan

### Phase 1: Create Core Abstraction

**File:** `packages/builder/src/canonical/path-tracker.ts`

Tasks:
- [ ] Move `ScopeFrame` type from `ast/common/scope.ts`
- [ ] Move occurrence counter logic
- [ ] Move path uniqueness utilities
- [ ] Move export binding management
- [ ] Implement `createCanonicalTracker` factory
- [ ] Implement `CanonicalPathTracker` interface
- [ ] Export from `packages/builder/src/index.ts`

Expected changes:
- New file: `packages/builder/src/canonical/path-tracker.ts`
- Modified: `packages/builder/src/index.ts` (add exports)

### Phase 2: Refactor Builder Adapters

**Files:**
- `packages/builder/src/ast/adapters/typescript.ts`
- `packages/builder/src/ast/adapters/swc.ts`

Tasks:
- [ ] Replace manual scope stack with tracker instance
- [ ] Update `enterScope`/`exitScope` calls to use tracker API
- [ ] Update `astPath` generation to use tracker
- [ ] Remove duplicated scope logic
- [ ] Run existing tests to verify `astPath` values unchanged

Expected changes:
- Import `createCanonicalTracker` from new module
- Remove inline scope management code
- Simpler, cleaner adapter code

### Phase 3: Update Discoverer

**File:** `packages/builder/src/discovery/discoverer.ts`

Tasks:
- [ ] Update to consume richer metadata from tracker
- [ ] Utilize `isTopLevel` and `exportBinding` information
- [ ] Update related types if necessary

Expected changes:
- Enhanced definition metadata
- Potential type updates in `packages/builder/src/types.ts`

### Phase 4: Refactor plugin-babel

**File:** `packages/plugin-babel/src/plugin.ts`

Tasks:
- [ ] Instantiate shared tracker in Program visitor
- [ ] Replace `collectGqlDefinitionMetadata` scope logic with tracker calls
- [ ] Feed export bindings to tracker during traversal
- [ ] Update `resolveCanonicalId` to delegate to tracker
- [ ] Remove duplicated scope/path logic (lines 59-153)

Expected changes:
- Significant code reduction
- Simpler plugin logic
- No behavioral changes (verified by tests)

**File:** `packages/plugin-babel/src/artifact.ts`

Tasks:
- [ ] Update `resolveCanonicalId` if necessary
- [ ] Remove any remaining canonical ID duplication

### Phase 5: Testing

#### Unit Tests

**File:** `packages/builder/src/canonical/__tests__/path-tracker.test.ts`

Test cases:
- [ ] Basic scope enter/exit
- [ ] Anonymous scopes (auto-naming)
- [ ] Duplicate name handling (occurrence counting)
- [ ] Nested definitions
- [ ] Top-level detection
- [ ] Export binding registration and lookup
- [ ] Multiple definitions with same name
- [ ] Edge cases (empty segments, special characters)

#### Integration Tests

Test scenarios:
- [ ] Builder TypeScript adapter produces same `astPath` as before
- [ ] Builder SWC adapter produces same `astPath` as before
- [ ] plugin-babel produces canonical IDs matching builder artifacts
- [ ] Cross-plugin consistency (same code analyzed by different plugins)

### Phase 6: Documentation

#### Developer Documentation

**File:** `packages/builder/README.md` or new guide

Content:
- [ ] Overview of canonical ID system
- [ ] CanonicalPathTracker API reference
- [ ] Integration guide for plugin authors
- [ ] Example: Creating a new plugin with the tracker
- [ ] Performance characteristics
- [ ] Migration notes

#### Code Documentation

Tasks:
- [ ] JSDoc comments for all public APIs
- [ ] Usage examples in comments
- [ ] Link to integration guide

## Migration Strategy

### Backward Compatibility

- No breaking changes to public APIs
- Internal refactoring only
- Existing canonical ID format (`filePath::astPath`) unchanged
- Plugin behavior unchanged (verified by tests)

### Rollout Plan

1. Merge Phase 1 (core abstraction) first
2. Merge Phase 2 (builder adapters) with comprehensive tests
3. Merge Phase 3 (discoverer updates)
4. Merge Phase 4 (plugin-babel refactor)
5. Merge Phase 5 (additional tests)
6. Merge Phase 6 (documentation)

### Validation

After each phase:
- [ ] All existing tests pass
- [ ] No performance regression
- [ ] Code coverage maintained or improved

## Success Criteria

- [ ] Zero AST traversal overhead (no additional passes)
- [ ] Single source of truth for canonical ID generation
- [ ] plugin-babel complexity reduced by ~100 lines
- [ ] Future plugins can integrate with <50 lines of tracker code
- [ ] All tests pass with no behavioral changes
- [ ] Comprehensive documentation for plugin authors

## Future Extensions

Once this abstraction is stable:

1. **SWC Transform Plugin**
   - Use same tracker API
   - Integrate with SWC visitor pattern

2. **TypeScript Transformer Plugin**
   - Use same tracker API
   - Integrate with TypeScript transformer API

3. **Vite/Rollup Plugin**
   - Use same tracker API
   - Integrate with plugin hooks

4. **Additional Utilities**
   - `parseCanonicalId(id: string) => { filePath, astPath }`
   - `canonicalIdToFilePath(id: CanonicalId) => string`
   - `canonicalIdToAstPath(id: CanonicalId) => string`
   - Artifact accessor layer (future consideration)

## References

### Related Files

- `packages/builder/src/utils/canonical-id.ts:9` - Current ID creation
- `packages/builder/src/ast/common/scope.ts` - Scope utilities
- `packages/builder/src/ast/adapters/typescript.ts:240` - TS adapter astPath
- `packages/builder/src/ast/adapters/swc.ts:319` - SWC adapter astPath
- `packages/plugin-babel/src/plugin.ts:35-214` - Babel scope logic
- `packages/plugin-babel/src/artifact.ts:43` - Babel canonical ID resolution

### Related Documentation

- [Project Overview](../../README.md)
- [Testing Strategy](../guides/testing-strategy.md)
- [Code Conventions](../../CLAUDE.md#universal-code-conventions)

## Appendix: Performance Analysis

### Current Performance

- Builder: 1 AST traversal per file (TypeScript or SWC)
- plugin-babel: 1 AST traversal per file (Babel)
- Total: 2 traversals (build time + runtime transform)

### After Abstraction

- Builder: 1 AST traversal per file (unchanged)
- plugin-babel: 1 AST traversal per file (unchanged)
- Total: 2 traversals (no change)

**Performance impact: Zero**

The abstraction is pure state management - no additional I/O, parsing, or traversal.

### Memory Overhead

- Tracker instance: ~1KB per file
- Scope stack depth: typically <10 frames
- Occurrence map: <100 entries per file

**Memory impact: Negligible**

## Questions & Decisions

### Q: Should we version the canonical ID format?

**Decision:** Not yet. The current format is simple and sufficient. If we need to change it, we can add versioning at that time.

### Q: Should the tracker handle file path normalization?

**Decision:** Yes. The tracker should accept any file path and normalize it internally to ensure consistency.

### Q: Should we support multiple trackers per file?

**Decision:** No. One tracker per file is sufficient and keeps the API simpler.

### Q: Should the tracker be stateful or functional?

**Decision:** Stateful. The tracker maintains mutable state during traversal for performance. This is acceptable since it's scoped to a single file analysis.

---

**Next Steps:** Begin Phase 1 implementation after review and approval.

# CanonicalPathTracker: Plugin Integration Guide

**Status:** Stable
**Package:** `@soda-gql/builder`
**Since:** v0.1.0

## Overview

The `CanonicalPathTracker` is a shared utility for tracking scope information during AST traversal to generate canonical IDs. It's designed to integrate seamlessly with existing plugin visitor patterns (Babel, SWC, TypeScript) without requiring a separate AST traversal.

### Key Benefits

- **Zero Performance Overhead**: No additional AST traversal required
- **Consistent ID Generation**: Ensures all plugins produce identical canonical IDs
- **Type-Safe**: Full TypeScript support with branded types
- **Plugin-Agnostic**: Works with any AST traversal pattern

## Canonical ID Format

Canonical IDs uniquely identify GraphQL definitions across your codebase:

```
{absoluteFilePath}::{astPath}
```

**Examples:**
```
/app/src/models/user.ts::userModel
/app/src/pages/profile.ts::ProfilePage.useQuery.profileQuery
/app/src/config.ts::database.connection$1
```

### AST Path Composition

The `astPath` component is built from scope segments encountered during traversal:

- **Named scopes**: Use the identifier name (e.g., `MyComponent`, `getUserModel`)
- **Anonymous scopes**: Auto-generated with counter (e.g., `arrow#0`, `function#1`)
- **Duplicate definitions**: Suffixed with `$N` (e.g., `model$1`, `model$2`)

## Quick Start

### Installation

The tracker is exported from the builder package:

```typescript
import { createCanonicalTracker } from '@soda-gql/builder';
```

### Basic Usage

```typescript
import { createCanonicalTracker } from '@soda-gql/builder';

// 1. Create tracker at file/program entry
const tracker = createCanonicalTracker({
  filePath: '/absolute/path/to/file.ts',
  getExportName: (localName) => exportBindings.get(localName),
});

// 2. Track scopes during AST traversal
const handle = tracker.enterScope({
  segment: 'MyComponent',
  kind: 'function',
  stableKey: 'func:MyComponent',
});

// 3. Register definitions when discovered
const { astPath, isTopLevel, exportBinding } = tracker.registerDefinition();

// 4. Exit scope when leaving node
tracker.exitScope(handle);

// 5. Resolve canonical IDs
const canonicalId = tracker.resolveCanonicalId(astPath);
```

## Integration Patterns

### Babel Plugin Integration

Babel uses a visitor pattern with enter/exit callbacks:

```typescript
import { createCanonicalTracker, type CanonicalPathTracker } from '@soda-gql/builder';
import type { NodePath } from '@babel/traverse';
import { types as t } from '@babel/core';

const collectGqlDefinitions = (
  programPath: NodePath<t.Program>,
  filename: string
) => {
  // Build export bindings map
  const exportBindings = new Map<string, string>();
  programPath.node.body.forEach((statement) => {
    if (t.isExportNamedDeclaration(statement) && statement.declaration) {
      // ... populate exportBindings
    }
  });

  // Create tracker
  const tracker = createCanonicalTracker({
    filePath: filename,
    getExportName: (localName) => exportBindings.get(localName),
  });

  // Track scope handles for proper enter/exit pairing
  const scopeHandles = new WeakMap<NodePath, ReturnType<CanonicalPathTracker['enterScope']>>();

  // Anonymous scope counter
  const anonymousCounters = new Map<string, number>();
  const getAnonymousName = (kind: string): string => {
    const count = anonymousCounters.get(kind) ?? 0;
    anonymousCounters.set(kind, count + 1);
    return `${kind}#${count}`;
  };

  programPath.traverse({
    enter(path) {
      // Check if this is a GQL definition
      if (path.isCallExpression() && isGqlCall(path.node)) {
        const { astPath } = tracker.registerDefinition();
        const canonicalId = tracker.resolveCanonicalId(astPath);
        // ... process definition
        path.skip(); // Don't traverse into GQL calls
        return;
      }

      // Variable declarator
      if (path.isVariableDeclarator() && path.node.id && t.isIdentifier(path.node.id)) {
        const varName = path.node.id.name;
        const handle = tracker.enterScope({
          segment: varName,
          kind: 'variable',
          stableKey: `var:${varName}`,
        });
        scopeHandles.set(path, handle);
        return;
      }

      // Arrow function
      if (path.isArrowFunctionExpression()) {
        const arrowName = getAnonymousName('arrow');
        const handle = tracker.enterScope({
          segment: arrowName,
          kind: 'function',
          stableKey: 'arrow',
        });
        scopeHandles.set(path, handle);
        return;
      }

      // ... other scope types
    },

    exit(path) {
      // Exit scope when exiting nodes that have handles
      const handle = scopeHandles.get(path);
      if (handle) {
        tracker.exitScope(handle);
        scopeHandles.delete(path);
      }
    },
  });
};
```

### TypeScript/SWC Adapter Integration

For recursive visitor patterns with immutable stacks:

```typescript
import { createCanonicalTracker } from '@soda-gql/builder';

const collectDefinitions = (sourceFile: ts.SourceFile, exports: readonly ModuleExport[]) => {
  const exportBindings = createExportBindingsMap(exports);

  // Create tracker
  const tracker = createCanonicalTracker({
    filePath: sourceFile.fileName,
    getExportName: (localName) => exportBindings.get(localName),
  });

  // Anonymous scope counter
  const anonymousCounters = new Map<string, number>();
  const getAnonymousName = (kind: string): string => {
    const count = anonymousCounters.get(kind) ?? 0;
    anonymousCounters.set(kind, count + 1);
    return `${kind}#${count}`;
  };

  // Helper to synchronize tracker with immutable stack
  const withScope = <T>(
    segment: string,
    kind: 'function' | 'class' | 'variable' | 'property' | 'method' | 'expression',
    stableKey: string,
    callback: () => T,
  ): T => {
    const handle = tracker.enterScope({ segment, kind, stableKey });
    try {
      return callback();
    } finally {
      tracker.exitScope(handle);
    }
  };

  const visit = (node: ts.Node) => {
    // Check if GQL definition
    if (ts.isCallExpression(node) && isGqlDefinitionCall(node)) {
      const { astPath } = tracker.registerDefinition();
      const canonicalId = tracker.resolveCanonicalId(astPath);
      // ... process definition
      return;
    }

    // Variable declaration
    if (ts.isVariableDeclaration(node) && node.name && ts.isIdentifier(node.name)) {
      const varName = node.name.text;
      if (node.initializer) {
        withScope(varName, 'variable', `var:${varName}`, () => {
          visit(node.initializer!);
        });
      }
      return;
    }

    // Function declaration
    if (ts.isFunctionDeclaration(node)) {
      const funcName = node.name?.text ?? getAnonymousName('function');
      if (node.body) {
        withScope(funcName, 'function', `func:${funcName}`, () => {
          ts.forEachChild(node.body!, visit);
        });
      }
      return;
    }

    // ... other scope types

    // Recursively visit children
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
};
```

## API Reference

### `createCanonicalTracker(options)`

Creates a new canonical path tracker instance.

**Parameters:**
- `options.filePath` (string, required): Absolute path to the file being analyzed
- `options.getExportName` (function, optional): Callback to resolve export names
  - Signature: `(localName: string) => string | undefined`
  - Used for export binding detection

**Returns:** `CanonicalPathTracker`

**Example:**
```typescript
const tracker = createCanonicalTracker({
  filePath: '/app/src/models/user.ts',
  getExportName: (localName) => exportBindings.get(localName),
});
```

### `tracker.enterScope(options)`

Enters a new scope during traversal.

**Parameters:**
- `options.segment` (string, required): Name segment for this scope
- `options.kind` (ScopeKind, required): Type of scope
  - Valid values: `'function'`, `'class'`, `'variable'`, `'property'`, `'method'`, `'expression'`
- `options.stableKey` (string, optional): Key for occurrence tracking
  - Use consistent keys for same logical scope types
  - Example: `'func:myFunction'`, `'var:myVar'`, `'arrow'`

**Returns:** `ScopeHandle` - Opaque handle to use when exiting the scope

**Example:**
```typescript
const handle = tracker.enterScope({
  segment: 'MyComponent',
  kind: 'function',
  stableKey: 'func:MyComponent',
});
```

### `tracker.exitScope(handle)`

Exits a scope during traversal.

**Parameters:**
- `handle` (ScopeHandle, required): Handle returned from `enterScope()`

**Throws:** Error if scope exit order is invalid

**Example:**
```typescript
const handle = tracker.enterScope({ ... });
try {
  // ... traverse scope contents
} finally {
  tracker.exitScope(handle);
}
```

### `tracker.registerDefinition()`

Registers a GQL definition discovered during traversal.

**Returns:** Object with:
- `astPath` (string): Generated AST path for this definition
- `isTopLevel` (boolean): Whether definition is at top level (depth === 0)
- `exportBinding` (string | undefined): Export name if definition is exported

**Example:**
```typescript
const { astPath, isTopLevel, exportBinding } = tracker.registerDefinition();
console.log(astPath); // "MyComponent.useQuery.profileQuery"
console.log(isTopLevel); // false
console.log(exportBinding); // undefined (not exported)
```

### `tracker.resolveCanonicalId(astPath)`

Resolves a complete canonical ID from an AST path.

**Parameters:**
- `astPath` (string, required): AST path string

**Returns:** `CanonicalId` - Branded string in format `{filePath}::{astPath}`

**Example:**
```typescript
const canonicalId = tracker.resolveCanonicalId('userModel');
// "/app/src/models/user.ts::userModel"
```

### `tracker.registerExportBinding(local, exported)`

Registers an export binding (alternative to `getExportName` callback).

**Parameters:**
- `local` (string, required): Local variable name
- `exported` (string, required): Exported name

**Example:**
```typescript
tracker.registerExportBinding('userModel', 'UserModel');
```

### `tracker.currentDepth()`

Gets the current scope depth.

**Returns:** number (0 = top level)

**Example:**
```typescript
console.log(tracker.currentDepth()); // 0 (top level)
tracker.enterScope({ ... });
console.log(tracker.currentDepth()); // 1 (nested)
```

## Best Practices

### 1. Use Consistent stableKey Patterns

For predictable occurrence counting, use consistent key patterns:

```typescript
// ✅ Good
tracker.enterScope({ segment: 'foo', kind: 'function', stableKey: 'func:foo' });
tracker.enterScope({ segment: 'bar', kind: 'variable', stableKey: 'var:bar' });
tracker.enterScope({ segment: 'arrow#0', kind: 'function', stableKey: 'arrow' });

// ❌ Bad (inconsistent)
tracker.enterScope({ segment: 'foo', kind: 'function', stableKey: 'foo' });
tracker.enterScope({ segment: 'bar', kind: 'variable', stableKey: 'variable-bar' });
```

### 2. Always Exit Scopes in Finally Blocks

Ensure scopes are properly exited even if errors occur:

```typescript
// ✅ Good
const handle = tracker.enterScope({ ... });
try {
  // ... traverse
} finally {
  tracker.exitScope(handle);
}

// ❌ Bad (may leak scopes on error)
const handle = tracker.enterScope({ ... });
// ... traverse
tracker.exitScope(handle);
```

### 3. Use WeakMap for Handle Storage

For Babel-style visitor patterns, store handles in WeakMap:

```typescript
const scopeHandles = new WeakMap<NodePath, ScopeHandle>();

// Enter
const handle = tracker.enterScope({ ... });
scopeHandles.set(path, handle);

// Exit
const handle = scopeHandles.get(path);
if (handle) {
  tracker.exitScope(handle);
  scopeHandles.delete(path);
}
```

### 4. Skip GQL Call Children

Don't traverse into GQL definition calls to avoid polluting scope:

```typescript
if (path.isCallExpression() && isGqlCall(path.node)) {
  const { astPath } = tracker.registerDefinition();
  // ... process definition
  path.skip(); // Important!
  return;
}
```

### 5. Handle Anonymous Scopes Consistently

Use auto-incrementing counters for anonymous scopes:

```typescript
const anonymousCounters = new Map<string, number>();
const getAnonymousName = (kind: string): string => {
  const count = anonymousCounters.get(kind) ?? 0;
  anonymousCounters.set(kind, count + 1);
  return `${kind}#${count}`;
};

// Usage
if (path.isArrowFunctionExpression()) {
  const segment = getAnonymousName('arrow');
  const handle = tracker.enterScope({ segment, kind: 'function', stableKey: 'arrow' });
  // ...
}
```

## Performance Characteristics

### Memory Usage

- **Tracker instance**: ~1KB per file
- **Scope stack depth**: Typically <10 frames
- **Occurrence map**: <100 entries per file

**Total overhead**: Negligible (<10KB per file)

### Time Complexity

- `enterScope()`: O(1)
- `exitScope()`: O(1)
- `registerDefinition()`: O(n) where n = current scope depth (typically <10)
- `resolveCanonicalId()`: O(1)

**Impact**: Zero - integrates with existing AST traversal

## Migration from Manual Implementation

If you have existing scope tracking logic, migration is straightforward:

### Before (Manual)
```typescript
const scopeStack: ScopeFrame[] = [];
const occurrenceCounters = new Map<string, number>();
const usedPaths = new Set<string>();

const getNextOccurrence = (key: string): number => {
  const current = occurrenceCounters.get(key) ?? 0;
  occurrenceCounters.set(key, current + 1);
  return current;
};

const buildAstPath = (stack: readonly ScopeFrame[]): string => {
  return stack.map((frame) => frame.nameSegment).join('.');
};

const ensureUniquePath = (basePath: string): string => {
  let path = basePath;
  let suffix = 0;
  while (usedPaths.has(path)) {
    suffix++;
    path = `${basePath}$${suffix}`;
  }
  usedPaths.add(path);
  return path;
};
```

### After (Tracker)
```typescript
const tracker = createCanonicalTracker({ filePath });
// All logic is now handled by the tracker!
```

**Lines saved**: ~50-100 lines of boilerplate per adapter/plugin

## Troubleshooting

### Scope Exit Order Errors

**Error**: `Invalid scope exit: expected depth X, got Y`

**Cause**: Exiting scopes in wrong order (not LIFO)

**Solution**: Always store handles and exit in reverse order:
```typescript
const handle1 = tracker.enterScope({ ... });
const handle2 = tracker.enterScope({ ... });

// ✅ Correct (LIFO)
tracker.exitScope(handle2);
tracker.exitScope(handle1);

// ❌ Wrong
tracker.exitScope(handle1); // Throws error!
```

### Inconsistent AST Paths

**Issue**: Different plugins generate different `astPath` values

**Causes**:
1. Different `stableKey` patterns
2. Different anonymous scope naming
3. Different scope entry points

**Solution**: Ensure all plugins use identical patterns (see Best Practices)

### Missing Export Bindings

**Issue**: `exportBinding` is always `undefined`

**Cause**: `getExportName` callback not provided or returns `undefined`

**Solution**: Build export bindings map before creating tracker:
```typescript
const exportBindings = new Map<string, string>();
// ... populate from AST exports

const tracker = createCanonicalTracker({
  filePath,
  getExportName: (localName) => exportBindings.get(localName),
});
```

## Examples

See the following for complete integration examples:
- [TypeScript Adapter](../../packages/builder/src/ast/adapters/typescript.ts)
- [SWC Adapter](../../packages/builder/src/ast/adapters/swc.ts)
- [Babel Plugin](../../packages/plugin-babel/src/plugin.ts)

## Related Documentation

- [Canonical ID Abstraction: Implementation Plan](../implementation-plans/canonical-id-abstraction.md)
- [Testing Strategy](./testing-strategy.md)
- [Code Conventions](../../CLAUDE.md#universal-code-conventions)

## Changelog

### v0.1.0 (2025-10-02)
- Initial implementation
- Support for Babel, TypeScript, and SWC integrations
- Comprehensive test coverage (28 tests)

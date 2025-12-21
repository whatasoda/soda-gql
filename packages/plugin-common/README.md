# @soda-gql/plugin-common

Shared utilities and types for soda-gql compiler plugins.

## Overview

This package provides common functionality used across all soda-gql compiler plugins (Babel, SWC, TypeScript). It's designed for plugin developers and is not intended for direct use by end users.

If you're looking to use soda-gql in your project, see:
- [@soda-gql/babel-plugin](../babel-plugin) - Babel plugin (production-ready)
- [@soda-gql/plugin-swc](../plugin-swc) - SWC plugin (in development)
- [@soda-gql/tsc-plugin](../tsc-plugin) - TypeScript plugin

## Installation

This package is automatically installed as a dependency of plugin packages. You don't need to install it directly.

```bash
# Installed automatically with babel-plugin
bun add -D @soda-gql/babel-plugin
```

## Exports

### Types

#### `GqlCall<TCallNode>`

Generic type for representing GraphQL calls in AST-agnostic way:

```typescript
import type { GqlCall } from "@soda-gql/plugin-common";

type BabelGqlCall = GqlCall<t.CallExpression>;
type TypeScriptGqlCall = GqlCall<ts.CallExpression>;
```

Available variants:
- `GqlCallModel<TCallNode>` - Model definitions
- `GqlCallSlice<TCallNode>` - Query/mutation/subscription slices
- `GqlCallOperation<TCallNode>` - Composed operations
- `GqlCallInlineOperation<TCallNode>` - Inline operations

#### `GqlDefinitionMetadata`

Metadata about GraphQL definitions in source code:

```typescript
interface GqlDefinitionMetadata {
  readonly astPath: string;        // Canonical path in AST (e.g., "userQuery")
  readonly isTopLevel: boolean;    // Top-level definition or nested
  readonly isExported: boolean;    // Exported from module
  readonly exportBinding?: string; // Export name if different from local name
}
```

### Error Types

Comprehensive error types for plugin development:

```typescript
import type { PluginError } from "@soda-gql/plugin-common";
import { formatPluginError, isPluginError } from "@soda-gql/plugin-common";

// Error categories:
// - PluginOptionsInvalidBuilderConfigError
// - PluginBuilderEntryNotFoundError
// - PluginBuilderDocDuplicateError
// - PluginBuilderCircularDependencyError
// - PluginBuilderModuleEvaluationFailedError
// - PluginBuilderWriteFailedError
// - PluginBuilderUnexpectedError
// - PluginAnalysisMetadataMissingError
// - PluginAnalysisArtifactMissingError
// - PluginAnalysisUnsupportedArtifactTypeError
```

#### Error Handling

```typescript
import { formatPluginError, isPluginError } from "@soda-gql/plugin-common";

try {
  // Plugin transformation logic
} catch (error) {
  if (isPluginError(error)) {
    throw new Error(formatPluginError(error));
  }
  throw error;
}
```

### Utilities

#### `resolveCanonicalId`

Creates canonical identifiers for GraphQL elements:

```typescript
import { resolveCanonicalId } from "@soda-gql/plugin-common";

const canonicalId = resolveCanonicalId(
  "/path/to/file.ts",
  "userQuery"
);
// Returns: "/path/to/file.ts::userQuery"
```

#### `createPluginSession`

Creates a plugin session with configuration and artifact management:

```typescript
import { createPluginSession } from "@soda-gql/plugin-common";

const session = createPluginSession(options, "@soda-gql/babel-plugin");

if (session) {
  // Sync artifact retrieval
  const artifact = session.getArtifact();

  // Async artifact retrieval (supports async metadata factories)
  const asyncArtifact = await session.getArtifactAsync();

  const config = session.config;
}
```

### Shared State API

For bundler plugins that need to share state between plugin and loader stages (e.g., Webpack):

```typescript
import {
  getSharedState,
  setSharedArtifact,
  getSharedArtifact,
  getStateKey,
} from "@soda-gql/plugin-common";

// Get state key from config path
const key = getStateKey(configPath);

// Share artifact between plugin and loader
setSharedArtifact(key, artifact, moduleAdjacency);

// Retrieve shared artifact in loader
const sharedArtifact = getSharedArtifact(key);

// Full state access
const state = getSharedState(key);
// state.currentArtifact
// state.moduleAdjacency
// state.generation
```

The shared state enables:
- Efficient artifact sharing across build pipeline stages
- Module adjacency tracking for dependency-aware rebuilds
- Generation tracking for cache invalidation

## Plugin Development Guide

### Creating a New Plugin

1. **Define AST-specific types**:

```typescript
import type { GqlCall } from "@soda-gql/plugin-common";

// Map generic GqlCall to your compiler's AST
type MyPluginGqlCall = GqlCall<MyCompilerCallExpression>;
```

2. **Collect metadata**:

```typescript
import type { GqlDefinitionMetadata } from "@soda-gql/plugin-common";

function collectMetadata(ast): Map<Node, GqlDefinitionMetadata> {
  // Traverse AST and collect metadata for each gql.default() call
  // Return WeakMap or Map associating nodes with metadata
}
```

3. **Create plugin session**:

```typescript
import { createPluginSession } from "@soda-gql/plugin-common";

const session = createPluginSession(options, "my-plugin-name");
```

4. **Transform AST**:

```typescript
import { formatPluginError } from "@soda-gql/plugin-common";
import { err, ok } from "neverthrow";

function transformNode(node, metadata, artifact) {
  const gqlCallResult = extractGqlCall(node, metadata, artifact);

  if (gqlCallResult.isErr()) {
    throw new Error(formatPluginError(gqlCallResult.error));
  }

  const gqlCall = gqlCallResult.value;
  // Transform based on gqlCall.type: "model" | "slice" | "operation" | "inlineOperation"
}
```

### Error Handling Pattern

All plugins should follow this error handling pattern:

```typescript
import { err, ok, type Result } from "neverthrow";
import type { PluginError } from "@soda-gql/plugin-common";

function transform(): Result<TransformedAST, PluginError> {
  // Validation
  if (!metadata) {
    return err({
      type: "PluginError",
      stage: "analysis",
      code: "SODA_GQL_METADATA_NOT_FOUND",
      message: "No metadata found",
      cause: { filename },
      filename,
    });
  }

  // Success
  return ok(transformedAst);
}
```

## Architecture

### Plugin Flow

```
Source Code
    ↓
[Metadata Collection] ← GqlDefinitionMetadata
    ↓
[AST Analysis] ← PluginSession, BuilderArtifact
    ↓
[Transformation] ← GqlCall types
    ↓
[Import Management]
    ↓
Transformed Code
```

### Type Safety

The package uses neverthrow for type-safe error handling:

- **Never throw**: Always return `Result<T, PluginError>`
- **Exhaustive error types**: Each error stage has specific types
- **No `any`**: All types are fully specified

## TypeScript Support

This package is written in TypeScript and provides complete type definitions:

```typescript
import type {
  GqlCall,
  GqlCallModel,
  GqlDefinitionMetadata,
  PluginError,
  PluginOptions,
  PluginSession,
} from "@soda-gql/plugin-common";
```

## Contributing

When adding new plugin functionality:

1. **Add types here first** - Ensure all plugins share the same types
2. **Test with multiple plugins** - Changes affect Babel, SWC, and TypeScript plugins
3. **Document exports** - All public APIs should be documented
4. **Maintain backward compatibility** - This is a shared dependency

See [CLAUDE.md](../../CLAUDE.md) for general contribution guidelines.

## License

MIT

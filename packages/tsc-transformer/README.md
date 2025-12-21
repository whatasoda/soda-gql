# @soda-gql/tsc-transformer

Core TypeScript transformation logic for soda-gql. This package extracts the AST transformation functionality used by `@soda-gql/tsc-plugin` and provides conformance tests for other plugin implementations.

## Status

**Internal package** - This package is used internally by soda-gql plugins and is not intended for direct use by end users.

## Purpose

This package provides:

1. **Shared transformation logic** - The core AST transformation that converts `gql.default()` calls to runtime registrations
2. **Conformance test cases** - Test fixtures and utilities for verifying plugin implementations match expected behavior
3. **TypeScript AST utilities** - Helpers for import management and code generation

## Used By

- `@soda-gql/tsc-plugin` - TypeScript compiler plugin
- `@soda-gql/babel-plugin` - Babel transformation plugin (for test conformance)

## API

### createTransformer

Creates a TypeScript transformer that processes soda-gql files.

```typescript
import { createTransformer } from "@soda-gql/tsc-transformer";
import type { BuilderArtifact } from "@soda-gql/builder";
import type { ResolvedSodaGqlConfig } from "@soda-gql/config";
import * as ts from "typescript";

const transformer = createTransformer({
  compilerOptions: ts.getDefaultCompilerOptions(),
  config: resolvedConfig,
  artifact: builderArtifact,
});

// Use in a TypeScript transformer factory
const result = transformer.transform({
  sourceFile,
  context: transformationContext,
});
```

### createAfterStubTransformer

Creates a post-transformation step that cleans up stub imports.

```typescript
import { createAfterStubTransformer } from "@soda-gql/tsc-transformer";
```

### TypeScriptEnv

Type definition for the TypeScript-specific environment.

```typescript
type TypeScriptEnv = {
  readonly sourceFile: ts.SourceFile;
  readonly context: ts.TransformationContext;
};
```

## License

MIT

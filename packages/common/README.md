# @soda-gql/common

[![npm version](https://img.shields.io/npm/v/@soda-gql/common.svg)](https://www.npmjs.com/package/@soda-gql/common)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Shared utilities and types for the soda-gql ecosystem.

## Installation

```bash
bun add @soda-gql/common
```

> **Note**: This package is primarily used internally by other soda-gql packages. Direct usage is only needed for advanced integration scenarios.

## Overview

This package provides shared utilities used across the soda-gql ecosystem:

- Portable utilities for cross-environment compatibility
- Canonical ID generation and parsing
- Path building utilities
- Zod validation helpers

## Exports

### Main Entry (`@soda-gql/common`)

Common types and utilities:

```typescript
import { ... } from "@soda-gql/common";
```

### Portable (`@soda-gql/common/portable`)

Cross-environment utilities:

```typescript
import { ... } from "@soda-gql/common/portable";
```

### Canonical ID (`@soda-gql/common/canonical-id`)

Canonical ID generation and parsing:

```typescript
import { createCanonicalId, parseCanonicalId } from "@soda-gql/common/canonical-id";

// Create a canonical ID
const id = createCanonicalId("/path/to/file.ts", "userQuery");
// Result: "/path/to/file.ts::userQuery"

// Parse a canonical ID
const parsed = parseCanonicalId(id);
// Result: { filePath: "/path/to/file.ts", astPath: "userQuery" }
```

### Utils (`@soda-gql/common/utils`)

General utility functions:

```typescript
import { ... } from "@soda-gql/common/utils";
```

### Zod (`@soda-gql/common/zod`)

Zod validation helpers:

```typescript
import { ... } from "@soda-gql/common/zod";
```

## Related Packages

- [@soda-gql/core](../core) - Core types and utilities
- [@soda-gql/builder](../builder) - Static analysis engine

## License

MIT

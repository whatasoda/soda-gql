# PE-NestJS: NestJS Plugin

> **🚨 DEPRECATED**: This plan is obsolete. `@soda-gql/plugin-nestjs` was split into:
> - `@soda-gql/plugin-tsc` - TypeScript compiler plugin
> - `@soda-gql/plugin-swc` - SWC compiler plugin
> - `@soda-gql/plugin-webpack` - Webpack loader and plugin
>
> This document is kept for historical reference only.

**Task ID**: PE-NestJS
**Status**: Completed (split into separate packages)
**Duration**: 4-5 days (Estimated 2-3 days remaining for full transformation)
**Dependencies**: [PE-Shared: Shared Layer](./shared-layer.md)

> **Current Status**: See [docs/status/plugin-nestjs.md](../../status/plugin-nestjs.md) for detailed implementation status, capabilities, and limitations.

---

## Overview

Implement NestJS plugin for webpack integration and CLI prebuild support.

**Current Implementation**: Infrastructure complete with TypeScript and SWC compiler plugins providing detection-only transformation. Webpack integration is fully functional with zero-runtime transformation.

## Key Features

- Webpack configuration augmentation
- CLI prebuild step for artifact generation
- Watch mode with webpack hooks
- NestJS module for runtime integration

## Implementation

See original `plugin-implementation-plan.md` Phase 4 for detailed implementation steps.

## Success Criteria

**Phase 1: Infrastructure (Complete)**
- [x] NestJS app compiles with webpack
- [x] TypeScript compiler plugin infrastructure
- [x] SWC compiler plugin infrastructure
- [x] Artifact loading and caching
- [x] Integration tests with NestJS fixtures pass
- [x] Detection of `gql.operation.*` calls
- [x] Working examples (nestjs-compiler-tsc, nestjs-compiler-swc)

**Phase 2: Transformation (In Progress)**
- [ ] AST replacement for compiler plugins
- [ ] Runtime import generation
- [ ] Runtime code elimination
- [ ] Full zero-runtime transformation
- [ ] Transformation correctness tests

---

For full details, see: `docs/plans/plugin-implementation-plan.md` (archive)

# Project Overview

## Purpose
Zero-runtime GraphQL Query Generation library (similar to PandaCSS approach)

## Tech Stack
- TypeScript 5.x with Bun runtime
- Bun plugin system for transformations
- neverthrow for error handling
- Zod v4 for validation
- Bun test with TDD (t_wada methodology)

## Key Concepts
- **Models**: Type-safe GraphQL fragments with transforms
- **Operation Slices**: Domain-specific query/mutation/subscription definitions
- **Operations**: Composed GraphQL operations from multiple slices
- **Zero Runtime**: All transformations at build time

## Project Status
- Pre-release v0.1.0
- All refactors and architectural changes are encouraged
- Breaking changes are acceptable
- NO migration paths required
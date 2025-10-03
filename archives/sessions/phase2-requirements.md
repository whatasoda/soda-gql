# Phase 2: Create Builder Service

## Goal
Create a builder service that can be reused by both CLI and plugin

## Requirements

1. **Create new file**: `packages/builder/src/service.ts`

2. **Export function**: `createBuilderService(config: BuilderServiceConfig)`

3. **API surface**:
   ```typescript
   interface BuilderService {
     build(): Promise<Result<BuilderArtifact, BuilderError>>
   }
   ```

4. **Config should include**:
   - entry patterns (readonly string[])
   - analyzer type (BuilderAnalyzer: "ts" | "swc")
   - mode (BuilderMode: "runtime" | "zero-runtime")
   - optional debugDir (string | undefined)

5. **Implementation notes**:
   - Service should reuse the existing `generateArtifact` function from `runner.ts`
   - Respect same analyzer configuration (TS vs SWC) as CLI
   - Keep it simple for now - just wrap `generateArtifact` with the service interface
   - Caching/invalidation is deferred to Phase 6 (performance optimization)

6. **Export from index.ts**:
   - Export `createBuilderService` function
   - Export `BuilderService` type

## Context
- We just completed Phase 1 where we extracted `generateArtifact` API
- The `generateArtifact` function takes `BuilderInput` and returns `Result<BuilderArtifact, BuilderError>`
- This service will be used by the Babel plugin in Phase 4

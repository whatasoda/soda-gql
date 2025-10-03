# Request to Codex: Phase 2 Implementation Plan

## Context
- Phase 1 is complete: We extracted `generateArtifact` API from `runBuilder`
- `generateArtifact(options: BuilderInput): Promise<Result<BuilderArtifact, BuilderError>>` is now available
- Location: `packages/builder/src/runner.ts`

## Task
Please provide an implementation plan for Phase 2: Create Builder Service

## Requirements
1. Create `packages/builder/src/service.ts`
2. Export `createBuilderService(config: BuilderServiceConfig)` that returns `BuilderService`
3. Service interface should have: `build(): Promise<Result<BuilderArtifact, BuilderError>>`
4. Config should include: entry patterns, analyzer type, mode, optional debugDir
5. Reuse the existing `generateArtifact` function
6. Keep it simple - no caching/invalidation (deferred to Phase 6)
7. Export from `packages/builder/src/index.ts`

## What I Need from You
- Type definitions for BuilderServiceConfig and BuilderService
- Implementation approach for createBuilderService function
- What should be exported from index.ts
- Any edge cases or considerations

Note: I (Claude) will implement the actual code based on your plan.

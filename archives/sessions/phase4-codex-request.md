# Request to Codex: Phase 4 Implementation Plan

## Context
- Phases 1-3 complete:
  - `generateArtifact` and `createBuilderService` APIs available
  - Options now support discriminated union `ArtifactSource`
  - `normalizeOptions` handles both artifact-file and builder sources
- Current `pre()` in plugin.ts only supports artifact-file (throws error for builder source)

## Task
Please provide an implementation plan for Phase 4: Make plugin pre() async with builder integration

## Requirements
1. Convert `pre()` to async to support awaiting builder artifact generation
2. When `artifactSource.source === "artifact-file"`: keep existing loadArtifact() flow unchanged
3. When `artifactSource.source === "builder"`:
   - Instantiate builder service with `createBuilderService`
   - Call `service.build()` and await result
   - Handle errors appropriately
   - Normalize artifact into same `_state` structure
4. Maintain same error codes and messages for artifact-file branch
5. Document that builder mode requires Babel async APIs (`transformAsync`)

## Current Code
- Plugin pre() is in `packages/plugin-babel/src/plugin.ts:475`
- Currently has placeholder that throws for builder source

## What I Need from You
- How to make pre() async (Babel plugin compatibility)
- Error handling strategy for builder errors
- How to structure the branching logic clearly
- Any edge cases or considerations

Note: I (Claude) will implement the actual code based on your plan.

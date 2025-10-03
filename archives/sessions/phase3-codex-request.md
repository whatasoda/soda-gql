# Request to Codex: Phase 3 Implementation Plan

## Context
- Phase 1 & 2 complete: `generateArtifact` API and `createBuilderService` are available
- Current plugin options in `packages/plugin-babel/src/options.ts` only support artifact file path
- Current plugin bails out if no `artifactsPath` is provided

## Task
Please provide an implementation plan for Phase 3: Extend plugin options with discriminated union

## Requirements
1. Define discriminated union for artifact sources in `packages/plugin-babel/src/options.ts`:
   ```typescript
   type ArtifactSource =
     | { source: "artifact-file"; path: string }
     | { source: "builder"; config: BuilderConfig }
   ```
2. Update `normalizeOptions` to handle both branches
3. Update Zod schema validation to cover both artifact sources
4. Keep existing error messages for artifact-file branch unchanged
5. Ensure backward compatibility where possible

## Current Implementation
- Options are in `packages/plugin-babel/src/options.ts`
- Plugin entry point is `packages/plugin-babel/src/plugin.ts`

## What I Need from You
- Exact type definitions for the discriminated union
- How to structure BuilderConfig type (what fields from BuilderServiceConfig to include?)
- How to update normalizeOptions function
- How to update Zod schema
- Any migration or compatibility considerations

Note: I (Claude) will implement the actual code based on your plan.

# soda-gql - Vision

## Purpose
Enable a complete fragment-centric GraphQL development workflow where tagged template fragments serve as the primary type-safe building blocks, composable into colocated operations with metadata and runtime data extraction.

## Goals
- [x] Tagged template fragments can spread other fragments — `fragment\`...on Query { ...UserFragment }\`` syntax enables composition between tagged template fragments, with `buildFieldsFromSelectionSet` handling `FragmentSpread` nodes
- [x] Tagged template fragment `$infer` provides accurate types — both input (variables) and output (selected fields) type inference works correctly, enabling fragments as the primary type source for application implementation
- [x] Query-level fragments can be defined via callback builder with fragment references — a clear pattern exists for defining top-level resolver unit fragments (on Query/Mutation) that spread entity-level tagged template fragments
- [x] Multiple query fragments can be combined into a single operation — `$colocate` workflow functions end-to-end from tagged template fragment definitions through callback builder operations to a merged GraphQL document
- [x] Tagged template fragments support metadata callbacks — metadata can be generated via context-aware callback functions, not limited to static objects
- [x] E2E colocation workflow is demonstrated in playground — a working example exists showing fragment definition → operation composition → runtime data extraction with `createProjectionAttachment`

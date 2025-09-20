# Contract — `@soda-gql/plugin-babel`

## Purpose
Transform TypeScript/JavaScript source files by replacing soda-gql runtime constructs with references to generated documents from the builder artifact, enabling zero-runtime operation.

## Inputs
- Babel plugin options object:
  ```ts
  interface SodaGqlBabelOptions {
    mode: "runtime" | "zero-runtime";
    artifactsPath: string; // validated via zod, absolute path recommended
    importIdentifier?: string; // defaults to "@/graphql-system"
    diagnostics?: "json" | "console";
  }
  ```

## Behavior (GREEN)
1. Load artifact JSON via neverthrow `Result` with zod validation.
2. Traverse AST; for each soda-gql construct:
   - Resolve canonical identifier.
   - Replace inline document definition with `import { gql } from "@/graphql-system"; const doc = gql("DocumentName");` in zero-runtime mode.
   - Leave runtime constructs intact when `mode === "runtime"`.
3. Inject import once per file; ensure tree-shakeable registration (top-level only).
4. Emit diagnostics (console or JSON) summarizing transformed documents.

## Failure Cases (RED)
| Scenario | Expected Behavior |
|----------|------------------|
| Artifact file missing | Throw Babel error with message `SODA_GQL_ARTIFACT_NOT_FOUND` |
| Document name missing in artifact | Throw error referencing canonical identifier |
| Unsupported usage (e.g., dynamic refs) | Throw error `SODA_GQL_UNSUPPORTED_PATTERN` with suggestion to refactor |

## Contract Tests (to be written)
1. `plugin_missing_artifact.test.ts` → Configure plugin with nonexistent file; expect Babel error.  
2. `plugin_zero_runtime_transform.test.ts` → Snapshot transformed code referencing generated import (GREEN once builder/CLI ready).  
3. `plugin_runtime_passthrough.test.ts` → Mode `runtime` leaves source unchanged (GREEN once logic exists).

## Dependencies
- `packages/plugin-babel`
- `packages/builder` artifact JSON
- Babel core (peer dependency)

# Testing Strategy Guide (Pre-release Reset)

## Intent
Rebuild the test suite to validate the new IR-centric pipeline. Eliminate coverage for deprecated behaviors and assume we can delete or rename any public surface to support better tests.

## Principles
- Tests should exercise the desired architecture, not the legacy implementations.
- Prefer deterministic snapshots of IR, diagnostics, and runtime code over indirect behavioral assertions.
- Remove brittle fixtures and regenerate them under the new package layout.
- Gate merges on coverage thresholds that reflect the rewritten system, not historical baselines.

## Strategy Overview
1. Establish foundational unit tests for analyzer passes, IR validators, and diagnostic factories.
2. Create contract suites that snapshot artifacts produced by the pipeline.
3. Add end-to-end pipelines that run the CLI against representative projects using the new workflow.
4. Integrate coverage and watch commands aligned with the rewritten packages.

## Implementation Steps

### 1. Baseline the New World
1. Delete obsolete coverage data and fixtures tied to `.ts` intermediate modules.
2. Capture a fresh coverage baseline after the first IR-powered tests land.

### 2. Unit Test Pillars
1. `tests/unit/analyzer-swc/*`: Verify each analyzer pass with focused fixtures.
2. `tests/unit/ir/*`: Ensure schema guards reject malformed IR.
3. `tests/unit/diagnostics/*`: Validate severity handling, location attachment, and NDJSON formatting.

### 3. Contract Snapshots
1. Create `tests/contract/pipeline/` that runs `analyzeModule → emitArtifact` and snapshots both IR (`.json`) and generated runtime modules (`.ts`).
2. Add Babel plugin snapshots that assert on the transformed code after consuming the new IR.
3. Regenerate snapshots aggressively; we are free to change their shape when architecture evolves.

### 4. End-to-end CLI Runs
1. Build miniature fixture projects under `tests/fixtures/projects/*` with varying schema complexity.
2. Run the new CLI (`bun run cli pipeline --format ndjson`) and assert on exit codes + diagnostics payloads.
3. Capture artifact store outputs to ensure deterministic hashes.

### 5. Tooling Integration
1. Update `package.json` scripts: `test:unit`, `test:contract`, `test:integration`, `test:pipeline`.
2. Add a `just verify` recipe that runs the full suite plus `bun run typecheck` and `bun run biome:check`.
3. Configure coverage thresholds (e.g., `branches: 80`, `functions: 85`, `lines: 85`). Fail the build when thresholds are not met.

## Validation Commands
```bash
bun test tests/unit --reporter spec
bun test tests/contract --update-snapshots
bun test tests/integration/pipeline
bun run coverage
```

## Rollback Policy
If a test becomes brittle because the architecture keeps evolving, delete it and replace it with coverage that matches the updated design. Do **not** cling to legacy assertions.

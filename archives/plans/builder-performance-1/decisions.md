---
role: "constraints"
includes_by_default: false
best_for_query:
  - "why was X decided"
  - "technical constraints"
  - "architecture decisions"
last_updated: 2025-10-05
---

# Builder Performance - Decisions & Constraints

## Architecture Decisions

### Direct Replacement Approach
**Decision:** Replace existing code directly, no feature flags or dual-path maintenance
**Rationale:** Pre-release status (v0.1.0) allows breaking changes
**Impact:** Faster iteration, simpler codebase, git-based rollback only

### Git-Based Rollback
**Decision:** Use git revert instead of compatibility layers
**Rationale:** Pre-release status, no backward compatibility required
**Impact:** Clean architecture, no legacy code burden

### Breaking Changes Acceptable
**Decision:** Focus on ideal architecture over backward compatibility
**Rationale:** v0.1.0 status, no migration paths needed
**Impact:** Freedom to optimize aggressively

### Test-Driven Validation
**Decision:** Rely on comprehensive test suite for correctness
**Rationale:** Behavioral testing ensures identical output despite internal changes
**Impact:** Confidence in refactors, reduced manual QA

## Technical Constraints

### Tooling
- **Bun only:** All operations use Bun (not npm/yarn/pnpm)
- **Node.js APIs:** Keep code compatible with standard Node.js runtime
- **Rationale:** Project standard, runtime flexibility

### Development Methodology
- **TDD mandatory:** RED → GREEN → REFACTOR (t_wada methodology)
- **No mocks:** Use real dependencies in tests
- **Rationale:** Catch integration issues early, realistic test scenarios

### Error Handling
- **neverthrow only:** Use ok()/err() functions exclusively
- **NO fromPromise:** Loses type information
- **Never throw:** Return Result types
- **Rationale:** Type-safe error handling, explicit error paths

### Code Organization
- **NO classes** for state management
- **Pure functions** preferred for testability
- **Minimize** dependencies and coupling
- **Rationale:** Functional paradigm, easier to reason about

### Testing Standards
- **Fixture-based:** Store test code as .ts files in tests/fixtures/
- **Behavioral:** Test execution results, not output format
- **Type-checked:** Fixtures validated by tests/tsconfig.json
- **Rationale:** Type safety, refactoring support, realistic tests

## Strategy Dependencies

### Sequential Implementation Required
```
Prerequisites (benchmarks)
    ↓
Strategy 1 (session APIs)
    ↓
Strategy 2 (fingerprints) ← requires session.update()
    ↓
Strategy 3 (graph pruning) ← requires Strategy 1 + 2
```

**Critical Path:**
- Strategy 2 feeds fingerprints into Strategy 1's update() path
- Strategy 3 uses Strategy 2 fingerprints for change detection
- Strategy 3 uses Strategy 1 session APIs for cache invalidation

### Config Package Dependency
**Decision:** Strategy 3 depends on @soda-gql/config
**Rationale:** Generated .mjs files need path alias resolution
**Impact:** Config system must complete before Strategy 3 validation
**Status:** ✅ Complete (commit d218e27, 51 tests passing)

## Implementation Philosophy

### V1 Pragmatism (Strategy 1)
**Decision:** V1 uses full rebuild fallback instead of true incremental
**Rationale:** Correctness over performance in initial implementation
**Trade-off:** Doesn't meet 40% repeat build target, but provides foundation
**Result:** Strategy 2 delivered performance via fingerprints anyway

### Chunk-Based Architecture (Strategy 3)
**Decision:** One chunk per source file, not module
**Rationale:** Simplifies invalidation, aligns with file-level changes
**Trade-off:** More chunks vs fewer larger chunks
**Result:** Clean separation, predictable invalidation

### Artifact Delta Simplification (Strategy 3)
**Decision:** Build full artifact from all chunks, not delta-based
**Rationale:** Simpler implementation, correctness guaranteed
**Trade-off:** Rebuild entire artifact vs merge deltas
**Result:** Cleaner code, no delta bugs

## Key Trade-offs

### Performance vs Correctness
**Choice:** Correctness first, optimize later
**Example:** V1 full rebuild fallback
**Result:** Stable foundation, performance came via Strategy 2

### Simplicity vs Optimization
**Choice:** Simple implementation over premature optimization
**Example:** Full artifact rebuild instead of delta merge
**Result:** Fewer bugs, easier to maintain

### Breaking Changes vs Compatibility
**Choice:** Break APIs for better design
**Example:** Required config in BuilderInput
**Result:** Cleaner API, proper path resolution

## References

- Full plan: [reference/plan-original.md](./reference/plan-original.md)
- Current progress: [progress.md](./progress.md)
- Milestones: [history.md](./history.md)

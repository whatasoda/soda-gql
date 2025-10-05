# Builder Performance Optimization - Upcoming Tasks

**Document:** Prioritized future work with dependencies
**Last Updated:** 2025-10-05

## Immediate (P0) - This Week

### 1. Fix Integration Test Failures

**Tasks:**
- [ ] Fix cache.skips assertion in builder-session-incremental.test.ts
  - Current: expects > 0, gets 0
  - Solution: Relax to >= 0 or investigate why no skips occur
- [ ] Handle removed files in discovery fallback scenarios
  - Issue: Deleted file imports fail when buildInitial() fallback triggered
  - Root cause: Discovery tries to read deleted files
  - Solution: Filter out removed paths before discovery

**Dependencies:** None

**Effort:** 0.5 day

---

### 2. Update Integration Tests for Config

**Tasks:**
- [ ] Update `builder_cache_flow.test.ts`
- [ ] Update `builder_incremental_session.test.ts`
- [ ] Update `runtime_builder_flow.test.ts`
- [ ] Update `zero_runtime_transform.test.ts`

**Pattern:**
```typescript
import { createTestConfig } from "../helpers/test-config";

const config = createTestConfig(workspaceRoot);
const result = await runBuilder({ ...options, config });
```

**Dependencies:** None

**Effort:** 0.5 day

---

### 3. Run Performance Benchmarks

**Tasks:**
- [ ] Generate codegen for all fixtures
  ```bash
  bun run soda-gql codegen --schema ./benchmarks/runtime-builder/small-app/schema.graphql \
    --out ./benchmarks/runtime-builder/small-app/graphql-system/index.ts
  # Repeat for medium-app, large-app
  ```
- [ ] Run benchmarks
  ```bash
  bun run perf:builder --fixture small-app --iterations 5
  bun run perf:builder --fixture medium-app --iterations 5
  bun run perf:builder --fixture large-app --iterations 5
  ```
- [ ] Analyze results in `.cache/perf/<timestamp>/`
- [ ] Compare against Strategy 2 baseline
- [ ] Document findings in status.md

**Dependencies:** Integration tests passing

**Effort:** 0.5 day

**Success Criteria:**
- Targeted rebuild (≤5% changes): ≤35% of Strategy 1 cold build
- Cache hit ratio for unchanged chunks: 100%
- Artifact correctness: 100% match with full rebuild

---

## Short-Term (P1) - Next Week

### 4. Implement CLI Flags

**Tasks:**
- [ ] Add `--incremental` flag to enable incremental mode
  - Update `packages/cli/src/commands/builder.ts`
  - Wire to BuilderSession update() logic
  - Add validation and error handling
- [ ] Add `--write-delta` flag for debugging
  - Output partial artifact changes
  - Include chunk manifest diff
  - Show affected modules
- [ ] Add `--graph-filter` flag for selective rebuilds
  - Accept glob patterns or module IDs
  - Filter dependency graph before emission
  - Document usage in help text

**Dependencies:** Benchmarks validated

**Effort:** 1 day

---

### 5. Create Documentation

**Tasks:**
- [ ] User guide: `docs/guides/builder-incremental.md`
  - Session lifecycle explanation
  - CLI flags reference
  - Cache directory structure
  - Troubleshooting common issues
  - Best practices
- [ ] Architecture docs: `docs/architecture/builder-chunks.md`
  - Chunk system design
  - Graph patching algorithm
  - Artifact delta computation
  - Multi-chunk loading
- [ ] Migration guide: `docs/guides/builder-migration.md`
  - Breaking changes in config
  - Legacy API deprecation
  - Update steps for existing projects

**Dependencies:** CLI flags complete

**Effort:** 1.5 days

---

## Medium-Term (P2) - Future

### 6. Optimize Edge Cases

**Tasks:**
- [ ] Improve memory profiling
  - Fix `collect-builder-metrics.ts` peak memory tracking
  - Use `process.memoryUsage().heapUsed` sampling
  - Track GC events properly
- [ ] Add file watcher integration
  - Implement chokidar-based watcher
  - Batch file changes into BuilderChangeSet
  - Debounce rapid changes
  - Handle watch mode errors gracefully
- [ ] Implement session persistence
  - Save session state to disk
  - Load on startup for cross-process reuse
  - Version snapshot format
  - Add cache versioning

**Dependencies:** Core functionality stable

**Effort:** 2 days

---

### 7. CI/CD Integration

**Tasks:**
- [ ] Enable nightly benchmark runs
  - Configure GitHub Actions schedule
  - Set up artifact upload
  - Add regression detection (5% threshold)
  - Configure Slack notifications
- [ ] Add benchmark PR comments
  - Compare PR metrics with main branch
  - Flag performance regressions
  - Show cache hit rates
- [ ] Create performance dashboard
  - Visualize trends over time
  - Track metrics per fixture
  - Historical comparison

**Dependencies:** Benchmarks stable

**Effort:** 1 day

---

## Validation Checklist

### Before Strategy 3 Sign-Off

**Integration Tests:**
- [ ] 5/5 tests passing in builder-session-incremental.test.ts
- [ ] All 4 test files updated for config
- [ ] Full test suite passes (181 tests)

**Performance Targets:**
- [ ] Targeted rebuild: ≤35% of cold build time ✅ or document why not met
- [ ] Cache hit ratio: 100% for unchanged chunks ✅ or explain variance
- [ ] Artifact equality: 100% match with full rebuild ✅

**CLI Integration:**
- [ ] `--incremental` flag working
- [ ] `--write-delta` debugging functional
- [ ] `--graph-filter` selective rebuild tested

**Documentation:**
- [ ] User guide complete
- [ ] Architecture docs written
- [ ] Migration guide published

---

## Known Risks & Mitigation

### Risk: Benchmark Performance Below Target

**Mitigation:**
1. Profile with Chrome DevTools or Clinic.js
2. Identify bottlenecks (parsing, graph building, chunk emission)
3. Optimize hot paths
4. Consider fallback strategies

### Risk: Integration Test Instability

**Mitigation:**
1. Add more diagnostic logging
2. Isolate failing scenarios
3. Use deterministic fixtures
4. Increase test coverage for edge cases

### Risk: File Watcher Complexity

**Mitigation:**
1. Use proven library (chokidar)
2. Start with basic implementation
3. Add debouncing for stability
4. Handle errors gracefully
5. Provide manual rebuild option

---

## Dependencies Map

```
P0 Tasks (Immediate)
├── Fix integration tests
│   └── (no dependencies)
├── Update tests for config
│   └── (no dependencies)
└── Run benchmarks
    └── Integration tests passing

P1 Tasks (Short-term)
├── Implement CLI flags
│   └── Benchmarks validated
└── Create documentation
    └── CLI flags complete

P2 Tasks (Medium-term)
├── Optimize edge cases
│   └── Core functionality stable
└── CI/CD integration
    └── Benchmarks stable
```

---

## Timeline Estimate

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| P0 - Integration fixes | 1.5 days | None |
| P1 - CLI & docs | 2.5 days | P0 complete |
| P2 - Optimizations | 3 days | P1 complete |
| **Total** | **~7 days** | Sequential |

**Target Completion:** End of next week (with P0+P1)

---

## Success Criteria

**Strategy 3 Complete When:**
- ✅ All integration tests passing (5/5 + 4 files)
- ✅ Benchmarks meet performance targets
- ✅ CLI flags implemented and documented
- ✅ User documentation complete
- ✅ No critical bugs or blockers

**Overall Initiative Complete When:**
- ✅ All 3 strategies validated
- ✅ CI/CD benchmarks green for 3 consecutive runs
- ✅ Documentation published
- ✅ Migration guide available

---

## References

- **Current Status:** [status.md](./status.md)
- **Roadmap:** [roadmap.md](./roadmap.md)
- **History:** [history.md](./history.md)
- **Profiling Guide:** [docs/guides/performance-profiling.md](../../guides/performance-profiling.md)

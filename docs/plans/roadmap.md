# soda-gql Development Roadmap

**Version**: 0.1.0 (Pre-Release)
**Status**: In Progress
**Last Updated**: 2025-10-06

---

## Progress Summary

### ✅ Completed: PL-1 Foundation Portability (Week 1-2)
**Status**: COMPLETED (2025-10-06)

**PL-1A: Implement Portability Layer**
- ✅ Runtime detection utilities (runtime.ts)
- ✅ Portable filesystem API (fs.ts)
- ✅ Portable hashing API (hash.ts)
- ✅ Portable ID generation (id.ts)
- ✅ Portable subprocess spawning (spawn.ts)
- ✅ Unit tests (23 tests passing)

**PL-1B: Migrate Existing Code**
- ✅ Builder package (6 files): ast/core, discovery/common, cache/json-cache, chunk-writer, emitter, debug-writer
- ✅ Test utilities (4 files): base, index, transform, cli
- ✅ All 315 tests passing, no regressions
- ✅ TypeScript compilation: 0 errors

**Commits**: da1ccbd, d17f8d6, 233672f, b1e9346

### ✅ Completed: DI Dependency Integrity (Week 3-4)
**Status**: COMPLETED (2025-10-06)

**DI-2: Runtime Dependency Resolution Bug**
- ✅ DI-2A: Implemented filesystem-aware module resolver (resolver.ts)
- ✅ DI-2B: Integrated resolver into dependency graph, made resolution async
- ✅ Fixes: .tsx and index.tsx imports now visible to dependency graphs
- ✅ All tests passing with async resolution

**DI-4: Cache Invalidation Defect**
- ✅ DI-4A: Added cache metadata types and schema hash computation
- ✅ DI-4B: Propagated schema hash through codegen CLI to builder
- ✅ Fixes: Schema/config changes now invalidate cache correctly
- ✅ Breaking change: BuilderInput now requires schemaHash field

**DI-6: Inefficient Chunk Writing**
- ✅ DI-6A: Implemented chunk manifest with content-hash short-circuit
- ✅ DI-6B: Integrated manifest into builder session lifecycle
- ✅ Fixes: Unchanged chunks skipped, significant performance improvement
- ✅ Build reports now show chunks.written and chunks.skipped statistics

**Commits**: e7858b1, 12caa88, a3ce47c, 4cf0920, 62194eb, 91282b0

### 🚧 In Progress: DX Performance & Developer Experience (Week 5-6)
**Status**: IN PROGRESS (Started 2025-10-06)

**DX-8A/8B: Package Design Cleanup**
- ✅ DX-8A: Created internal modules and tightened exports
  - Moved builder/session → builder/internal/session
  - Moved builder/intermediate-module → builder/internal/intermediate-module
  - Moved plugin-babel internals to internal/ subdirectories
  - Flattened nested directory structures
  - Updated package.json exports to block ./internal/* access
- ✅ DX-8B: Tightened package boundaries
  - Created public API re-export surfaces (change-set.ts, errors.ts)
  - Renamed createPlugin → createSodaGqlPlugin
  - Updated tsconfig.json with explicit path aliases
  - All tests passing (315 pass, 1 skip, 0 fail)
  - TypeScript compilation: 0 errors
- ⏭️ Skipped: CLI config loader unification (deferred - different use case)

**DX-10: Plugin Artifact Memoization**
- ⏳ Pending

**DX-9A: Builder neverthrow Migration**
- ⏳ Pending

**DX-9B: Plugin neverthrow Migration**
- ⏳ Pending

**Commits**: 2f710fa (WIP), 2c25766 (completed DX-8A/8B)

**Next**: DX-9A (Builder error handling) or DX-10 (artifact caching)

---

## Release Context

soda-gql is at **pre-release v0.1.0**:
- All refactors and architectural changes are encouraged
- Breaking changes are acceptable
- NO migration paths required
- Prioritize ideal architecture over backwards compatibility

---

## Overview

This roadmap consolidates all improvement initiatives into two parallel tracks:

1. **Core Platform Track**: Foundation, bug fixes, optimizations, quality assurance
2. **Plugin Ecosystem Track**: Shared abstractions and bundler-specific plugins

---

## Milestone Calendar

| Week | Core Platform | Plugin Ecosystem | Status |
|------|---------------|------------------|--------|
| 1-2 | **PL-1** Foundation Portability | - | ✅ Completed |
| 3-4 | **DI** Dependency Integrity (parallel tasks) | **PE-Shared** Shared Layer | ✅ Completed |
| 5-6 | **DX** Performance & DX Improvements | **PE-Vite** Vite Plugin | 🚧 In Progress (DX-8A/8B ✅) |
| 7-8 | **QA** Quality Assurance | **PE-Metro**, **PE-NestJS** | Blocked by DX |
| 9 | Release Preparation | **PE-Release** Release Readiness | Blocked by QA |

---

## Dependency Graph

```
roadmap.md (YOU ARE HERE)
    │
    ├─ Core Platform Track
    │   │
    │   ├─ PL-1: Foundation Portability ────────────────┐
    │   │   └─ docs/plans/core-platform/                │
    │   │      foundation-portability.md                │
    │   │                                                ▼
    │   ├─ DI: Dependency Integrity ───> Depends on: PL-1
    │   │   ├─ DI-2: Resolver Hardening    ┐
    │   │   ├─ DI-6: Chunk Pipeline        ├─ Parallel
    │   │   └─ DI-4: Cache Invalidation    ┘
    │   │   └─ docs/plans/core-platform/
    │   │      dependency-integrity.md
    │   │                                                ▼
    │   ├─ DX: Performance & DX ──────────> Depends on: DI
    │   │   ├─ DX-10: Artifact Memoization
    │   │   ├─ DX-9: neverthrow Migration
    │   │   └─ DX-8: Package Boundaries
    │   │   └─ docs/plans/core-platform/
    │   │      performance-and-dx.md
    │   │                                                ▼
    │   └─ QA: Quality Assurance ────────> Depends on: DX
    │       ├─ QA-7A: Coverage & Documentation
    │       └─ QA-7B: Test Suite Expansion
    │       └─ docs/plans/core-platform/
    │          quality-assurance.md
    │
    └─ Plugin Ecosystem Track
        │
        ├─ PE-Shared: Shared Layer ──────> Depends on: PL-1
        │   └─ docs/plans/plugin-ecosystem/
        │      shared-layer.md
        │                                                ▼
        ├─ PE-Vite: Vite Plugin ─────────> Depends on: PE-Shared
        │   └─ docs/plans/plugin-ecosystem/
        │      plugin-vite.md
        │                                                ▼
        ├─ PE-Metro: Metro Plugin ───────> Depends on: PE-Shared
        │   └─ docs/plans/plugin-ecosystem/
        │      plugin-metro.md
        │                                                ▼
        ├─ PE-NestJS: NestJS Plugin ─────> Depends on: PE-Shared
        │   └─ docs/plans/plugin-ecosystem/
        │      plugin-nestjs.md
        │                                                ▼
        └─ PE-Release: Release Readiness ─> Depends on: All PE-*
            └─ docs/plans/plugin-ecosystem/
               release-readiness.md

Quality Assurance gates release of both tracks
```

---

## Task ID Reference

### Core Platform Track

| ID | Task | Duration | Dependencies | Document |
|----|------|----------|--------------|----------|
| **PL-1A** | Implement Portability Layer | 3-4 days | None | foundation-portability.md |
| **PL-1B** | Migrate Existing Code | 4-5 days | PL-1A | foundation-portability.md |
| **DI-2A** | Harden Module Resolver | 3-4 days | PL-1B | dependency-integrity.md |
| **DI-2B** | Align Path Utilities | 1-2 days | DI-2A | dependency-integrity.md |
| **DI-6A** | Chunk Hash Short-Circuit | 3-4 days | PL-1B | dependency-integrity.md |
| **DI-6B** | Chunk Manifest Management | 1-2 days | DI-6A | dependency-integrity.md |
| **DI-4A** | Schema Versioning in Cache | 3-4 days | PL-1B | dependency-integrity.md |
| **DI-4B** | Propagate Schema Hash | 1-2 days | DI-4A | dependency-integrity.md |
| **DX-10** | Artifact Memoization | 3-4 days | DI-2B, DI-6B, DI-4B | performance-and-dx.md |
| **DX-9A** | Builder Error Handling | 4-5 days | DI-2B, DI-6B, DI-4B | performance-and-dx.md |
| **DX-9B** | Plugin Error Handling | 2-3 days | DX-9A | performance-and-dx.md |
| **DX-8A** | Package Internal Modules | 3-4 days | DX-9B | performance-and-dx.md |
| **DX-8B** | Unify Config Loading | 1-2 days | DX-8A | performance-and-dx.md |
| **QA-7A** | Coverage & Documentation | 1-2 days | DX-8B | quality-assurance.md |
| **QA-7B** | Test Suite Expansion | 5-7 days | QA-7A | quality-assurance.md |

### Plugin Ecosystem Track

| ID | Task | Duration | Dependencies | Document |
|----|------|----------|--------------|----------|
| **PE-Shared** | Shared Abstraction Layer | 5-6 days | PL-1B | shared-layer.md |
| **PE-Vite** | Vite Plugin Implementation | 4-5 days | PE-Shared | plugin-vite.md |
| **PE-Metro** | Metro Transformer | 4-5 days | PE-Shared | plugin-metro.md |
| **PE-NestJS** | NestJS Plugin | 4-5 days | PE-Shared | plugin-nestjs.md |
| **PE-Release** | Documentation & Release Prep | 3-4 days | PE-Vite, PE-Metro, PE-NestJS | release-readiness.md |

---

## Parallelization Opportunities

### Week 3-4: DI Tasks (After PL-1)

All three DI workstreams can run in parallel:
- **DI-2** (Resolver): Independent file/module resolution
- **DI-6** (Chunks): Independent build pipeline optimization
- **DI-4** (Cache): Independent cache invalidation logic

**Shared Dependencies**: All use `getPortableFS()` and `getPortableHasher()` from PL-1.

### Week 5-6: Plugin Development (After PE-Shared)

Plugin implementations can proceed in parallel:
- **PE-Vite**: Priority first (lessons learned flow to others)
- **PE-Metro** & **PE-NestJS**: Can start simultaneously after Vite establishes patterns

---

## Success Criteria

### Core Platform Track

- [x] **PL-1**: All code runs on both Bun and Node.js
- [x] **DI**: Resolver handles .tsx, chunks skip unchanged writes, schema changes invalidate cache
- [~] **DX**: Package exports tightened ✅, artifact memoization pending, neverthrow migration pending
- [ ] **QA**: 80%+ test coverage, comprehensive testing guide

### Plugin Ecosystem Track

- [ ] **PE-Shared**: Reusable abstractions extracted from plugin-babel
- [ ] **PE-Vite**: Vite plugin transforms identically to plugin-babel
- [ ] **PE-Metro**: React Native bundler integration working
- [ ] **PE-NestJS**: NestJS webpack plugin functional
- [ ] **PE-Release**: Documentation complete, migration guides written

---

## Detailed Plans

### Core Platform Track

1. **[Foundation: Portability Layer](./core-platform/foundation-portability.md)** (Weeks 1-2)
   - Runtime-agnostic APIs for filesystem, hashing, process spawning
   - Migrate all Bun-specific code to portable abstractions
   - **Entry Criteria**: None (foundational)
   - **Exit Criteria**: All tests pass on Bun + Node.js

2. **[Dependency Integrity](./core-platform/dependency-integrity.md)** (Weeks 3-4)
   - Fix resolver to handle .tsx and index.tsx imports
   - Optimize chunk writing with content hash comparison
   - Invalidate cache on schema/config changes
   - **Entry Criteria**: PL-1 complete
   - **Exit Criteria**: All DI tests pass, performance targets met

3. **[Performance & Developer Experience](./core-platform/performance-and-dx.md)** (Weeks 5-6)
   - Memoize plugin artifacts for faster watch mode
   - Migrate to type-safe error handling with neverthrow
   - Clean up package boundaries and exports
   - **Entry Criteria**: DI complete
   - **Exit Criteria**: DX improvements validated, no performance regressions

4. **[Quality Assurance](./core-platform/quality-assurance.md)** (Weeks 7-8)
   - Establish coverage targets and testing documentation
   - Expand test suites for all new features
   - CI integration with coverage gates
   - **Entry Criteria**: DX complete
   - **Exit Criteria**: 80%+ coverage, all tests reliable

### Plugin Ecosystem Track

1. **[Shared Abstraction Layer](./plugin-ecosystem/shared-layer.md)** (Weeks 3-4)
   - Extract reusable logic from plugin-babel
   - Options normalization, state management, caching
   - **Entry Criteria**: PL-1 complete
   - **Exit Criteria**: plugin-babel refactored to use shared layer

2. **[Vite Plugin](./plugin-ecosystem/plugin-vite.md)** (Weeks 5-6)
   - Transform hook with Babel integration
   - HMR support and dev server integration
   - **Entry Criteria**: PE-Shared complete
   - **Exit Criteria**: Vite builds work, HMR functional

3. **[Metro Plugin](./plugin-ecosystem/plugin-metro.md)** (Weeks 5-6)
   - Metro transformer implementation
   - React Native compatibility
   - **Entry Criteria**: PE-Shared complete
   - **Exit Criteria**: React Native app builds successfully

4. **[NestJS Plugin](./plugin-ecosystem/plugin-nestjs.md)** (Weeks 5-6)
   - Webpack integration for NestJS
   - CLI prebuild step
   - **Entry Criteria**: PE-Shared complete
   - **Exit Criteria**: NestJS app compiles and runs

5. **[Release Readiness](./plugin-ecosystem/release-readiness.md)** (Week 9)
   - Cross-plugin documentation
   - Migration guides
   - Release preparation
   - **Entry Criteria**: All PE-* complete
   - **Exit Criteria**: Ready for v0.1.0 release

---

## Risk Management

### Performance Risks

- **Portability overhead**: Mitigated by benchmarking and Bun fast-paths
- **Resolver filesystem checks**: Mitigated by caching and batch operations
- **Chunk hash comparisons**: Expected to improve performance (fewer writes)

### Technical Risks

- **neverthrow migration**: Large refactor, mitigated by incremental adoption
- **Plugin ecosystem complexity**: Mitigated by shared abstractions and sequential rollout

### Timeline Risks

- **Dependencies block parallel work**: Mitigated by clear dependency graph and early PL-1 completion
- **Testing takes longer than estimated**: QA-7B has buffer time (5-7 days range)

---

## Rollback Strategy

Each major milestone has a rollback plan:

1. **Feature Flags**: Can disable new features via environment variables
2. **Git Tags**: Tag before each phase (`pre-portability-layer`, `pre-neverthrow`, etc.)
3. **Gradual Rollout**: Core platform and plugin ecosystem are independent

---

## Getting Started

### For Core Platform Work

1. Start with **[PL-1: Foundation Portability](./core-platform/foundation-portability.md)**
2. Ensure all tests pass on both Bun and Node.js
3. Proceed to DI tasks in parallel

### For Plugin Ecosystem Work

1. Wait for PL-1 completion
2. Start with **[PE-Shared: Shared Layer](./plugin-ecosystem/shared-layer.md)**
3. Implement plugins sequentially (Vite → Metro/NestJS)

### For Testing Work

1. Review **[Quality Assurance Plan](./core-platform/quality-assurance.md)**
2. Set up testing infrastructure early
3. Add tests incrementally as features land

---

## Progress Tracking

**Recommended Tools**:
- GitHub Projects: Track tasks by ID
- GitHub Milestones: One per major deliverable (PL-1, DI, DX, QA, PE-*)
- GitHub Labels: `core-platform`, `plugin-ecosystem`, `testing`, `documentation`

**Weekly Sync**:
- Review completed tasks
- Update dependency status
- Adjust timeline estimates
- Identify blockers

---

## Next Steps

- [ ] Review and approve this roadmap
- [ ] Set up project board with task IDs
- [ ] Assign owners to each track
- [ ] Create feature branch: `feat/portability-layer`
- [ ] Begin PL-1A implementation

---

## Questions or Feedback?

For questions about:
- **Core Platform**: See individual plan documents in `docs/plans/core-platform/`
- **Plugin Ecosystem**: See individual plan documents in `docs/plans/plugin-ecosystem/`
- **Testing Strategy**: See `docs/plans/core-platform/quality-assurance.md`
- **Overall Direction**: Open an issue or discussion

---

**Document History**:
- 2025-10-05: Initial roadmap created from consolidated plans

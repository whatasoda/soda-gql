# Memory Optimization Lessons Learned

This document summarizes lessons learned from builder memory optimization experiments conducted on the soda-gql project. These insights apply broadly to V8/Node.js memory optimization.

## Table of Contents

- [Overview](#overview)
- [What Works: Release at Source](#what-works-release-at-source)
- [What Doesn't Work](#what-doesnt-work)
- [Decision Framework](#decision-framework)
- [Benchmarking Best Practices](#benchmarking-best-practices)
- [Summary](#summary)

## Overview

We conducted multiple optimization experiments (A through J) targeting builder memory usage. Only one approach succeeded, providing valuable insights into V8 memory behavior.

**Key Finding**: Runtime object manipulation doesn't reduce memory because V8 can't garbage collect objects still referenced in scope. The only effective approach is releasing data at the source, before storing.

## What Works: Release at Source

**Experiment A+B** achieved ~50% wall time improvement by releasing `sourceCode` and `transpiledCode` immediately after `Script` object creation.

```typescript
// evaluation.ts - generateIntermediateModules

// Create Script object (this compiles and retains the code internally)
const script = new Script(transpiledCode);

// Release the source strings immediately - Script has what it needs
yield {
  filePath,
  canonicalIds,
  sourceCode: "",         // Released at source
  transpiledCode: "",     // Released at source
  contentHash,
  script,                 // Script retains compiled bytecode
};
```

**Why this works**: By never storing the large strings in the yielded object, V8 can immediately garbage collect them. The `Script` object retains its own compiled representation internally.

## What Doesn't Work

### 1. Object Manipulation After Storage

**Experiments E, F, G, I** attempted to filter or modify objects after they were stored. All failed.

```typescript
// BAD: Filter creates new array + new objects
const filtered = analysis.imports.filter(x => !x.isExternal);

// BAD: Spread creates new object
const slimmed = { ...analysis, exports: [] };
```

**Why it fails**: These operations create NEW objects via V8's hidden class allocation. The overhead of creating new objects typically exceeds any memory savings from smaller data structures.

**Results**: +5% to +27% heap increase instead of decrease.

### 2. In-place Mutation of Readonly Objects

**Experiment I variant** attempted to mutate readonly TypeScript objects.

```typescript
// BAD: Mutating readonly object
(analysis as any).exports = [];
(analysis as any).diagnostics = [];
```

**Why it fails**: V8 optimizes objects based on their shape (hidden classes). Mutating object shapes after creation triggers de-optimization, resulting in significant performance penalties.

**Results**: +85% wall time regression.

### 3. Lazy Computation for Small Data

**Experiments C, H** attempted lazy initialization patterns.

```typescript
// BAD: Lazy for small data
class IntermediateModule {
  private _script?: Script;

  get script() {
    return this._script ??= new Script(this.code);
  }
}
```

**Why it fails**: Getter function call overhead, nullish coalescing check, and property access all add up. For small data that's always used, eager computation is faster.

**Results**: +6% CI regression (Experiment H).

### 4. Filtering Small Data

**Experiments I, J** targeted small fields like `exports` and `diagnostics`.

```
xxlarge fixture (2089 files):
- exports + diagnostics: ~2MB
- Total snapshot memory: ~360MB
- Potential savings: 0.5%
- Actual overhead: +5% to +27%
```

**Why it fails**: The overhead of any optimization operation exceeds the benefit when targeting small data. Always measure actual data sizes before optimizing.

## Decision Framework

Use this checklist before attempting memory optimization:

```
1. Is the data large? (>10% of total memory)
   NO  -> Don't optimize. Overhead will exceed savings.
   YES -> Continue...

2. Can I avoid storing it in the first place?
   YES -> Release at source. This is the only reliable pattern.
   NO  -> Continue...

3. Will optimization create new objects?
   YES -> Don't optimize. V8 hidden class allocation adds memory.
   NO  -> Continue...

4. Will optimization mutate existing objects?
   YES -> Don't optimize. V8 de-optimization penalties.
   NO  -> Proceed carefully with benchmarks.
```

## Benchmarking Best Practices

Based on our experiments:

### 1. Run Multiple Iterations

```bash
bun run perf:builder --fixture xxlarge --iterations 3
```

- **Iteration 1**: Cold start with JIT warmup
- **Iteration 2+**: Warmed state representing typical performance

### 2. Watch for Unstable Results

Experiment J-A showed highly variable results:

| Iteration | Result |
|-----------|--------|
| 1 (cold)  | -52% (better) |
| 2         | +126% (worse) |
| 3         | -9% (better) |

If iteration variance exceeds 20%, results are unreliable. GC timing and JIT compilation can cause significant anomalies.

### 3. Measure Both Memory AND Time

Memory reduction doesn't guarantee performance improvement:

| Metric | Expected | Actual |
|--------|----------|--------|
| Memory | -5% | +6% |
| Time   | -10% | +85% |

Object manipulation overhead can completely negate memory savings.

### 4. Use Extended Memory Profiling

```bash
bun run perf:builder --fixture xxlarge --extended --gc --iterations 3
```

The `--extended` flag provides phase-based memory measurements:
- After discovery
- After intermediate generation
- After evaluation

This helps identify which phase contributes most to memory usage.

## Summary

| Approach | Effective? | Reason |
|----------|------------|--------|
| Release at source | Yes | No object manipulation, V8 can GC immediately |
| Filter/map arrays | No | Creates new objects, adds memory |
| Object spread | No | Creates new objects, adds memory |
| In-place mutation | No | V8 de-optimization penalties |
| Lazy getters | No | Getter overhead exceeds benefit |
| Optimize small data | No | Overhead exceeds potential savings |

**The only reliable pattern**: Release data at the source, before it gets stored in data structures. Once data is stored, V8 cannot efficiently reclaim it through runtime manipulation.

## Related Documentation

- [Performance Profiling Guide](./performance-profiling.md) - How to profile and benchmark
- [Performance Measurement Reference](../reference/perf-measures.md) - Benchmark command reference
- [Builder Flow](./builder-flow.md) - Builder architecture overview

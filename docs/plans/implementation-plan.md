# soda-gql Implementation Plan

**Date**: 2025-10-05
**Based on**: [Improvement Proposals](./improvement-proposals.md)
**Status**: Ready for Implementation

---

## Overview

This document provides a detailed implementation plan for accepted improvement proposals. The plan focuses on incremental delivery while maintaining a working codebase throughout.

**Scope Summary**:
- ✅ 6 Accepted items
- ✏️ 2 Modified items
- ⏸️ 2 Deferred items
- ❌ 1 Rejected item

---

## Implementation Order

Tasks are ordered to minimize dependencies and enable parallel work where possible:

```
Phase 1: Foundation (Portability Layer)
  └─> #5A, #5B

Phase 2: Core Improvements (Can run in parallel after Phase 1)
  ├─> #2A, #2B (Dependency Resolution)
  ├─> #6A, #6B (Chunk Writing)
  └─> #4A, #4B (Cache Invalidation)

Phase 3: High-Level Optimizations
  ├─> #10A (Artifact Memoization)
  ├─> #9A, #9B (neverthrow Migration)
  └─> #8A, #8B (Package Cleanup)

Phase 4: Quality Assurance
  └─> #7A, #7B (Test Strategy)
```

---

## Phase 1: Foundation

### #5 Bun-Only APIs Breaking Portability

**Priority**: P1 | **Complexity**: L (Large)

#### Objective
Introduce runtime-agnostic portability layer to support both Bun and Node.js execution.

#### Tasks

##### #5A: Implement Portability Layer
**Complexity**: L | **Files**: `packages/core/src/portable/*.ts`

**Implementation Steps**:

1. **Create portable filesystem API** (`packages/core/src/portable/fs.ts`):
   ```typescript
   // Abstraction over Bun.write/fs.promises
   export interface PortableFS {
     readFile(path: string): Promise<string>
     writeFile(path: string, content: string): Promise<void>
     exists(path: string): Promise<boolean>
     stat(path: string): Promise<{ mtime: Date; size: number }>
   }

   export function createPortableFS(): PortableFS {
     // Feature detection: Use Bun APIs when available, fallback to Node
   }
   ```

2. **Create portable hashing API** (`packages/core/src/portable/hash.ts`):
   ```typescript
   // Abstraction over Bun.hash
   export interface PortableHasher {
     hash(content: string, algorithm?: 'sha256' | 'xxhash'): string
   }

   export function createPortableHasher(): PortableHasher {
     // Use Bun.hash when available, fallback to crypto/xxhash
   }
   ```

3. **Create portable ID generation** (`packages/core/src/portable/id.ts`):
   ```typescript
   // Abstraction over Bun.randomUUIDv7
   export function generateId(): string {
     // Use Bun.randomUUIDv7 when available, fallback to crypto.randomUUID
   }
   ```

4. **Create portable subprocess API** (`packages/core/src/portable/spawn.ts`):
   ```typescript
   // Abstraction over Bun.spawn
   export interface SpawnOptions {
     cmd: string[]
     cwd?: string
     env?: Record<string, string>
   }

   export async function spawn(options: SpawnOptions): Promise<{
     stdout: string
     stderr: string
     exitCode: number
   }> {
     // Use Bun.spawn when available, fallback to child_process
   }
   ```

5. **Create runtime detection utility** (`packages/core/src/portable/runtime.ts`):
   ```typescript
   export const runtime = {
     isBun: typeof Bun !== 'undefined',
     isNode: typeof process !== 'undefined' && !isBun,
   }
   ```

**Validation**:
- [ ] All APIs work on Bun runtime
- [ ] All APIs work on Node.js runtime
- [ ] Benchmark performance: Bun fast-path within 5% of direct API usage
- [ ] Unit tests: `packages/core/tests/portable/*.test.ts`

---

##### #5B: Migrate Existing Code to Portable APIs
**Complexity**: L | **Depends on**: #5A

**Files to Update**:
- `packages/builder/src/intermediate-module/chunk-writer.ts` (Bun.write → PortableFS)
- `packages/builder/src/cache/json-cache.ts` (Bun.file, Bun.hash → PortableFS, PortableHasher)
- `packages/builder/src/session/builder-session.ts` (Bun.hash → PortableHasher)
- `packages/plugin-babel/src/state.ts` (Bun API usage → Portable APIs)
- `packages/codegen/src/runner.ts` (File operations → PortableFS)
- Test utilities in `tests/utils/` (All Bun references)

**Migration Strategy**:

1. **Add portability layer dependency** to affected packages:
   ```json
   // packages/builder/package.json
   {
     "dependencies": {
       "@soda-gql/core": "workspace:*"
     }
   }
   ```

2. **Replace Bun.write calls**:
   ```typescript
   // Before
   await Bun.write(filePath, content)

   // After
   const fs = createPortableFS()
   await fs.writeFile(filePath, content)
   ```

3. **Replace Bun.hash calls**:
   ```typescript
   // Before
   const hash = Bun.hash(content)

   // After
   const hasher = createPortableHasher()
   const hash = hasher.hash(content, 'xxhash')
   ```

4. **Replace Bun.randomUUIDv7 calls**:
   ```typescript
   // Before
   const id = Bun.randomUUIDv7()

   // After
   import { generateId } from '@soda-gql/core/portable'
   const id = generateId()
   ```

5. **Singleton pattern for expensive instances**:
   ```typescript
   // Avoid recreating instances on every call
   let fsInstance: PortableFS | null = null
   export function getPortableFS(): PortableFS {
     if (!fsInstance) fsInstance = createPortableFS()
     return fsInstance
   }
   ```

**Validation**:
- [ ] All existing tests pass on Bun
- [ ] All existing tests pass on Node.js (`node --test` or equivalent)
- [ ] Smoke test: Run `bun run soda-gql codegen` and `bun run soda-gql builder` on both runtimes
- [ ] No direct `Bun.*` API calls remaining (except in portability layer itself)

**Risk Mitigation**:
- Add feature flag `SODA_GQL_FORCE_NODE_MODE=1` to test Node fallbacks on Bun
- Keep performance benchmarks to catch regressions

---

## Phase 2: Core Improvements

### #2 Runtime Dependency Resolution Bug

**Priority**: P0 | **Complexity**: M (Medium)

#### Objective
Fix `.tsx` and `index.tsx` imports being invisible to dependency diffs.

#### Tasks

##### #2A: Harden Module Resolver Logic
**Complexity**: M | **Files**: `packages/builder/src/session/builder-session.ts`

**Current Issue**:
```typescript
// Current implementation (simplified)
function resolveModuleSpecifier(from: string, specifier: string): string {
  // Only checks first .ts candidate, never validates filesystem
  return path.join(path.dirname(from), specifier + '.ts')
}
```

**Proposed Solution**:

1. **Define extension candidates** (`packages/builder/src/dependency-graph/paths.ts`):
   ```typescript
   export const MODULE_EXTENSION_CANDIDATES = [
     '.ts',
     '.tsx',
     '.js',
     '.jsx',
     '/index.ts',
     '/index.tsx',
     '/index.js',
     '/index.jsx',
   ] as const
   ```

2. **Implement filesystem-aware resolver**:
   ```typescript
   import { getPortableFS } from '@soda-gql/core/portable'

   async function resolveModuleSpecifier(
     from: string,
     specifier: string
   ): Promise<string | null> {
     const fs = getPortableFS()
     const baseDir = path.dirname(from)

     // If specifier already has extension, check it first
     if (path.extname(specifier)) {
       const candidate = path.join(baseDir, specifier)
       if (await fs.exists(candidate)) return candidate
     }

     // Try all extension candidates
     for (const ext of MODULE_EXTENSION_CANDIDATES) {
       const candidate = path.join(baseDir, specifier + ext)
       if (await fs.exists(candidate)) return candidate
     }

     return null // Unresolvable
   }
   ```

3. **Update call sites** in `builder-session.ts`:
   ```typescript
   // Before
   const resolved = resolveModuleSpecifier(filePath, importSpecifier)

   // After
   const resolved = await resolveModuleSpecifier(filePath, importSpecifier)
   if (!resolved) {
     // Handle unresolved import
   }
   ```

**Validation**:
- [ ] Unit test: `.tsx` imports resolve correctly
- [ ] Unit test: `index.tsx` imports resolve correctly
- [ ] Unit test: Already-suffixed imports (`.ts`) still work
- [ ] Integration test: Dependency graph includes `.tsx` files

---

##### #2B: Align Dependency Graph Path Utilities
**Complexity**: S | **Files**: `packages/builder/src/dependency-graph/paths.ts`

**Implementation**:

1. **Ensure consistent path normalization**:
   ```typescript
   export function normalizePath(p: string): string {
     return path.normalize(p).replace(/\\/g, '/')
   }
   ```

2. **Update graph diffing** to use normalized paths consistently

**Validation**:
- [ ] Existing dependency graph tests pass
- [ ] Graph diff correctly identifies added/removed `.tsx` modules

---

### #6 Inefficient Chunk Writing

**Priority**: P1 | **Complexity**: M (Medium)

#### Objective
Skip chunk writes when content hash is unchanged.

#### Tasks

##### #6A: Add Content Hash Short-Circuit
**Complexity**: M | **Files**: `packages/builder/src/intermediate-module/chunk-writer.ts`

**Current Issue**:
```typescript
// Always writes, even if unchanged
export async function writeChunkModules(chunks: Chunk[]): Promise<void> {
  for (const chunk of chunks) {
    await Bun.write(chunk.path, chunk.content)
  }
}
```

**Proposed Solution**:

1. **Implement atomic write with hash check**:
   ```typescript
   import { getPortableFS, getPortableHasher } from '@soda-gql/core/portable'

   export async function writeChunkModules(
     chunks: Chunk[],
     manifest: ChunkManifest
   ): Promise<WriteResult> {
     const fs = getPortableFS()
     const hasher = getPortableHasher()

     const results = {
       written: [] as string[],
       skipped: [] as string[],
     }

     for (const chunk of chunks) {
       const contentHash = hasher.hash(chunk.content)
       const existingHash = manifest.get(chunk.path)?.contentHash

       if (existingHash === contentHash) {
         // Verify file still exists and matches
         if (await fs.exists(chunk.path)) {
           const existing = await fs.readFile(chunk.path)
           if (hasher.hash(existing) === contentHash) {
             results.skipped.push(chunk.path)
             continue
           }
         }
       }

       // Write atomically: temp file + rename
       const tempPath = `${chunk.path}.tmp`
       await fs.writeFile(tempPath, chunk.content)
       await fs.rename(tempPath, chunk.path)

       results.written.push(chunk.path)
     }

     return results
   }
   ```

2. **Add atomic rename to PortableFS** (if not already present):
   ```typescript
   // In packages/core/src/portable/fs.ts
   async rename(oldPath: string, newPath: string): Promise<void>
   ```

**Validation**:
- [ ] Integration test: Repeated builds skip unchanged chunks
- [ ] Unit test: Hash collision detection works
- [ ] Unit test: Missing files trigger write
- [ ] Performance: Measure write reduction (expect 80%+ skipped on no-op rebuild)

---

##### #6B: Update Chunk Manifest Diffing
**Complexity**: S | **Files**: `packages/builder/src/intermediate-module/chunks.ts`

**Implementation**:

1. **Persist chunk manifest** with content hashes:
   ```typescript
   export interface ChunkManifest {
     chunks: Map<string, {
       contentHash: string
       mtime: number
     }>
   }

   export async function loadChunkManifest(
     cacheDir: string
   ): Promise<ChunkManifest> {
     // Load from .soda-gql/chunk-manifest.json
   }

   export async function saveChunkManifest(
     cacheDir: string,
     manifest: ChunkManifest
   ): Promise<void> {
     // Save to .soda-gql/chunk-manifest.json
   }
   ```

2. **Integrate with builder session**:
   ```typescript
   // In builder-session.ts
   const manifest = await loadChunkManifest(this.cacheDir)
   const results = await writeChunkModules(chunks, manifest)
   await saveChunkManifest(this.cacheDir, updatedManifest)
   ```

**Validation**:
- [ ] Manifest persists between builds
- [ ] Diff snapshots show skipped files

---

### #4 Cache Invalidation Defect

**Priority**: P1 | **Complexity**: M (Medium)

#### Objective
Invalidate cache when GraphQL schema or config changes.

#### Tasks

##### #4A: Add Schema Versioning to Cache Envelopes
**Complexity**: M | **Files**: `packages/builder/src/cache/*.ts`

**Current Issue**:
```typescript
// Cache metadata only tracks analyzer version
const metadata = {
  version: ANALYZER_VERSION,
  // Missing: schema hash, config hash
}
```

**Proposed Solution**:

1. **Extend cache metadata**:
   ```typescript
   export interface CacheMetadata {
     analyzerVersion: string
     schemaHash: string  // NEW
     configHash: string  // NEW
     timestamp: number
   }
   ```

2. **Compute schema hash** (`packages/codegen/src/schema.ts`):
   ```typescript
   import { getPortableHasher } from '@soda-gql/core/portable'

   export function computeSchemaHash(schemaDoc: string): string {
     const hasher = getPortableHasher()
     return hasher.hash(schemaDoc, 'sha256')
   }
   ```

3. **Update cache creation** (`packages/builder/src/cache/json-cache.ts`):
   ```typescript
   export function createJsonCache<T>(options: {
     cacheDir: string
     namespace: string
     metadata: CacheMetadata
   }): Cache<T> {
     // Compare all metadata fields
     const existing = loadMetadata(options.cacheDir, options.namespace)

     if (
       existing.analyzerVersion !== options.metadata.analyzerVersion ||
       existing.schemaHash !== options.metadata.schemaHash ||
       existing.configHash !== options.metadata.configHash
     ) {
       // Clear stale cache
       clearNamespace(options.cacheDir, options.namespace)
     }

     // ...
   }
   ```

**Validation**:
- [ ] Contract test: Schema change clears cache
- [ ] Contract test: Config change clears cache
- [ ] Unit test: Unchanged schema/config reuses cache

---

##### #4B: Propagate Schema Hash Through Builder
**Complexity**: M | **Files**: `packages/builder/src/session/builder-session.ts`, `packages/codegen/src/cli.ts`

**Implementation**:

1. **Pass schema hash to builder** (`packages/codegen/src/cli.ts`):
   ```typescript
   const schemaHash = computeSchemaHash(schemaDocument)

   const builderOptions = {
     // ...existing options
     schemaHash,
   }
   ```

2. **Store in session metadata** (`packages/builder/src/session/builder-session.ts`):
   ```typescript
   export class BuilderSession {
     private metadata: {
       analyzerVersion: string
       schemaHash: string
       configHash: string
     }

     constructor(options: BuilderOptions) {
       this.metadata = {
         analyzerVersion: ANALYZER_VERSION,
         schemaHash: options.schemaHash,
         configHash: computeConfigHash(options.config),
       }
     }
   }
   ```

3. **Use in cache creation**:
   ```typescript
   const cache = createJsonCache({
     cacheDir: this.cacheDir,
     namespace: 'builder',
     metadata: this.metadata,
   })
   ```

**Validation**:
- [ ] Integration test: Build after schema tweak regenerates cache
- [ ] Integration test: Build with same schema reuses cache

---

## Phase 3: High-Level Optimizations

### #10 Plugin Artifact Memoization

**Priority**: P2 | **Complexity**: M (Medium)

#### Objective
Avoid rebuilding plugin artifacts on every file change during watch mode.

#### Tasks

##### #10A: Introduce Artifact Memoization Cache
**Complexity**: M | **Files**: `packages/plugin-babel/src/artifact.ts`

**Current Issue**:
```typescript
// Babel plugin re-runs builder on every invocation
function preparePluginState() {
  const artifact = await runBuilder() // Always rebuilds
  return createState(artifact)
}
```

**Proposed Solution**:

1. **Create artifact cache** (`packages/plugin-babel/src/artifact.ts`):
   ```typescript
   import { getPortableHasher, getPortableFS } from '@soda-gql/core/portable'

   interface ArtifactCacheEntry {
     artifact: BuilderArtifact
     configHash: string
     mtime: number
   }

   const artifactCache = new Map<string, ArtifactCacheEntry>()

   export async function loadArtifact(
     configPath: string,
     options: { force?: boolean } = {}
   ): Promise<BuilderArtifact> {
     const fs = getPortableFS()
     const hasher = getPortableHasher()

     // Compute cache key
     const configContent = await fs.readFile(configPath)
     const configHash = hasher.hash(configContent)

     // Check cache
     const cached = artifactCache.get(configPath)
     if (!options.force && cached && cached.configHash === configHash) {
       const stat = await fs.stat(configPath)
       if (stat.mtime.getTime() <= cached.mtime) {
         return cached.artifact
       }
     }

     // Rebuild
     const artifact = await runBuilder(configPath)

     // Update cache
     artifactCache.set(configPath, {
       artifact,
       configHash,
       mtime: Date.now(),
     })

     return artifact
   }

   export function invalidateArtifactCache(configPath?: string): void {
     if (configPath) {
       artifactCache.delete(configPath)
     } else {
       artifactCache.clear()
     }
   }
   ```

2. **Integrate with Babel plugin** (`packages/plugin-babel/src/state.ts`):
   ```typescript
   export function preparePluginState(configPath: string) {
     const artifact = await loadArtifact(configPath)
     return createState(artifact)
   }
   ```

3. **Add CLI invalidation command** (`packages/cli/src/commands/clean.ts`):
   ```typescript
   export async function cleanCommand() {
     invalidateArtifactCache()
     // Also clear builder cache
   }
   ```

**Validation**:
- [ ] Unit test: Repeated calls with same config reuse artifact
- [ ] Unit test: Config change triggers rebuild
- [ ] Integration test: Watch mode reuses artifact
- [ ] Performance: Measure artifact load time reduction (expect 90%+ on cache hit)

---

### #9 Incomplete neverthrow Adoption

**Priority**: P2 | **Complexity**: M (Medium)

**Scope**: Builder and plugin packages ONLY (not core)

#### Objective
Replace `throw` statements with `Result` types in builder and plugin code.

#### Tasks

##### #9A: Refactor Builder Error Handling
**Complexity**: M | **Files**: `packages/builder/src/**/*.ts`

**Implementation Strategy**:

1. **Define standardized error types** (`packages/builder/src/types.ts`):
   ```typescript
   import { Result, ok, err } from 'neverthrow'

   export type BuilderErrorCode =
     | 'SCHEMA_PARSE_ERROR'
     | 'MODULE_NOT_FOUND'
     | 'CACHE_READ_ERROR'
     | 'INVALID_CONFIG'

   export interface BuilderError {
     code: BuilderErrorCode
     message: string
     cause?: unknown
     filePath?: string
   }

   export type BuilderResult<T> = Result<T, BuilderError>
   ```

2. **Audit and replace throw statements**:
   ```bash
   # Find all throw statements in builder
   rg "throw new" packages/builder/src
   ```

3. **Example refactor**:
   ```typescript
   // Before
   function parseConfig(path: string): Config {
     if (!existsSync(path)) {
       throw new Error(`Config not found: ${path}`)
     }
     return JSON.parse(readFileSync(path, 'utf-8'))
   }

   // After
   async function parseConfig(path: string): BuilderResult<Config> {
     const fs = getPortableFS()

     if (!(await fs.exists(path))) {
       return err({
         code: 'INVALID_CONFIG',
         message: `Config not found: ${path}`,
         filePath: path,
       })
     }

     try {
       const content = await fs.readFile(path)
       const config = JSON.parse(content)
       return ok(config)
     } catch (e) {
       return err({
         code: 'INVALID_CONFIG',
         message: `Failed to parse config: ${e.message}`,
         cause: e,
         filePath: path,
       })
     }
   }
   ```

4. **Update call sites to handle Results**:
   ```typescript
   // Before
   const config = parseConfig(configPath)

   // After
   const result = await parseConfig(configPath)
   if (result.isErr()) {
     // Handle error
     console.error(result.error.message)
     return err(result.error)
   }
   const config = result.value
   ```

**Files to Refactor** (priority order):
1. `packages/builder/src/discovery/discoverer.ts` (has `throw` statements)
2. `packages/builder/src/session/builder-session.ts`
3. `packages/builder/src/cache/*.ts`
4. `packages/builder/src/runner.ts`

**Validation**:
- [ ] All builder tests pass
- [ ] No `throw` statements in builder (except unexpected bugs)
- [ ] Error messages remain informative

---

##### #9B: Refactor Plugin Error Handling
**Complexity**: M | **Files**: `packages/plugin-babel/src/**/*.ts`

**Implementation**:

1. **Define plugin error types** (`packages/plugin-babel/src/types.ts`):
   ```typescript
   export type PluginErrorCode =
     | 'ARTIFACT_LOAD_ERROR'
     | 'TRANSFORM_ERROR'
     | 'INVALID_OPTIONS'

   export interface PluginError {
     code: PluginErrorCode
     message: string
     cause?: unknown
   }

   export type PluginResult<T> = Result<T, PluginError>
   ```

2. **Refactor plugin state preparation**:
   ```typescript
   // packages/plugin-babel/src/state.ts
   export async function preparePluginState(
     configPath: string
   ): PluginResult<PluginState> {
     const artifactResult = await loadArtifact(configPath)
     if (artifactResult.isErr()) {
       return err({
         code: 'ARTIFACT_LOAD_ERROR',
         message: 'Failed to load artifact',
         cause: artifactResult.error,
       })
     }

     return ok(createState(artifactResult.value))
   }
   ```

**Validation**:
- [ ] All plugin tests pass
- [ ] Babel plugin errors are properly surfaced to users

---

### #8 Package Design Cleanup

**Priority**: P2 | **Complexity**: M (Medium)

**Scope**: Exclude `@soda-gql/runtime` (handle in next iteration)

#### Objective
Tighten package boundaries and clarify public APIs.

#### Tasks

##### #8A: Create Internal Modules
**Complexity**: M | **Files**: Multiple packages

**Implementation**:

1. **Identify internal utilities** in each package:
   ```bash
   # Builder internals
   packages/builder/src/utils/
   packages/builder/src/session/internal/

   # Plugin internals
   packages/plugin-babel/src/internal/
   ```

2. **Move to `internal/` directories**:
   ```typescript
   // packages/builder/src/internal/path-utils.ts
   // Internal utilities not for public consumption
   ```

3. **Update package exports** (`packages/builder/package.json`):
   ```json
   {
     "exports": {
       ".": "./src/index.ts",
       "./session": "./src/session/index.ts",
       "./cache": "./src/cache/index.ts",
       "./internal/*": null  // Prevent imports
     }
   }
   ```

4. **Create clear public API surfaces**:
   ```typescript
   // packages/builder/src/index.ts
   export { createBuilderService } from './runner'
   export { BuilderOptions, BuilderArtifact } from './types'
   export type { BuilderError, BuilderResult } from './types'

   // Do NOT export:
   // - BuilderSession (internal)
   // - Chunk internals
   // - Cache implementation details
   ```

**Packages to Update**:
- `packages/builder`
- `packages/plugin-babel`
- `packages/codegen`
- `packages/config`

**Validation**:
- [ ] Run `bun typecheck` across workspace
- [ ] No broken imports from public API consumers
- [ ] Internal imports blocked by TypeScript/package.json

---

##### #8B: Unify Config Loading
**Complexity**: M | **Files**: `packages/cli/src/config/`, `packages/config/src/`

**Current Issue**:
- CLI has its own JSON loader: `packages/cli/src/config/loader.ts`
- Config package has TypeScript loader: `packages/config/src/loader.ts`

**Proposed Solution**:

1. **Consolidate in config package** (`packages/config/src/loader.ts`):
   ```typescript
   export interface LoadConfigOptions {
     format?: 'json' | 'typescript' | 'auto'
   }

   export async function loadConfig(
     path: string,
     options: LoadConfigOptions = {}
   ): Promise<Result<Config, ConfigError>> {
     const format = options.format ?? detectFormat(path)

     if (format === 'json') {
       return loadJsonConfig(path)
     } else {
       return loadTsConfig(path)
     }
   }
   ```

2. **Remove CLI loader** and use config package

3. **Update CLI** (`packages/cli/src/commands/*.ts`):
   ```typescript
   import { loadConfig } from '@soda-gql/config'

   const configResult = await loadConfig(configPath, { format: 'json' })
   ```

**Validation**:
- [ ] CLI tests pass
- [ ] Both JSON and TS configs work

---

## Phase 4: Quality Assurance

### #7 Test Strategy Improvements

**Priority**: P2 | **Complexity**: L (Large)

#### Objective
Improve test coverage, reliability, and documentation.

#### Tasks

##### #7A: Add Coverage Targets + Documentation
**Complexity**: S | **Files**: `docs/testing.md`, `package.json`

**Implementation**:

1. **Create testing guide** (`docs/testing.md`):
   ```markdown
   # Testing Guide

   ## Coverage Targets
   - Unit tests: 80% line coverage minimum
   - Integration tests: Critical paths only
   - Contract tests: Public APIs

   ## Test Organization
   - `tests/unit/`: Fast, isolated tests
   - `tests/integration/`: Full workflow tests
   - `tests/contract/`: CLI and public API tests
   - `tests/fixtures/`: Reusable test code

   ## Running Tests
   - All tests: `bun test`
   - With coverage: `bun test --coverage`
   - Specific suite: `bun test tests/unit/builder`
   ```

2. **Add coverage scripts** (`package.json`):
   ```json
   {
     "scripts": {
       "test": "bun test",
       "test:coverage": "bun test --coverage",
       "test:unit": "bun test tests/unit",
       "test:integration": "bun test tests/integration",
       "test:contract": "bun test tests/contract"
     }
   }
   ```

3. **Configure coverage thresholds** (if supported by Bun):
   ```typescript
   // bunfig.toml or test config
   [test.coverage]
   threshold = {
     lines = 80,
     functions = 75,
     branches = 70
   }
   ```

**Validation**:
- [ ] Documentation is clear and actionable
- [ ] Coverage scripts work

---

##### #7B: Expand Test Suites
**Complexity**: L | **Files**: Multiple test files

**New Test Files Needed**:

1. **Portability layer tests** (`packages/core/tests/portable/*.test.ts`):
   ```typescript
   // packages/core/tests/portable/fs.test.ts
   import { describe, test, expect } from 'bun:test'
   import { createPortableFS } from '@soda-gql/core/portable'

   describe('PortableFS', () => {
     test('writes and reads files', async () => {
       const fs = createPortableFS()
       await fs.writeFile('/tmp/test.txt', 'hello')
       const content = await fs.readFile('/tmp/test.txt')
       expect(content).toBe('hello')
     })

     test('checks file existence', async () => {
       const fs = createPortableFS()
       expect(await fs.exists('/nonexistent')).toBe(false)
     })
   })
   ```

2. **Resolver tests** (`packages/builder/tests/resolver.test.ts`):
   ```typescript
   describe('Module resolver', () => {
     test('resolves .tsx files', async () => {
       // Setup fixture with .tsx file
       const resolved = await resolveModuleSpecifier(
         '/src/index.ts',
         './component'
       )
       expect(resolved).toBe('/src/component.tsx')
     })

     test('resolves index.tsx', async () => {
       const resolved = await resolveModuleSpecifier(
         '/src/index.ts',
         './components'
       )
       expect(resolved).toBe('/src/components/index.tsx')
     })
   })
   ```

3. **Chunk writing tests** (`tests/integration/chunks_content_hash.test.ts`):
   ```typescript
   describe('Chunk content hash optimization', () => {
     test('skips unchanged chunks', async () => {
       // Build once
       const result1 = await runBuilder(config)

       // Build again without changes
       const result2 = await runBuilder(config)

       expect(result2.skippedChunks.length).toBeGreaterThan(0)
     })
   })
   ```

4. **Schema invalidation tests** (`tests/contract/builder/schema_invalidation.test.ts`):
   ```typescript
   describe('Schema change invalidation', () => {
     test('rebuilds when schema changes', async () => {
       const workspace = createTestWorkspace()

       // Initial build
       await runBuilder({ schema: 'schema-v1.graphql' })
       const cache1 = readCacheMetadata()

       // Change schema
       await runBuilder({ schema: 'schema-v2.graphql' })
       const cache2 = readCacheMetadata()

       expect(cache2.schemaHash).not.toBe(cache1.schemaHash)
     })
   })
   ```

5. **Artifact memoization tests** (`packages/plugin-babel/src/__tests__/artifact-cache.test.ts`):
   ```typescript
   describe('Artifact cache', () => {
     test('reuses artifact on repeated calls', async () => {
       const artifact1 = await loadArtifact(configPath)
       const artifact2 = await loadArtifact(configPath)

       expect(artifact2).toBe(artifact1) // Same instance
     })

     test('invalidates on config change', async () => {
       const artifact1 = await loadArtifact(configPath)

       // Modify config
       await modifyConfig(configPath)

       const artifact2 = await loadArtifact(configPath)
       expect(artifact2).not.toBe(artifact1)
     })
   })
   ```

**Unit Test Coverage Priorities**:
- [ ] Path normalization edge cases
- [ ] Chunk diffing logic
- [ ] Cache metadata comparison
- [ ] Error type construction

**Integration Test Scenarios**:
- [ ] Full build with Node.js runtime
- [ ] Schema change triggers cache invalidation
- [ ] Incremental build skips unchanged chunks
- [ ] Plugin memoization in watch mode

**Validation**:
- [ ] Coverage meets 80% threshold
- [ ] All new features have corresponding tests
- [ ] Tests are reliable (no flakiness)

---

## Cross-Cutting Concerns

### Shared Infrastructure

**Portability Layer** (from #5):
- Used by: #2 (resolver), #4 (hash), #6 (chunk writing), #10 (artifact cache)
- Must be implemented first
- Requires comprehensive testing on both Bun and Node.js

**Error Types** (from #9):
- Builder errors: Used across all builder tasks
- Plugin errors: Isolated to plugin package
- Should be defined early for consistency

### API Changes

**Breaking Changes**:
- Package exports restructure (#8) may break consumer imports
- Error handling migration (#9) changes function signatures

**Migration Strategy**:
1. Deprecation period: Keep old exports as deprecated
2. Provide migration guide in docs
3. Run typecheck across all packages before merging

### Testing Infrastructure

**Test Utilities** (`tests/utils/`):
- Workspace creation helpers (for integration tests)
- Fixture loading utilities
- Assertion helpers for Result types

---

## Risk Assessment

### Breaking Changes

**Impact**: Package export changes (#8), neverthrow migration (#9)

**Mitigation**:
- Run full typecheck before each merge: `bun run typecheck`
- Test against real-world usage patterns
- Provide clear migration notes

### Performance Implications

**Potential Regressions**:
- Portability layer overhead (#5)
- Filesystem checks in resolver (#2)
- Hash comparisons in chunk writing (#6)

**Mitigation**:
- Benchmark before/after for critical paths
- Maintain Bun fast-paths where possible
- Use caching aggressively (memoize stat calls, etc.)

**Target Benchmarks**:
- Portability layer: <5% overhead vs native Bun APIs
- Resolver: <10ms added latency per module resolution
- Chunk writing: 80%+ skip rate on no-op builds

### Rollback Strategies

**Feature Flags**:
```typescript
// Environment variables for quick rollback
const USE_NEW_RESOLVER = process.env.SODA_GQL_NEW_RESOLVER !== 'false'
const USE_CHUNK_HASHING = process.env.SODA_GQL_CHUNK_HASHING !== 'false'
```

**Git Tags**:
- Tag before each major change: `pre-portability-layer`, `pre-neverthrow-migration`
- Enables quick rollback: `git revert --merge <tag>..HEAD`

**Gradual Rollout**:
- Deploy portability layer first (backward compatible)
- Test in isolation before enabling dependent features
- Allow disabling new features via config flags

---

## Validation Checklist

### Per-Task Validation

Each task must meet these criteria before being marked complete:

- [ ] Implementation matches specification
- [ ] All new code has corresponding tests
- [ ] Existing tests still pass
- [ ] TypeScript compilation succeeds (`bun typecheck`)
- [ ] Linting passes (`bun quality`)
- [ ] Documentation updated (if public API changed)

### Phase Validation

Before moving to next phase:

- [ ] All phase tasks completed
- [ ] Integration tests pass for all phase features
- [ ] Performance benchmarks within acceptable range
- [ ] Code reviewed and approved

### Final Validation (Before Merge to Main)

- [ ] Full test suite passes on both Bun and Node.js
- [ ] Coverage meets 80% threshold
- [ ] No direct Bun API usage outside portability layer
- [ ] All TODOs resolved or tracked as future work
- [ ] Migration guide written (if breaking changes)
- [ ] CHANGELOG.md updated

---

## Timeline Estimates

**Phase 1** (Foundation): 1-2 weeks
- #5A: 3-4 days
- #5B: 4-5 days

**Phase 2** (Core Improvements): 2-3 weeks
- #2A, #2B: 3-4 days
- #6A, #6B: 4-5 days
- #4A, #4B: 4-5 days

**Phase 3** (Optimizations): 2-3 weeks
- #10A: 3-4 days
- #9A: 4-5 days
- #9B: 2-3 days
- #8A, #8B: 4-5 days

**Phase 4** (QA): 1-2 weeks
- #7A: 1-2 days
- #7B: 5-7 days

**Total**: 6-10 weeks

*Note: Estimates assume single developer. Parallel work can reduce timeline.*

---

## Next Steps

1. **Immediate**:
   - [ ] Review and approve this plan
   - [ ] Set up project board with tasks
   - [ ] Assign owners to each phase

2. **Phase 1 Start**:
   - [ ] Create feature branch: `feat/portability-layer`
   - [ ] Begin #5A implementation
   - [ ] Set up benchmarking infrastructure

3. **Ongoing**:
   - [ ] Weekly progress reviews
   - [ ] Update this document as needed
   - [ ] Track deferred items for future iterations

---

**Approved By**: _________________
**Start Date**: _________________

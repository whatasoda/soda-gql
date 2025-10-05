# Phase 2: Core Improvements

**Status**: Ready for Implementation
**Priority**: P1 - Critical Fixes
**Estimated Duration**: 2-3 weeks
**Dependencies**: Phase 1 (Portability Layer)

---

## Overview

Fix critical bugs and performance issues in builder core functionality. Tasks can run in parallel after Phase 1 completes.

**What this fixes**:
- `.tsx` and `index.tsx` imports missing from dependency graphs
- Unnecessary chunk rewrites defeating cache benefits
- Schema/config changes not invalidating cache

---

## Tasks Overview

- **#2**: Runtime Dependency Resolution Bug (3-4 days)
- **#6**: Inefficient Chunk Writing (4-5 days)
- **#4**: Cache Invalidation Defect (4-5 days)

---

## #2: Runtime Dependency Resolution Bug

**Priority**: P0 | **Complexity**: M (Medium) | **Duration**: 3-4 days

### Problem

`.tsx` and `index.tsx` imports are invisible to dependency diffs because resolver only checks first `.ts` candidate without filesystem validation.

**Impact**: Missing dependencies cause incorrect incremental builds.

### Tasks

#### #2A: Harden Module Resolver Logic

**File**: `packages/builder/src/session/builder-session.ts`

##### Current Issue

```typescript
// Current implementation (simplified)
function resolveModuleSpecifier(from: string, specifier: string): string {
  // Only checks first .ts candidate, never validates filesystem
  return path.join(path.dirname(from), specifier + '.ts')
}
```

##### Implementation Steps

1. **Define extension candidates**

**File**: `packages/builder/src/dependency-graph/paths.ts`

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

export type ModuleExtension = typeof MODULE_EXTENSION_CANDIDATES[number]
```

2. **Implement filesystem-aware resolver**

**File**: `packages/builder/src/dependency-graph/resolver.ts` (new file)

```typescript
import { getPortableFS } from '@soda-gql/core/portable'
import { MODULE_EXTENSION_CANDIDATES } from './paths'
import * as path from 'node:path'

export async function resolveModuleSpecifier(
  from: string,
  specifier: string
): Promise<string | null> {
  const fs = getPortableFS()
  const baseDir = path.dirname(from)

  // If specifier already has extension, check it first
  if (path.extname(specifier)) {
    const candidate = path.join(baseDir, specifier)
    if (await fs.exists(candidate)) {
      return candidate
    }
    // If explicit extension doesn't exist, return null (hard error)
    return null
  }

  // Try all extension candidates in order
  for (const ext of MODULE_EXTENSION_CANDIDATES) {
    const candidate = path.join(baseDir, specifier + ext)
    if (await fs.exists(candidate)) {
      return candidate
    }
  }

  // Could not resolve
  return null
}

/**
 * Batch resolver for better performance
 * Resolves multiple specifiers in parallel
 */
export async function resolveModuleSpecifiers(
  from: string,
  specifiers: string[]
): Promise<Map<string, string | null>> {
  const results = await Promise.all(
    specifiers.map(async (spec) => ({
      specifier: spec,
      resolved: await resolveModuleSpecifier(from, spec),
    }))
  )

  return new Map(results.map(r => [r.specifier, r.resolved]))
}
```

3. **Update call sites in builder session**

**File**: `packages/builder/src/session/builder-session.ts`

```typescript
import { resolveModuleSpecifier } from '../dependency-graph/resolver'

// BEFORE
private analyzeImports(filePath: string, source: string): string[] {
  const imports = extractImports(source)
  return imports.map(imp => resolveModuleSpecifier(filePath, imp))
}

// AFTER
private async analyzeImports(filePath: string, source: string): Promise<string[]> {
  const imports = extractImports(source)
  const resolved = await Promise.all(
    imports.map(imp => resolveModuleSpecifier(filePath, imp))
  )

  // Filter out unresolved imports (external packages, etc.)
  return resolved.filter((r): r is string => r !== null)
}
```

4. **Handle async resolution in dependency graph**

**File**: `packages/builder/src/dependency-graph/builder.ts`

```typescript
// Update graph building to be async
export async function buildDependencyGraph(
  entryPoints: string[]
): Promise<DependencyGraph> {
  const graph = new Map<string, string[]>()
  const queue = [...entryPoints]
  const visited = new Set<string>()

  while (queue.length > 0) {
    const current = queue.shift()!
    if (visited.has(current)) continue
    visited.add(current)

    const fs = getPortableFS()
    const source = await fs.readFile(current)
    const deps = await analyzeImports(current, source)

    graph.set(current, deps)
    queue.push(...deps.filter(d => !visited.has(d)))
  }

  return graph
}
```

##### Validation

- [ ] Unit test: `.tsx` imports resolve correctly
- [ ] Unit test: `index.tsx` imports resolve correctly
- [ ] Unit test: Already-suffixed imports still work
- [ ] Unit test: Unresolved imports return `null`
- [ ] Integration test: Dependency graph includes `.tsx` files
- [ ] Performance: Batch resolution doesn't add > 10ms per module

---

#### #2B: Align Dependency Graph Path Utilities

**File**: `packages/builder/src/dependency-graph/paths.ts`

##### Implementation

1. **Ensure consistent path normalization**

```typescript
import * as path from 'node:path'

/**
 * Normalize path to use forward slashes (cross-platform)
 */
export function normalizePath(p: string): string {
  return path.normalize(p).replace(/\\/g, '/')
}

/**
 * Resolve and normalize path
 */
export function resolveAndNormalize(...segments: string[]): string {
  return normalizePath(path.resolve(...segments))
}

/**
 * Check if path is absolute
 */
export function isAbsolutePath(p: string): boolean {
  return path.isAbsolute(p)
}
```

2. **Update graph diffing to use normalized paths**

**File**: `packages/builder/src/dependency-graph/diff.ts`

```typescript
import { normalizePath } from './paths'

export function diffGraphs(
  previous: DependencyGraph,
  current: DependencyGraph
): {
  added: string[]
  removed: string[]
  modified: string[]
} {
  // Normalize all paths before comparison
  const prevPaths = new Set(
    Array.from(previous.keys()).map(normalizePath)
  )
  const currPaths = new Set(
    Array.from(current.keys()).map(normalizePath)
  )

  const added = [...currPaths].filter(p => !prevPaths.has(p))
  const removed = [...prevPaths].filter(p => !currPaths.has(p))

  const modified = [...currPaths].filter(p => {
    if (!prevPaths.has(p)) return false
    // Compare dependencies
    const prevDeps = previous.get(p)?.map(normalizePath).sort()
    const currDeps = current.get(p)?.map(normalizePath).sort()
    return JSON.stringify(prevDeps) !== JSON.stringify(currDeps)
  })

  return { added, removed, modified }
}
```

##### Validation

- [ ] Existing dependency graph tests pass
- [ ] Graph diff correctly identifies added/removed `.tsx` modules
- [ ] Path normalization works on Windows
- [ ] No duplicate entries due to path separator differences

---

### Testing

#### Unit Tests

**File**: `packages/builder/tests/resolver.test.ts`

```typescript
import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { resolveModuleSpecifier } from '../src/dependency-graph/resolver'
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

describe('Module resolver', () => {
  let testDir: string

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'resolver-test-'))
  })

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true })
  })

  test('resolves .tsx files', async () => {
    const sourceFile = join(testDir, 'index.ts')
    const targetFile = join(testDir, 'component.tsx')

    await writeFile(sourceFile, '')
    await writeFile(targetFile, '')

    const resolved = await resolveModuleSpecifier(sourceFile, './component')
    expect(resolved).toBe(targetFile)
  })

  test('resolves index.tsx', async () => {
    const sourceFile = join(testDir, 'index.ts')
    const targetDir = join(testDir, 'components')
    const targetFile = join(targetDir, 'index.tsx')

    await writeFile(sourceFile, '')
    await mkdir(targetDir)
    await writeFile(targetFile, '')

    const resolved = await resolveModuleSpecifier(sourceFile, './components')
    expect(resolved).toBe(targetFile)
  })

  test('prefers exact extension match', async () => {
    const sourceFile = join(testDir, 'index.ts')
    await writeFile(sourceFile, '')
    await writeFile(join(testDir, 'module.ts'), '')
    await writeFile(join(testDir, 'module.tsx'), '')

    // Should prefer .ts when explicitly requested
    const resolved = await resolveModuleSpecifier(sourceFile, './module.ts')
    expect(resolved).toBe(join(testDir, 'module.ts'))
  })

  test('returns null for unresolvable imports', async () => {
    const sourceFile = join(testDir, 'index.ts')
    await writeFile(sourceFile, '')

    const resolved = await resolveModuleSpecifier(sourceFile, './nonexistent')
    expect(resolved).toBeNull()
  })

  test('handles already suffixed imports', async () => {
    const sourceFile = join(testDir, 'index.ts')
    const targetFile = join(testDir, 'module.tsx')

    await writeFile(sourceFile, '')
    await writeFile(targetFile, '')

    const resolved = await resolveModuleSpecifier(sourceFile, './module.tsx')
    expect(resolved).toBe(targetFile)
  })
})
```

#### Integration Tests

**File**: `tests/integration/dependency_graph_tsx.test.ts`

```typescript
import { describe, test, expect } from 'bun:test'
import { buildDependencyGraph } from '@soda-gql/builder/dependency-graph'
import { setupFixture } from '../utils/fixtures'

describe('Dependency graph with .tsx files', () => {
  test('includes .tsx imports in graph', async () => {
    const workspace = await setupFixture('tsx-imports')

    const graph = await buildDependencyGraph([
      workspace.path('src/index.ts')
    ])

    const deps = graph.get(workspace.path('src/index.ts'))
    expect(deps).toContain(workspace.path('src/Component.tsx'))
  })

  test('handles index.tsx imports', async () => {
    const workspace = await setupFixture('index-tsx')

    const graph = await buildDependencyGraph([
      workspace.path('src/main.ts')
    ])

    const deps = graph.get(workspace.path('src/main.ts'))
    expect(deps).toContain(workspace.path('src/components/index.tsx'))
  })
})
```

---

## #6: Inefficient Chunk Writing

**Priority**: P1 | **Complexity**: M (Medium) | **Duration**: 4-5 days

### Problem

Chunk writer rewrites all chunks even when content hash is unchanged, defeating cache benefits.

**Impact**: Unnecessary I/O slows down incremental builds.

### Tasks

#### #6A: Add Content Hash Short-Circuit

**File**: `packages/builder/src/intermediate-module/chunk-writer.ts`

##### Current Issue

```typescript
// Always writes, even if unchanged
export async function writeChunkModules(chunks: Chunk[]): Promise<void> {
  for (const chunk of chunks) {
    await Bun.write(chunk.path, chunk.content)
  }
}
```

##### Implementation

```typescript
import { getPortableFS, getPortableHasher } from '@soda-gql/core/portable'

export interface WriteResult {
  written: string[]
  skipped: string[]
  errors: Array<{ path: string; error: Error }>
}

export interface ChunkManifest {
  chunks: Map<string, {
    contentHash: string
    mtime: number
  }>
}

export async function writeChunkModules(
  chunks: Chunk[],
  manifest: ChunkManifest
): Promise<WriteResult> {
  const fs = getPortableFS()
  const hasher = getPortableHasher()

  const results: WriteResult = {
    written: [],
    skipped: [],
    errors: [],
  }

  for (const chunk of chunks) {
    try {
      const contentHash = hasher.hash(chunk.content, 'sha256')
      const existingEntry = manifest.chunks.get(chunk.path)

      // Check if we can skip this write
      if (existingEntry?.contentHash === contentHash) {
        // Verify file still exists and matches
        if (await fs.exists(chunk.path)) {
          const existing = await fs.readFile(chunk.path)
          const existingHash = hasher.hash(existing, 'sha256')

          if (existingHash === contentHash) {
            results.skipped.push(chunk.path)
            continue
          }
        }
      }

      // Write atomically: temp file + rename
      const tempPath = `${chunk.path}.tmp`
      await fs.writeFile(tempPath, chunk.content)
      await fs.rename(tempPath, chunk.path)

      // Update manifest
      manifest.chunks.set(chunk.path, {
        contentHash,
        mtime: Date.now(),
      })

      results.written.push(chunk.path)
    } catch (error) {
      results.errors.push({
        path: chunk.path,
        error: error as Error,
      })
    }
  }

  return results
}
```

##### Validation

- [ ] Integration test: Repeated builds skip unchanged chunks
- [ ] Unit test: Hash collision detection works
- [ ] Unit test: Missing files trigger write
- [ ] Unit test: Corrupted files are rewritten
- [ ] Performance: 80%+ skipped on no-op rebuild

---

#### #6B: Update Chunk Manifest Management

**File**: `packages/builder/src/intermediate-module/manifest.ts` (new file)

##### Implementation

```typescript
import { getPortableFS } from '@soda-gql/core/portable'
import * as path from 'node:path'

export interface ChunkManifest {
  version: string
  chunks: Map<string, {
    contentHash: string
    mtime: number
  }>
}

const MANIFEST_VERSION = '1'
const MANIFEST_FILENAME = 'chunk-manifest.json'

export async function loadChunkManifest(
  cacheDir: string
): Promise<ChunkManifest> {
  const fs = getPortableFS()
  const manifestPath = path.join(cacheDir, MANIFEST_FILENAME)

  if (!(await fs.exists(manifestPath))) {
    return {
      version: MANIFEST_VERSION,
      chunks: new Map(),
    }
  }

  try {
    const content = await fs.readFile(manifestPath)
    const data = JSON.parse(content)

    // Version mismatch: return empty manifest
    if (data.version !== MANIFEST_VERSION) {
      return {
        version: MANIFEST_VERSION,
        chunks: new Map(),
      }
    }

    // Reconstruct Map from JSON
    const chunks = new Map(
      Object.entries(data.chunks).map(([path, entry]) => [
        path,
        entry as { contentHash: string; mtime: number }
      ])
    )

    return { version: data.version, chunks }
  } catch {
    // Corrupted manifest: return empty
    return {
      version: MANIFEST_VERSION,
      chunks: new Map(),
    }
  }
}

export async function saveChunkManifest(
  cacheDir: string,
  manifest: ChunkManifest
): Promise<void> {
  const fs = getPortableFS()
  const manifestPath = path.join(cacheDir, MANIFEST_FILENAME)

  // Convert Map to plain object for JSON serialization
  const data = {
    version: manifest.version,
    chunks: Object.fromEntries(manifest.chunks),
  }

  await fs.writeFile(manifestPath, JSON.stringify(data, null, 2))
}
```

##### Integration with Builder Session

**File**: `packages/builder/src/session/builder-session.ts`

```typescript
import { loadChunkManifest, saveChunkManifest } from '../intermediate-module/manifest'
import { writeChunkModules } from '../intermediate-module/chunk-writer'

export class BuilderSession {
  private chunkManifest: ChunkManifest | null = null

  async initialize() {
    this.chunkManifest = await loadChunkManifest(this.cacheDir)
  }

  async writeChunks(chunks: Chunk[]) {
    if (!this.chunkManifest) {
      throw new Error('Session not initialized')
    }

    const results = await writeChunkModules(chunks, this.chunkManifest)

    // Persist updated manifest
    await saveChunkManifest(this.cacheDir, this.chunkManifest)

    // Log stats
    console.log(`Written: ${results.written.length}, Skipped: ${results.skipped.length}`)

    if (results.errors.length > 0) {
      console.error(`Errors: ${results.errors.length}`)
      results.errors.forEach(({ path, error }) => {
        console.error(`  ${path}: ${error.message}`)
      })
    }

    return results
  }
}
```

##### Validation

- [ ] Manifest persists between builds
- [ ] Manifest survives process restart
- [ ] Version mismatch clears old manifest
- [ ] Diff snapshots show skipped files

---

### Testing

**File**: `tests/integration/chunk_writing.test.ts`

```typescript
import { describe, test, expect } from 'bun:test'
import { setupFixture } from '../utils/fixtures'

describe('Chunk content hash optimization', () => {
  test('skips unchanged chunks on rebuild', async () => {
    const workspace = await setupFixture('simple-project')

    // First build
    const result1 = await workspace.runBuilder()
    expect(result1.written.length).toBeGreaterThan(0)
    expect(result1.skipped.length).toBe(0)

    // Second build without changes
    const result2 = await workspace.runBuilder()
    expect(result2.written.length).toBe(0)
    expect(result2.skipped.length).toBe(result1.written.length)
  })

  test('rewrites modified chunks', async () => {
    const workspace = await setupFixture('simple-project')

    // First build
    await workspace.runBuilder()

    // Modify a source file
    await workspace.modifyFile('src/index.ts', 'export const x = 2')

    // Second build
    const result = await workspace.runBuilder()
    expect(result.written.length).toBeGreaterThan(0)
  })

  test('handles corrupted chunks', async () => {
    const workspace = await setupFixture('simple-project')

    // First build
    const result1 = await workspace.runBuilder()

    // Corrupt a chunk file
    const chunkPath = result1.written[0]
    await workspace.writeFile(chunkPath, 'CORRUPTED')

    // Second build
    const result2 = await workspace.runBuilder()
    expect(result2.written).toContain(chunkPath)
  })
})
```

---

## #4: Cache Invalidation Defect

**Priority**: P1 | **Complexity**: M (Medium) | **Duration**: 4-5 days

### Problem

Schema and config changes don't invalidate cached artifacts because metadata only tracks analyzer version.

**Impact**: Stale codegen output after schema updates.

### Tasks

#### #4A: Add Schema Versioning to Cache Envelopes

**File**: `packages/builder/src/cache/metadata.ts` (new file)

##### Implementation

```typescript
export interface CacheMetadata {
  analyzerVersion: string
  schemaHash: string
  configHash: string
  timestamp: number
}

export function compareMetadata(
  a: CacheMetadata,
  b: CacheMetadata
): boolean {
  return (
    a.analyzerVersion === b.analyzerVersion &&
    a.schemaHash === b.schemaHash &&
    a.configHash === b.configHash
  )
}
```

**File**: `packages/builder/src/cache/json-cache.ts`

```typescript
import { getPortableFS, getPortableHasher } from '@soda-gql/core/portable'
import { CacheMetadata, compareMetadata } from './metadata'
import * as path from 'node:path'

export interface CacheOptions<T> {
  cacheDir: string
  namespace: string
  metadata: CacheMetadata
}

export interface Cache<T> {
  get(key: string): Promise<T | null>
  set(key: string, value: T): Promise<void>
  clear(): Promise<void>
}

export function createJsonCache<T>(options: CacheOptions<T>): Cache<T> {
  const fs = getPortableFS()
  const hasher = getPortableHasher()

  const namespaceDir = path.join(options.cacheDir, options.namespace)
  const metadataPath = path.join(namespaceDir, '_metadata.json')

  // Check if cache is valid
  async function validateCache(): Promise<boolean> {
    if (!(await fs.exists(metadataPath))) {
      return false
    }

    try {
      const content = await fs.readFile(metadataPath)
      const stored: CacheMetadata = JSON.parse(content)
      return compareMetadata(stored, options.metadata)
    } catch {
      return false
    }
  }

  // Initialize cache
  const initPromise = (async () => {
    const isValid = await validateCache()

    if (!isValid) {
      // Clear stale cache
      if (await fs.exists(namespaceDir)) {
        await clearNamespace(namespaceDir)
      }

      // Create cache directory
      await fs.mkdir(namespaceDir, { recursive: true })

      // Write new metadata
      await fs.writeFile(
        metadataPath,
        JSON.stringify(options.metadata, null, 2)
      )
    }
  })()

  return {
    async get(key: string): Promise<T | null> {
      await initPromise

      const keyHash = hasher.hash(key, 'sha256')
      const cachePath = path.join(namespaceDir, `${keyHash}.json`)

      if (!(await fs.exists(cachePath))) {
        return null
      }

      try {
        const content = await fs.readFile(cachePath)
        return JSON.parse(content) as T
      } catch {
        return null
      }
    },

    async set(key: string, value: T): Promise<void> {
      await initPromise

      const keyHash = hasher.hash(key, 'sha256')
      const cachePath = path.join(namespaceDir, `${keyHash}.json`)

      await fs.writeFile(cachePath, JSON.stringify(value, null, 2))
    },

    async clear(): Promise<void> {
      await clearNamespace(namespaceDir)
    },
  }
}

async function clearNamespace(dir: string): Promise<void> {
  // Implementation: recursively delete directory
  const fs = getPortableFS()
  // TODO: Add recursive delete to PortableFS
  const { rm } = await import('node:fs/promises')
  await rm(dir, { recursive: true, force: true })
}
```

##### Validation

- [ ] Contract test: Schema change clears cache
- [ ] Contract test: Config change clears cache
- [ ] Unit test: Unchanged metadata reuses cache
- [ ] Unit test: Metadata file survives across builds

---

#### #4B: Compute and Propagate Schema Hash

**File**: `packages/codegen/src/schema.ts`

```typescript
import { getPortableHasher } from '@soda-gql/core/portable'

export function computeSchemaHash(schemaDocument: string): string {
  const hasher = getPortableHasher()
  // Normalize schema (strip comments/whitespace) before hashing
  const normalized = normalizeSchema(schemaDocument)
  return hasher.hash(normalized, 'sha256')
}

function normalizeSchema(schema: string): string {
  // Remove comments and normalize whitespace
  return schema
    .split('\n')
    .map(line => line.replace(/#.*$/, '').trim())
    .filter(line => line.length > 0)
    .join('\n')
}
```

**File**: `packages/codegen/src/cli.ts`

```typescript
import { computeSchemaHash } from './schema'

export async function codegenCommand(options: CodegenOptions) {
  const schemaDocument = await loadSchema(options.schema)
  const schemaHash = computeSchemaHash(schemaDocument)

  // Pass to builder
  const builderOptions = {
    ...options,
    schemaHash,
  }

  await runBuilder(builderOptions)
}
```

**File**: `packages/builder/src/session/builder-session.ts`

```typescript
import { createJsonCache } from '../cache/json-cache'
import { CacheMetadata } from '../cache/metadata'
import { getPortableHasher } from '@soda-gql/core/portable'

export class BuilderSession {
  private cache: Cache<any>

  constructor(private options: BuilderOptions) {
    const metadata: CacheMetadata = {
      analyzerVersion: ANALYZER_VERSION,
      schemaHash: options.schemaHash,
      configHash: this.computeConfigHash(),
      timestamp: Date.now(),
    }

    this.cache = createJsonCache({
      cacheDir: options.cacheDir,
      namespace: 'builder',
      metadata,
    })
  }

  private computeConfigHash(): string {
    const hasher = getPortableHasher()
    const configStr = JSON.stringify(this.options.config)
    return hasher.hash(configStr, 'sha256')
  }
}
```

##### Validation

- [ ] Integration test: Build after schema change regenerates cache
- [ ] Integration test: Build with same schema reuses cache
- [ ] Integration test: Config change clears cache
- [ ] Unit test: Schema normalization produces consistent hashes

---

### Testing

**File**: `tests/contract/builder/cache_invalidation.test.ts`

```typescript
import { describe, test, expect } from 'bun:test'
import { setupFixture } from '../../utils/fixtures'

describe('Cache invalidation', () => {
  test('invalidates cache on schema change', async () => {
    const workspace = await setupFixture('simple-schema')

    // Build with schema v1
    await workspace.runCodegen({ schema: 'schema-v1.graphql' })
    const metadata1 = await workspace.readCacheMetadata()

    // Build with schema v2
    await workspace.runCodegen({ schema: 'schema-v2.graphql' })
    const metadata2 = await workspace.readCacheMetadata()

    expect(metadata2.schemaHash).not.toBe(metadata1.schemaHash)
  })

  test('reuses cache with unchanged schema', async () => {
    const workspace = await setupFixture('simple-schema')

    await workspace.runCodegen({ schema: 'schema.graphql' })
    const cacheEntries1 = await workspace.listCacheEntries()

    await workspace.runCodegen({ schema: 'schema.graphql' })
    const cacheEntries2 = await workspace.listCacheEntries()

    expect(cacheEntries2).toEqual(cacheEntries1)
  })

  test('invalidates cache on config change', async () => {
    const workspace = await setupFixture('configurable')

    await workspace.runBuilder({ config: { option: 'a' } })
    const metadata1 = await workspace.readCacheMetadata()

    await workspace.runBuilder({ config: { option: 'b' } })
    const metadata2 = await workspace.readCacheMetadata()

    expect(metadata2.configHash).not.toBe(metadata1.configHash)
  })
})
```

---

## Completion Criteria

### Per-Task

- [ ] #2A: Module resolver handles `.tsx` and index files
- [ ] #2B: Path normalization consistent across platforms
- [ ] #6A: Chunk writing skips unchanged content
- [ ] #6B: Chunk manifest persists and loads correctly
- [ ] #4A: Cache metadata includes schema/config hashes
- [ ] #4B: Schema hash propagates through codegen → builder

### Phase-Level

- [ ] All tasks completed
- [ ] All tests pass
- [ ] Performance metrics met:
  - Resolver adds < 10ms latency per module
  - 80%+ chunk write skip rate on no-op rebuild
  - Cache invalidation is immediate and reliable
- [ ] Documentation updated
- [ ] Code reviewed

---

## Next Phase

After Phase 2 completion → **Phase 3: High-Level Optimizations**

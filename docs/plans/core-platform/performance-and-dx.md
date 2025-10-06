# Phase 3: High-Level Optimizations

**Status**: Ready for Implementation
**Priority**: P2 - Enhancements
**Estimated Duration**: 2-3 weeks
**Dependencies**: Phase 1 (Portability Layer), Phase 2 (Core Improvements)

---

## Overview

Improve developer experience, code maintainability, and plugin performance. These optimizations build on the foundation from Phases 1 & 2.

**What this delivers**:
- Faster watch mode via artifact memoization
- Type-safe error handling with neverthrow
- Cleaner package boundaries and APIs

---

## Tasks Overview

- **#10**: Plugin Artifact Memoization (3-4 days)
- **#9A**: Builder neverthrow Migration (4-5 days)
- **#9B**: Plugin neverthrow Migration (2-3 days)
- **#8A**: Create Internal Modules (4-5 days)
- **#8B**: Unify Config Loading (included in #8A)

---

## #10: Plugin Artifact Memoization

**Priority**: P2 | **Complexity**: M (Medium) | **Duration**: 3-4 days

### Problem

Babel plugin rebuilds entire artifact on every file change during watch mode because `preparePluginState` lacks memoization.

**Impact**: Inefficient watch mode, slow development feedback.

### Implementation

#### Create Artifact Cache

**File**: `packages/plugin-babel/src/artifact-cache.ts` (new file)

```typescript
import { getPortableHasher, getPortableFS } from '@soda-gql/common/portable'
import type { BuilderArtifact } from '@soda-gql/builder'

interface ArtifactCacheEntry {
  artifact: BuilderArtifact
  configHash: string
  mtime: number
}

const artifactCache = new Map<string, ArtifactCacheEntry>()

export interface LoadArtifactOptions {
  force?: boolean
}

export async function loadArtifact(
  configPath: string,
  options: LoadArtifactOptions = {}
): Promise<BuilderArtifact> {
  const fs = getPortableFS()
  const hasher = getPortableHasher()

  // Compute cache key from config content
  const configContent = await fs.readFile(configPath)
  const configHash = hasher.hash(configContent, 'sha256')

  // Check cache
  const cached = artifactCache.get(configPath)

  if (!options.force && cached && cached.configHash === configHash) {
    // Verify config file hasn't been modified
    const stat = await fs.stat(configPath)
    if (stat.mtime.getTime() <= cached.mtime) {
      return cached.artifact
    }
  }

  // Cache miss or invalidated - rebuild
  const { runBuilder } = await import('@soda-gql/builder')
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

/**
 * Get cache statistics for debugging
 */
export function getArtifactCacheStats(): {
  size: number
  entries: Array<{ path: string; mtime: number }>
} {
  return {
    size: artifactCache.size,
    entries: Array.from(artifactCache.entries()).map(([path, entry]) => ({
      path,
      mtime: entry.mtime,
    })),
  }
}
```

#### Integrate with Babel Plugin

**File**: `packages/plugin-babel/src/state.ts`

```typescript
import { loadArtifact } from './artifact-cache'

export async function preparePluginState(
  configPath: string
): Promise<PluginState> {
  // Use memoized artifact loading
  const artifact = await loadArtifact(configPath)

  return createState(artifact)
}

/**
 * Force reload artifact (for watch mode file changes)
 */
export async function refreshPluginState(
  configPath: string
): Promise<PluginState> {
  const artifact = await loadArtifact(configPath, { force: true })
  return createState(artifact)
}
```

#### Add CLI Invalidation Command

**File**: `packages/cli/src/commands/clean.ts`

```typescript
import { invalidateArtifactCache } from '@soda-gql/plugin-babel/artifact-cache'

export async function cleanCommand(options: { cache?: boolean } = {}) {
  if (options.cache !== false) {
    // Clear builder cache
    await clearBuilderCache()

    // Clear plugin artifact cache
    invalidateArtifactCache()

    console.log('✓ Caches cleared')
  }
}
```

#### Add Watch Mode Support

**File**: `packages/plugin-babel/src/watch.ts` (new file)

```typescript
import { watch } from 'node:fs/promises'
import { invalidateArtifactCache } from './artifact-cache'

export async function watchConfigFile(
  configPath: string,
  onChange: () => void
): Promise<() => void> {
  const watcher = watch(configPath)

  const watchTask = (async () => {
    for await (const event of watcher) {
      if (event.eventType === 'change') {
        // Invalidate cache when config changes
        invalidateArtifactCache(configPath)
        onChange()
      }
    }
  })()

  // Return cleanup function
  return () => {
    watcher.close()
  }
}
```

### Testing

**File**: `packages/plugin-babel/src/__tests__/artifact-cache.test.ts`

```typescript
import { describe, test, expect, beforeEach } from 'bun:test'
import { loadArtifact, invalidateArtifactCache, getArtifactCacheStats } from '../artifact-cache'
import { setupFixture } from '../../../tests/utils/fixtures'

describe('Artifact cache', () => {
  beforeEach(() => {
    invalidateArtifactCache()
  })

  test('reuses artifact on repeated calls', async () => {
    const workspace = await setupFixture('simple-plugin')
    const configPath = workspace.path('soda-gql.config.json')

    const artifact1 = await loadArtifact(configPath)
    const artifact2 = await loadArtifact(configPath)

    // Should be same instance (reference equality)
    expect(artifact2).toBe(artifact1)
  })

  test('invalidates on config content change', async () => {
    const workspace = await setupFixture('simple-plugin')
    const configPath = workspace.path('soda-gql.config.json')

    const artifact1 = await loadArtifact(configPath)

    // Modify config content
    await workspace.modifyConfig({ newOption: true })

    const artifact2 = await loadArtifact(configPath)

    expect(artifact2).not.toBe(artifact1)
  })

  test('force option bypasses cache', async () => {
    const workspace = await setupFixture('simple-plugin')
    const configPath = workspace.path('soda-gql.config.json')

    const artifact1 = await loadArtifact(configPath)
    const artifact2 = await loadArtifact(configPath, { force: true })

    expect(artifact2).not.toBe(artifact1)
  })

  test('tracks cache statistics', async () => {
    const workspace1 = await setupFixture('plugin-a')
    const workspace2 = await setupFixture('plugin-b')

    await loadArtifact(workspace1.path('config.json'))
    await loadArtifact(workspace2.path('config.json'))

    const stats = getArtifactCacheStats()
    expect(stats.size).toBe(2)
    expect(stats.entries).toHaveLength(2)
  })
})
```

**File**: `tests/integration/plugin_watch_mode.test.ts`

```typescript
import { describe, test, expect } from 'bun:test'
import { setupFixture } from '../utils/fixtures'

describe('Plugin watch mode', () => {
  test('reuses artifact when files unchanged', async () => {
    const workspace = await setupFixture('watch-mode')

    // Start watch mode
    const watcher = await workspace.startWatch()

    // Trigger multiple file changes
    await workspace.touch('src/component.tsx')
    await workspace.sleep(100)
    await workspace.touch('src/utils.ts')
    await workspace.sleep(100)

    // Should only rebuild once (artifact cached)
    const stats = watcher.getStats()
    expect(stats.artifactLoads).toBe(1)
    expect(stats.transforms).toBeGreaterThan(1)

    await watcher.stop()
  })
})
```

### Validation

- [ ] Repeated calls with same config reuse artifact
- [ ] Config change triggers rebuild
- [ ] Watch mode reuses artifact across file changes
- [ ] Performance: 90%+ cache hit rate in watch mode
- [ ] Cache can be manually cleared via CLI

---

## #9: neverthrow Migration

**Scope**: Builder and plugin packages ONLY (core excluded per user decision)

### #9A: Builder Error Handling

**Priority**: P2 | **Complexity**: M (Medium) | **Duration**: 4-5 days

#### Define Error Types

**File**: `packages/builder/src/errors.ts` (new file)

```typescript
import { Result, ok, err } from 'neverthrow'

export type BuilderErrorCode =
  | 'SCHEMA_PARSE_ERROR'
  | 'MODULE_NOT_FOUND'
  | 'CACHE_READ_ERROR'
  | 'CACHE_WRITE_ERROR'
  | 'INVALID_CONFIG'
  | 'DEPENDENCY_CYCLE'
  | 'TRANSFORM_ERROR'

export interface BuilderError {
  code: BuilderErrorCode
  message: string
  cause?: unknown
  filePath?: string
  details?: Record<string, unknown>
}

export type BuilderResult<T> = Result<T, BuilderError>

/**
 * Create a BuilderError
 */
export function createBuilderError(
  code: BuilderErrorCode,
  message: string,
  options: {
    cause?: unknown
    filePath?: string
    details?: Record<string, unknown>
  } = {}
): BuilderError {
  return {
    code,
    message,
    ...options,
  }
}

/**
 * Type guard for BuilderError
 */
export function isBuilderError(error: unknown): error is BuilderError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error
  )
}
```

#### Refactor Key Functions

**File**: `packages/builder/src/config/loader.ts`

```typescript
import { BuilderResult, createBuilderError } from '../errors'
import { ok, err } from 'neverthrow'
import { getPortableFS } from '@soda-gql/common/portable'

// BEFORE
export function loadConfig(path: string): Config {
  if (!existsSync(path)) {
    throw new Error(`Config not found: ${path}`)
  }
  return JSON.parse(readFileSync(path, 'utf-8'))
}

// AFTER
export async function loadConfig(path: string): BuilderResult<Config> {
  const fs = getPortableFS()

  if (!(await fs.exists(path))) {
    return err(createBuilderError(
      'INVALID_CONFIG',
      `Config not found: ${path}`,
      { filePath: path }
    ))
  }

  try {
    const content = await fs.readFile(path)
    const config = JSON.parse(content)
    return ok(config)
  } catch (e) {
    return err(createBuilderError(
      'INVALID_CONFIG',
      `Failed to parse config: ${e instanceof Error ? e.message : 'Unknown error'}`,
      { cause: e, filePath: path }
    ))
  }
}
```

**File**: `packages/builder/src/discovery/discoverer.ts`

```typescript
import { BuilderResult, createBuilderError } from '../errors'
import { ok, err, Result } from 'neverthrow'

// Remove throw statements, return Results instead
export async function discoverModules(
  entryPoints: string[]
): BuilderResult<ModuleMap> {
  const modules = new Map<string, Module>()

  for (const entry of entryPoints) {
    const result = await analyzeModule(entry)

    if (result.isErr()) {
      return err(result.error)
    }

    modules.set(entry, result.value)
  }

  return ok(modules)
}
```

#### Update Call Sites

**File**: `packages/builder/src/runner.ts`

```typescript
import { BuilderResult } from './errors'
import { Result } from 'neverthrow'

export async function runBuilder(
  options: BuilderOptions
): BuilderResult<BuilderArtifact> {
  // Load config
  const configResult = await loadConfig(options.configPath)
  if (configResult.isErr()) {
    return err(configResult.error)
  }
  const config = configResult.value

  // Discover modules
  const modulesResult = await discoverModules(config.entryPoints)
  if (modulesResult.isErr()) {
    return err(modulesResult.error)
  }
  const modules = modulesResult.value

  // Build artifact
  const artifactResult = await buildArtifact(modules)
  if (artifactResult.isErr()) {
    return err(artifactResult.error)
  }

  return ok(artifactResult.value)
}

// Alternative: Use Result.combine for parallel operations
export async function runBuilderAlternative(
  options: BuilderOptions
): BuilderResult<BuilderArtifact> {
  const results = await Promise.all([
    loadConfig(options.configPath),
    loadSchema(options.schemaPath),
  ])

  return Result.combine(results).andThen(([config, schema]) => {
    return buildArtifact({ config, schema })
  })
}
```

#### Error Reporting

**File**: `packages/builder/src/errors.ts` (additions)

```typescript
/**
 * Format BuilderError for console output
 */
export function formatBuilderError(error: BuilderError): string {
  const lines: string[] = []

  lines.push(`Error [${error.code}]: ${error.message}`)

  if (error.filePath) {
    lines.push(`  at ${error.filePath}`)
  }

  if (error.details) {
    lines.push(`  Details: ${JSON.stringify(error.details, null, 2)}`)
  }

  if (error.cause) {
    lines.push(`  Caused by: ${error.cause}`)
  }

  return lines.join('\n')
}
```

### #9B: Plugin Error Handling

**Priority**: P2 | **Complexity**: M (Medium) | **Duration**: 2-3 days

#### Define Error Types

**File**: `packages/plugin-babel/src/errors.ts` (new file)

```typescript
import { Result } from 'neverthrow'

export type PluginErrorCode =
  | 'ARTIFACT_LOAD_ERROR'
  | 'TRANSFORM_ERROR'
  | 'INVALID_OPTIONS'
  | 'CONFIG_NOT_FOUND'

export interface PluginError {
  code: PluginErrorCode
  message: string
  cause?: unknown
  filePath?: string
}

export type PluginResult<T> = Result<T, PluginError>

export function createPluginError(
  code: PluginErrorCode,
  message: string,
  options: {
    cause?: unknown
    filePath?: string
  } = {}
): PluginError {
  return {
    code,
    message,
    ...options,
  }
}
```

#### Refactor Plugin State

**File**: `packages/plugin-babel/src/state.ts`

```typescript
import { PluginResult, createPluginError } from './errors'
import { ok, err } from 'neverthrow'
import { loadArtifact } from './artifact-cache'

export async function preparePluginState(
  configPath: string
): PluginResult<PluginState> {
  try {
    const artifact = await loadArtifact(configPath)
    const state = createState(artifact)
    return ok(state)
  } catch (e) {
    return err(createPluginError(
      'ARTIFACT_LOAD_ERROR',
      'Failed to load builder artifact',
      { cause: e, filePath: configPath }
    ))
  }
}
```

### Testing

**File**: `packages/builder/tests/error-handling.test.ts`

```typescript
import { describe, test, expect } from 'bun:test'
import { loadConfig } from '../src/config/loader'

describe('Builder error handling', () => {
  test('returns error for missing config', async () => {
    const result = await loadConfig('/nonexistent/config.json')

    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.code).toBe('INVALID_CONFIG')
      expect(result.error.filePath).toBe('/nonexistent/config.json')
    }
  })

  test('returns error for malformed JSON', async () => {
    const workspace = await setupFixture('invalid-config')
    const result = await loadConfig(workspace.path('bad-config.json'))

    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.code).toBe('INVALID_CONFIG')
      expect(result.error.cause).toBeDefined()
    }
  })
})
```

### Validation

- [ ] No `throw` statements in builder (except bugs)
- [ ] No `throw` statements in plugin
- [ ] All builder functions return `BuilderResult<T>`
- [ ] All plugin functions return `PluginResult<T>`
- [ ] Error messages are informative
- [ ] Tests pass

---

## #8: Package Design Cleanup

**Priority**: P2 | **Complexity**: M (Medium) | **Duration**: 4-5 days

**Scope**: Exclude `@soda-gql/runtime` (deferred to next iteration)

### #8A: Create Internal Modules & Tighten Exports

#### Builder Package

**File**: `packages/builder/src/index.ts`

```typescript
// Public API only
export { runBuilder, type BuilderOptions } from './runner'
export type { BuilderArtifact, BuilderMetadata } from './types'
export type { BuilderError, BuilderResult } from './errors'

// DO NOT EXPORT:
// - BuilderSession (internal implementation)
// - Chunk internals (intermediate representation)
// - Cache implementation details
```

**File**: `packages/builder/package.json`

```json
{
  "name": "@soda-gql/builder",
  "exports": {
    ".": "./src/index.ts",
    "./types": "./src/types.ts",
    "./errors": "./src/errors.ts",
    "./package.json": "./package.json",
    "./internal/*": null
  }
}
```

**Move internals**:
- `src/session/` → `src/internal/session/`
- `src/intermediate-module/` → `src/internal/intermediate-module/`
- `src/cache/` → keep (may be useful for advanced users)

#### Plugin Package

**File**: `packages/plugin-babel/src/index.ts`

```typescript
// Public API
export { createSodaGqlPlugin, type PluginOptions } from './plugin'
export type { PluginError, PluginResult } from './errors'

// Internal - not exported
// - artifact-cache (implementation detail)
// - state (implementation detail)
```

**File**: `packages/plugin-babel/package.json`

```json
{
  "name": "@soda-gql/plugin-babel",
  "exports": {
    ".": "./src/index.ts",
    "./package.json": "./package.json",
    "./internal/*": null
  }
}
```

#### Config Package

**File**: `packages/config/src/index.ts`

```typescript
// Unified config loading
export { loadConfig, type LoadConfigOptions } from './loader'
export type { Config, ConfigSchema } from './types'

// Remove separate JSON/TS loaders from public API
```

### #8B: Unify Config Loading

**File**: `packages/config/src/loader.ts`

```typescript
import { getPortableFS } from '@soda-gql/common/portable'
import { Result, ok, err } from 'neverthrow'

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

function detectFormat(path: string): 'json' | 'typescript' {
  return path.endsWith('.json') ? 'json' : 'typescript'
}

async function loadJsonConfig(path: string): Promise<Result<Config, ConfigError>> {
  const fs = getPortableFS()

  if (!(await fs.exists(path))) {
    return err({ code: 'CONFIG_NOT_FOUND', message: `Config not found: ${path}` })
  }

  try {
    const content = await fs.readFile(path)
    const config = JSON.parse(content)
    return ok(config)
  } catch (e) {
    return err({
      code: 'INVALID_CONFIG',
      message: `Failed to parse JSON config: ${e}`,
      cause: e,
    })
  }
}

async function loadTsConfig(path: string): Promise<Result<Config, ConfigError>> {
  // Dynamic import for .ts config
  try {
    const module = await import(path)
    return ok(module.default ?? module.config)
  } catch (e) {
    return err({
      code: 'INVALID_CONFIG',
      message: `Failed to load TypeScript config: ${e}`,
      cause: e,
    })
  }
}
```

**Remove**: `packages/cli/src/config/loader.ts` (use `@soda-gql/config` instead)

### Validation

- [ ] TypeScript compilation succeeds: `bun typecheck`
- [ ] No broken imports from public API consumers
- [ ] Internal imports blocked by package.json exports
- [ ] CLI tests pass with unified config loader
- [ ] Both JSON and TS configs work

---

## Completion Criteria

### Per-Task

- [ ] #10: Artifact memoization implemented and tested
- [ ] #9A: Builder uses neverthrow, no throw statements
- [ ] #9B: Plugin uses neverthrow, no throw statements
- [ ] #8A: Internal modules isolated, exports tightened
- [ ] #8B: Config loading unified

### Phase-Level

- [ ] All tasks completed
- [ ] All tests pass
- [ ] Performance targets met:
  - Plugin artifact cache: 90%+ hit rate in watch mode
  - Error handling: No performance regression
- [ ] Documentation updated
- [ ] Breaking changes documented (if any)
- [ ] Code reviewed

---

## Next Phase

After Phase 3 completion → **Phase 4: Quality Assurance**

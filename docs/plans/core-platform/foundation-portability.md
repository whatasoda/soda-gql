# Phase 1: Portability Layer

**Status**: Ready for Implementation
**Priority**: P1 - Foundation
**Estimated Duration**: 1-2 weeks
**Dependencies**: None (foundational work)

---

## Overview

Introduce runtime-agnostic portability layer to support both Bun and Node.js execution. This is foundational work that enables all subsequent improvements.

**What this enables**:
- Builder/plugin runs on Node.js (not just Bun)
- Consistent behavior across runtimes
- Foundation for #2 (resolver), #6 (chunk writing), #10 (artifact cache)

---

## Tasks

### #5A: Implement Portability Layer

**Complexity**: L (Large) | **Files**: `packages/common/src/portable/*.ts`

#### 1. Create Portable Filesystem API

**File**: `packages/common/src/portable/fs.ts`

```typescript
export interface PortableFS {
  readFile(path: string): Promise<string>
  writeFile(path: string, content: string): Promise<void>
  exists(path: string): Promise<boolean>
  stat(path: string): Promise<{ mtime: Date; size: number }>
  rename(oldPath: string, newPath: string): Promise<void>
}

export function createPortableFS(): PortableFS {
  // Feature detection: Use Bun APIs when available, fallback to Node
  const isBun = typeof Bun !== 'undefined'

  if (isBun) {
    return {
      async readFile(path) {
        const file = Bun.file(path)
        return await file.text()
      },
      async writeFile(path, content) {
        await Bun.write(path, content)
      },
      async exists(path) {
        const file = Bun.file(path)
        return await file.exists()
      },
      async stat(path) {
        const file = Bun.file(path)
        const size = file.size
        // Bun doesn't expose mtime directly, use Node fs.stat
        const { mtime } = await import('node:fs/promises').then(fs => fs.stat(path))
        return { mtime, size }
      },
      async rename(oldPath, newPath) {
        const { rename } = await import('node:fs/promises')
        await rename(oldPath, newPath)
      }
    }
  }

  // Node.js implementation
  return {
    async readFile(path) {
      const { readFile } = await import('node:fs/promises')
      return await readFile(path, 'utf-8')
    },
    async writeFile(path, content) {
      const { writeFile } = await import('node:fs/promises')
      await writeFile(path, content, 'utf-8')
    },
    async exists(path) {
      const { access } = await import('node:fs/promises')
      try {
        await access(path)
        return true
      } catch {
        return false
      }
    },
    async stat(path) {
      const { stat } = await import('node:fs/promises')
      const stats = await stat(path)
      return { mtime: stats.mtime, size: stats.size }
    },
    async rename(oldPath, newPath) {
      const { rename } = await import('node:fs/promises')
      await rename(oldPath, newPath)
    }
  }
}

// Singleton to avoid recreating instances
let fsInstance: PortableFS | null = null

export function getPortableFS(): PortableFS {
  if (!fsInstance) {
    fsInstance = createPortableFS()
  }
  return fsInstance
}
```

#### 2. Create Portable Hashing API

**File**: `packages/common/src/portable/hash.ts`

```typescript
export interface PortableHasher {
  hash(content: string, algorithm?: 'sha256' | 'xxhash'): string
}

export function createPortableHasher(): PortableHasher {
  const isBun = typeof Bun !== 'undefined'

  if (isBun) {
    return {
      hash(content, algorithm = 'xxhash') {
        if (algorithm === 'sha256') {
          const hasher = new Bun.CryptoHasher('sha256')
          hasher.update(content)
          return hasher.digest('hex')
        }
        // xxhash
        return Bun.hash(content).toString(16)
      }
    }
  }

  // Node.js implementation
  return {
    hash(content, algorithm = 'xxhash') {
      if (algorithm === 'sha256') {
        const crypto = require('node:crypto')
        return crypto.createHash('sha256').update(content).digest('hex')
      }
      // xxhash fallback: use sha256 for simplicity (can add xxhash package later)
      const crypto = require('node:crypto')
      return crypto.createHash('sha256').update(content).digest('hex')
    }
  }
}

let hasherInstance: PortableHasher | null = null

export function getPortableHasher(): PortableHasher {
  if (!hasherInstance) {
    hasherInstance = createPortableHasher()
  }
  return hasherInstance
}
```

#### 3. Create Portable ID Generation

**File**: `packages/common/src/portable/id.ts`

```typescript
export function generateId(): string {
  const isBun = typeof Bun !== 'undefined' && typeof Bun.randomUUIDv7 === 'function'

  if (isBun) {
    return Bun.randomUUIDv7()
  }

  // Node.js fallback: use crypto.randomUUID
  const crypto = require('node:crypto')
  return crypto.randomUUID()
}
```

#### 4. Create Portable Subprocess API

**File**: `packages/common/src/portable/spawn.ts`

```typescript
export interface SpawnOptions {
  cmd: string[]
  cwd?: string
  env?: Record<string, string>
}

export interface SpawnResult {
  stdout: string
  stderr: string
  exitCode: number
}

export async function spawn(options: SpawnOptions): Promise<SpawnResult> {
  const isBun = typeof Bun !== 'undefined'

  if (isBun) {
    const proc = Bun.spawn(options.cmd, {
      cwd: options.cwd,
      env: options.env,
      stdout: 'pipe',
      stderr: 'pipe',
    })

    const [stdout, stderr] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ])

    const exitCode = await proc.exited

    return { stdout, stderr, exitCode }
  }

  // Node.js implementation
  const { spawn: nodeSpawn } = await import('node:child_process')
  const { promisify } = await import('node:util')
  const execFile = promisify((await import('node:child_process')).execFile)

  try {
    const { stdout, stderr } = await execFile(options.cmd[0], options.cmd.slice(1), {
      cwd: options.cwd,
      env: options.env,
    })
    return { stdout, stderr, exitCode: 0 }
  } catch (error: any) {
    return {
      stdout: error.stdout || '',
      stderr: error.stderr || '',
      exitCode: error.code || 1,
    }
  }
}
```

#### 5. Create Runtime Detection Utility

**File**: `packages/common/src/portable/runtime.ts`

```typescript
export const runtime = {
  isBun: typeof Bun !== 'undefined',
  isNode: typeof process !== 'undefined' && typeof Bun === 'undefined',
} as const
```

#### 6. Create Barrel Export

**File**: `packages/common/src/portable/index.ts`

```typescript
export { createPortableFS, getPortableFS, type PortableFS } from './fs'
export { createPortableHasher, getPortableHasher, type PortableHasher } from './hash'
export { generateId } from './id'
export { spawn, type SpawnOptions, type SpawnResult } from './spawn'
export { runtime } from './runtime'
```

#### Validation

- [ ] All APIs work on Bun runtime
- [ ] All APIs work on Node.js runtime
- [ ] Benchmark: Bun fast-path within 5% of direct API usage
- [ ] Unit tests pass: `packages/common/tests/portable/*.test.ts`

---

### #5B: Migrate Existing Code to Portable APIs

**Complexity**: L (Large) | **Depends on**: #5A

#### Files to Update

1. **Builder - Chunk Writer**
   - File: `packages/builder/src/intermediate-module/chunk-writer.ts`
   - Replace: `Bun.write` → `getPortableFS().writeFile`

2. **Builder - JSON Cache**
   - File: `packages/builder/src/cache/json-cache.ts`
   - Replace: `Bun.file`, `Bun.hash` → `getPortableFS()`, `getPortableHasher()`

3. **Builder - Session**
   - File: `packages/builder/src/session/builder-session.ts`
   - Replace: `Bun.hash` → `getPortableHasher()`

4. **Plugin - State**
   - File: `packages/plugin-babel/src/state.ts`
   - Replace: All Bun API usage → Portable APIs

5. **Codegen - Runner**
   - File: `packages/codegen/src/runner.ts`
   - Replace: File operations → `getPortableFS()`

6. **Test Utilities**
   - Files: `tests/utils/*.ts`
   - Replace: All Bun references → Portable APIs

#### Migration Pattern

```typescript
// BEFORE
import { writeFile } from 'fs/promises'
await Bun.write(filePath, content)

// AFTER
import { getPortableFS } from '@soda-gql/common/portable'
const fs = getPortableFS()
await fs.writeFile(filePath, content)
```

```typescript
// BEFORE
const hash = Bun.hash(content)

// AFTER
import { getPortableHasher } from '@soda-gql/common/portable'
const hasher = getPortableHasher()
const hash = hasher.hash(content, 'xxhash')
```

```typescript
// BEFORE
const id = Bun.randomUUIDv7()

// AFTER
import { generateId } from '@soda-gql/common/portable'
const id = generateId()
```

#### Validation

- [ ] All existing tests pass on Bun
- [ ] All existing tests pass on Node.js
- [ ] Smoke test: `bun run soda-gql codegen` works on both runtimes
- [ ] Smoke test: `bun run soda-gql builder` works on both runtimes
- [ ] No direct `Bun.*` API calls (except in portable layer)

---

## Testing Plan

### Unit Tests

**File**: `packages/common/tests/portable/fs.test.ts`

```typescript
import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { createPortableFS } from '@soda-gql/common/portable'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

describe('PortableFS', () => {
  let testDir: string

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'portable-fs-test-'))
  })

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true })
  })

  test('writes and reads files', async () => {
    const fs = createPortableFS()
    const filePath = join(testDir, 'test.txt')

    await fs.writeFile(filePath, 'hello world')
    const content = await fs.readFile(filePath)

    expect(content).toBe('hello world')
  })

  test('checks file existence', async () => {
    const fs = createPortableFS()
    const existingFile = join(testDir, 'existing.txt')
    const nonExistingFile = join(testDir, 'nonexistent.txt')

    await fs.writeFile(existingFile, 'exists')

    expect(await fs.exists(existingFile)).toBe(true)
    expect(await fs.exists(nonExistingFile)).toBe(false)
  })

  test('gets file stats', async () => {
    const fs = createPortableFS()
    const filePath = join(testDir, 'stats.txt')
    const content = 'test content'

    await fs.writeFile(filePath, content)
    const stats = await fs.stat(filePath)

    expect(stats.size).toBe(content.length)
    expect(stats.mtime).toBeInstanceOf(Date)
  })

  test('renames files', async () => {
    const fs = createPortableFS()
    const oldPath = join(testDir, 'old.txt')
    const newPath = join(testDir, 'new.txt')

    await fs.writeFile(oldPath, 'content')
    await fs.rename(oldPath, newPath)

    expect(await fs.exists(oldPath)).toBe(false)
    expect(await fs.exists(newPath)).toBe(true)
    expect(await fs.readFile(newPath)).toBe('content')
  })
})
```

**File**: `packages/common/tests/portable/hash.test.ts`

```typescript
import { describe, test, expect } from 'bun:test'
import { createPortableHasher } from '@soda-gql/common/portable'

describe('PortableHasher', () => {
  test('generates consistent sha256 hashes', () => {
    const hasher = createPortableHasher()
    const content = 'test content'

    const hash1 = hasher.hash(content, 'sha256')
    const hash2 = hasher.hash(content, 'sha256')

    expect(hash1).toBe(hash2)
    expect(hash1).toHaveLength(64) // SHA256 = 64 hex chars
  })

  test('generates consistent xxhash hashes', () => {
    const hasher = createPortableHasher()
    const content = 'test content'

    const hash1 = hasher.hash(content, 'xxhash')
    const hash2 = hasher.hash(content, 'xxhash')

    expect(hash1).toBe(hash2)
  })

  test('different content produces different hashes', () => {
    const hasher = createPortableHasher()

    const hash1 = hasher.hash('content A', 'sha256')
    const hash2 = hasher.hash('content B', 'sha256')

    expect(hash1).not.toBe(hash2)
  })
})
```

**File**: `packages/common/tests/portable/id.test.ts`

```typescript
import { describe, test, expect } from 'bun:test'
import { generateId } from '@soda-gql/common/portable'

describe('generateId', () => {
  test('generates unique IDs', () => {
    const id1 = generateId()
    const id2 = generateId()

    expect(id1).not.toBe(id2)
  })

  test('generates valid UUID format', () => {
    const id = generateId()
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

    expect(id).toMatch(uuidRegex)
  })
})
```

### Integration Tests

**File**: `tests/integration/portability.test.ts`

```typescript
import { describe, test, expect } from 'bun:test'
import { runtime } from '@soda-gql/common/portable'

describe('Portability integration', () => {
  test('detects runtime correctly', () => {
    // This test behavior depends on runtime
    if (typeof Bun !== 'undefined') {
      expect(runtime.isBun).toBe(true)
      expect(runtime.isNode).toBe(false)
    } else {
      expect(runtime.isBun).toBe(false)
      expect(runtime.isNode).toBe(true)
    }
  })
})
```

---

## Performance Benchmarks

### Setup

**File**: `benchmarks/portability.bench.ts`

```typescript
import { bench, group } from 'mitata'
import { getPortableFS, getPortableHasher } from '@soda-gql/common/portable'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const testDir = mkdtempSync(join(tmpdir(), 'bench-'))
const testFile = join(testDir, 'test.txt')
const testContent = 'x'.repeat(10000) // 10KB

group('File I/O', () => {
  bench('Portable writeFile', async () => {
    const fs = getPortableFS()
    await fs.writeFile(testFile, testContent)
  })

  if (typeof Bun !== 'undefined') {
    bench('Native Bun.write', async () => {
      await Bun.write(testFile, testContent)
    })
  }
})

group('Hashing', () => {
  bench('Portable hash (sha256)', () => {
    const hasher = getPortableHasher()
    hasher.hash(testContent, 'sha256')
  })

  if (typeof Bun !== 'undefined') {
    bench('Native Bun.hash', () => {
      Bun.hash(testContent)
    })
  }
})

// Cleanup
rmSync(testDir, { recursive: true, force: true })
```

### Target Metrics

- **File I/O**: Portable implementation within 5% of native Bun.write
- **Hashing**: Portable implementation within 5% of native Bun.hash
- **Memory**: No significant memory overhead (< 1MB for singleton instances)

---

## Risk Mitigation

### Performance Concerns

**Risk**: Portable layer adds overhead

**Mitigation**:
- Use singletons to avoid instance creation overhead
- Maintain Bun fast-path via feature detection
- Benchmark critical paths
- Add feature flag: `SODA_GQL_FORCE_NODE_MODE=1` for testing

### Runtime Compatibility

**Risk**: Subtle differences between Bun and Node.js

**Mitigation**:
- Comprehensive test suite runs on both runtimes
- CI matrix: Test on Bun + Node.js
- Document runtime-specific behaviors

### Breaking Changes

**Risk**: Migration touches many files

**Mitigation**:
- Thorough code review
- Run full test suite before merge
- Feature branch: `feat/portability-layer`
- Can be reverted cleanly if issues arise

---

## Rollback Strategy

### Feature Flag

```typescript
// Can disable portable layer via env var if issues arise
const USE_PORTABLE_APIS = process.env.SODA_GQL_USE_PORTABLE !== 'false'

export function getPortableFS(): PortableFS {
  if (!USE_PORTABLE_APIS && typeof Bun !== 'undefined') {
    // Fallback to direct Bun APIs
    return createBunOnlyFS()
  }
  return createPortableFS()
}
```

### Git Tags

```bash
# Tag before starting migration
git tag pre-portability-layer

# If needed, rollback
git revert pre-portability-layer..HEAD
```

---

## Completion Criteria

- [ ] All portable APIs implemented and tested
- [ ] All Bun API usage migrated to portable layer
- [ ] Tests pass on both Bun and Node.js runtimes
- [ ] Performance benchmarks within acceptable range (< 5% overhead)
- [ ] Documentation updated
- [ ] Code reviewed and approved

---

## Next Steps

After Phase 1 completion:
- **Phase 2A**: Use portable FS in resolver (#2)
- **Phase 2B**: Use portable hasher in chunk writing (#6)
- **Phase 2C**: Use portable hasher in cache invalidation (#4)

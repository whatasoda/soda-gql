# Phase 4: Quality Assurance

**Status**: Ready for Implementation
**Priority**: P2 - Quality & Stability
**Estimated Duration**: 1-2 weeks
**Dependencies**: Phases 1, 2, 3

---

## Overview

Establish comprehensive testing infrastructure, improve coverage, and document testing practices. This phase ensures all previous work is properly validated.

**What this delivers**:
- 80%+ code coverage across packages
- Comprehensive test documentation
- Reliable CI pipeline
- Confidence in code quality

---

## Tasks Overview

- **#7A**: Add Coverage Targets & Documentation (1-2 days)
- **#7B**: Expand Test Suites (5-7 days)

---

## #7A: Coverage Targets & Documentation

**Priority**: P2 | **Complexity**: S (Small) | **Duration**: 1-2 days

### Testing Guide

**File**: `docs/testing.md`

```markdown
# Testing Guide

## Overview

soda-gql uses a comprehensive testing strategy combining unit, integration, and contract tests with fixture-based behavioral testing.

## Testing Philosophy

### Behavioral Over Implementation

Test **behavior** (execution results), not **implementation details** (output format).

**Bad Example**:
\`\`\`typescript
expect(code).toContain("gqlRuntime.operation")
\`\`\`

**Good Example**:
\`\`\`typescript
const output = executeTransformed(code)
expect(output.operations).toHaveLength(1)
\`\`\`

### Fixture-Based Testing

Store test code as `.ts` fixture files, not inline strings.

**Benefits**:
- Type safety
- Editor support (autocomplete, navigation)
- Refactoring tools work
- Easier to maintain

**Organization**:
- `tests/fixtures/<feature>/` - Reusable test code samples
- Use `@ts-expect-error` for intentionally invalid cases

**Bad Example**:
\`\`\`typescript
const source = \`import { gql } from "@/graphql-system"
export const model = gql.default(...)\`
const result = analyze(source)
\`\`\`

**Good Example**:
\`\`\`typescript
const { filePath, source } = loadFixture("model-definition")
const result = analyze({ filePath, source })
\`\`\`

## Test Organization

### Directory Structure

\`\`\`
tests/
├── unit/           # Fast, isolated tests
│   ├── builder/
│   ├── codegen/
│   └── plugin-babel/
├── integration/    # Full workflow tests with real dependencies
│   ├── builder-session/
│   ├── codegen-cli/
│   └── plugin-watch/
├── contract/       # Public API contracts
│   ├── builder/
│   ├── codegen/
│   └── plugin-babel/
├── fixtures/       # Reusable test code samples
│   ├── model-definition/
│   ├── operation-slices/
│   └── invalid-syntax/
└── utils/          # Test utilities
    ├── fixtures.ts
    ├── workspace.ts
    └── assertions.ts
\`\`\`

### Package-Level Tests

Each package can also have its own tests:

\`\`\`
packages/
├── builder/
│   └── tests/      # Builder-specific unit tests
├── codegen/
│   └── tests/
└── plugin-babel/
    └── src/__tests__/  # Co-located with implementation
\`\`\`

## Coverage Targets

### Minimum Thresholds

- **Unit tests**: 80% line coverage
- **Integration tests**: Critical paths covered
- **Contract tests**: All public APIs tested

### What to Test

**High Priority**:
- Public API functions
- Error handling paths
- Data transformations
- Edge cases and boundary conditions

**Lower Priority**:
- Type definitions (TypeScript handles this)
- Simple getters/setters
- Third-party library wrappers

## Running Tests

### All Tests

\`\`\`bash
bun test
\`\`\`

### With Coverage

\`\`\`bash
bun test:coverage
\`\`\`

### Specific Suite

\`\`\`bash
# Unit tests only
bun test:unit

# Integration tests only
bun test:integration

# Contract tests only
bun test:contract

# Specific file
bun test tests/unit/builder/resolver.test.ts
\`\`\`

### Watch Mode

\`\`\`bash
bun test --watch
\`\`\`

## Writing Tests

### Unit Test Example

\`\`\`typescript
import { describe, test, expect } from 'bun:test'
import { resolveModuleSpecifier } from '../src/resolver'

describe('resolveModuleSpecifier', () => {
  test('resolves .tsx files', async () => {
    const workspace = await setupTestWorkspace({
      'index.ts': '',
      'component.tsx': '',
    })

    const resolved = await resolveModuleSpecifier(
      workspace.path('index.ts'),
      './component'
    )

    expect(resolved).toBe(workspace.path('component.tsx'))
  })

  test('returns null for unresolvable imports', async () => {
    const workspace = await setupTestWorkspace({
      'index.ts': '',
    })

    const resolved = await resolveModuleSpecifier(
      workspace.path('index.ts'),
      './nonexistent'
    )

    expect(resolved).toBeNull()
  })
})
\`\`\`

### Integration Test Example

\`\`\`typescript
import { describe, test, expect } from 'bun:test'
import { setupFixture } from '../utils/fixtures'

describe('Builder incremental builds', () => {
  test('rebuilds only changed modules', async () => {
    const workspace = await setupFixture('multi-module')

    // Initial build
    const result1 = await workspace.runBuilder()
    expect(result1.modules).toHaveLength(3)

    // Modify one module
    await workspace.modifyFile('src/module-a.ts', 'export const x = 2')

    // Incremental build
    const result2 = await workspace.runBuilder()
    expect(result2.rebuiltModules).toEqual(['src/module-a.ts'])
  })
})
\`\`\`

### Contract Test Example

\`\`\`typescript
import { describe, test, expect } from 'bun:test'
import { runBuilder } from '@soda-gql/builder'

describe('Builder public API', () => {
  test('returns Result type with artifact on success', async () => {
    const result = await runBuilder({
      configPath: './test-config.json',
      schemaPath: './test-schema.graphql',
    })

    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.modules).toBeDefined()
      expect(result.value.operations).toBeDefined()
    }
  })

  test('returns Result type with error on failure', async () => {
    const result = await runBuilder({
      configPath: './nonexistent.json',
      schemaPath: './schema.graphql',
    })

    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.code).toBe('INVALID_CONFIG')
    }
  })
})
\`\`\`

## Test Utilities

### Workspace Helper

\`\`\`typescript
import { setupTestWorkspace } from './utils/workspace'

const workspace = await setupTestWorkspace({
  'src/index.ts': 'export const x = 1',
  'src/utils.ts': 'export const y = 2',
  'package.json': JSON.stringify({ name: 'test' }),
})

// Access files
workspace.path('src/index.ts') // Absolute path
await workspace.readFile('src/index.ts') // Read content
await workspace.writeFile('src/index.ts', 'new content')
await workspace.modifyFile('src/index.ts', 'export const x = 2')

// Run commands
await workspace.runBuilder()
await workspace.runCodegen()

// Cleanup (automatic in afterEach)
await workspace.cleanup()
\`\`\`

### Fixture Helper

\`\`\`typescript
import { loadFixture, setupFixture } from './utils/fixtures'

// Load fixture content only
const { filePath, source } = loadFixture('model-definition')

// Setup full fixture workspace
const workspace = await setupFixture('multi-module-project')
await workspace.runBuilder()
\`\`\`

### Assertion Helpers

\`\`\`typescript
import { expectResult, expectError } from './utils/assertions'

// Result assertions
const result = await someOperation()
expectResult(result).toBeOk()
expectResult(result).toHaveValue({ foo: 'bar' })

// Error assertions
const errorResult = await failingOperation()
expectError(errorResult).toHaveCode('INVALID_CONFIG')
expectError(errorResult).toContainMessage('not found')
\`\`\`

## Integration Test Utilities

### Runtime Registry Reset

\`\`\`typescript
import { __resetRuntimeRegistry } from '@soda-gql/core/runtime'

beforeEach(() => {
  __resetRuntimeRegistry()
})
\`\`\`

### Transpile & Execute

\`\`\`typescript
import { Transpiler } from 'bun'

const transpiler = new Transpiler({ loader: 'ts' })
const code = transpiler.transformSync(source)

// Execute with cache-busting
const module = await import(\`file://\${path}?t=\${Date.now()}\`)
\`\`\`

## Performance Testing

### Benchmark Example

\`\`\`typescript
import { bench, group } from 'mitata'

group('Module resolution', () => {
  bench('resolve .tsx import', async () => {
    await resolveModuleSpecifier('index.ts', './component')
  })

  bench('resolve index.tsx', async () => {
    await resolveModuleSpecifier('index.ts', './components')
  })
})
\`\`\`

## CI Integration

### GitHub Actions

\`\`\`yaml
- name: Run tests
  run: bun test

- name: Check coverage
  run: bun test:coverage
\`\`\`

### Coverage Gates

Tests fail if coverage drops below thresholds:
- Lines: 80%
- Functions: 75%
- Branches: 70%

## Debugging Tests

### Verbose Output

\`\`\`bash
bun test --verbose
\`\`\`

### Isolate Failing Test

\`\`\`typescript
test.only('this specific test', async () => {
  // Only this test runs
})
\`\`\`

### Skip Flaky Test

\`\`\`typescript
test.skip('flaky test', async () => {
  // Temporarily skip
})
\`\`\`

## Best Practices

### DO

- ✅ Test behavior, not implementation
- ✅ Use fixtures for test code
- ✅ Keep tests focused and isolated
- ✅ Use descriptive test names
- ✅ Clean up resources (temp files, etc.)
- ✅ Test error cases
- ✅ Use type-safe assertions

### DON'T

- ❌ Mock everything (prefer real dependencies)
- ❌ Test private implementation details
- ❌ Write brittle snapshot tests
- ❌ Leave console.log in tests
- ❌ Ignore flaky tests
- ❌ Test third-party libraries
- ❌ Use inline string code for TypeScript tests

## TDD Workflow (t_wada)

### RED → GREEN → REFACTOR

1. **RED**: Write failing test
2. **GREEN**: Write minimal code to pass
3. **REFACTOR**: Improve code without breaking tests

### Example

\`\`\`typescript
// 1. RED - Test fails
test('resolves .tsx imports', async () => {
  const resolved = await resolveModuleSpecifier('index.ts', './component')
  expect(resolved).toBe('component.tsx')
})

// 2. GREEN - Minimal implementation
async function resolveModuleSpecifier(from, spec) {
  return spec + '.tsx'  // Simplest thing that works
}

// 3. REFACTOR - Add proper logic
async function resolveModuleSpecifier(from, spec) {
  const candidates = ['.tsx', '.ts', '/index.tsx', '/index.ts']
  for (const ext of candidates) {
    const path = spec + ext
    if (await exists(path)) return path
  }
  return null
}
\`\`\`

## Troubleshooting

### Tests Timing Out

- Check for missing `await` on async operations
- Increase timeout: `test('...', async () => {}, { timeout: 10000 })`

### Flaky Tests

- Ensure proper cleanup in `afterEach`
- Avoid relying on timing (`setTimeout`)
- Use deterministic test data

### Coverage Not Updating

- Clear coverage cache: `rm -rf .coverage`
- Re-run: `bun test:coverage`

---

For more examples, see existing tests in `tests/` directory.
\`\`\`

### Package Scripts

**File**: `package.json`

```json
{
  "scripts": {
    "test": "bun test",
    "test:coverage": "bun test --coverage",
    "test:unit": "bun test tests/unit",
    "test:integration": "bun test tests/integration",
    "test:contract": "bun test tests/contract",
    "test:watch": "bun test --watch"
  }
}
```

### Coverage Configuration

**File**: `bunfig.toml` (if Bun supports coverage config)

```toml
[test.coverage]
enabled = true
threshold = { lines = 80, functions = 75, branches = 70 }
exclude = [
  "**/*.test.ts",
  "**/tests/**",
  "**/fixtures/**",
  "**/__tests__/**"
]
```

### Validation

- [ ] Testing guide is clear and comprehensive
- [ ] Coverage scripts work
- [ ] Documentation includes examples
- [ ] CI integration documented

---

## #7B: Expand Test Suites

**Priority**: P2 | **Complexity**: L (Large) | **Duration**: 5-7 days

### New Test Files

#### 1. Portability Layer Tests

Already defined in Phase 1, ensure complete coverage:

- [ ] `packages/core/tests/portable/fs.test.ts`
- [ ] `packages/core/tests/portable/hash.test.ts`
- [ ] `packages/core/tests/portable/id.test.ts`
- [ ] `packages/core/tests/portable/spawn.test.ts`

#### 2. Module Resolver Tests

Already defined in Phase 2:

- [ ] `packages/builder/tests/resolver.test.ts`
- [ ] `tests/integration/dependency_graph_tsx.test.ts`

#### 3. Chunk Writing Tests

Already defined in Phase 2:

- [ ] `tests/integration/chunk_writing.test.ts`

#### 4. Cache Invalidation Tests

Already defined in Phase 2:

- [ ] `tests/contract/builder/cache_invalidation.test.ts`

#### 5. Artifact Memoization Tests

Already defined in Phase 3:

- [ ] `packages/plugin-babel/src/__tests__/artifact-cache.test.ts`
- [ ] `tests/integration/plugin_watch_mode.test.ts`

#### 6. Error Handling Tests

Already defined in Phase 3:

- [ ] `packages/builder/tests/error-handling.test.ts`
- [ ] `packages/plugin-babel/tests/error-handling.test.ts`

### Additional Coverage Areas

#### Path Normalization Edge Cases

**File**: `packages/builder/tests/path-normalization.test.ts`

```typescript
import { describe, test, expect } from 'bun:test'
import { normalizePath, resolveAndNormalize } from '../src/dependency-graph/paths'

describe('Path normalization', () => {
  test('converts Windows paths to forward slashes', () => {
    const result = normalizePath('C:\\Users\\test\\project\\file.ts')
    expect(result).toBe('C:/Users/test/project/file.ts')
  })

  test('handles mixed separators', () => {
    const result = normalizePath('src\\components/Button/index.tsx')
    expect(result).toBe('src/components/Button/index.tsx')
  })

  test('resolves relative paths', () => {
    const result = resolveAndNormalize('/project/src', '../lib/utils.ts')
    expect(result).toContain('lib/utils.ts')
  })
})
```

#### Dependency Graph Diffing

**File**: `packages/builder/tests/graph-diff.test.ts`

```typescript
import { describe, test, expect } from 'bun:test'
import { diffGraphs } from '../src/dependency-graph/diff'

describe('Graph diffing', () => {
  test('identifies added modules', () => {
    const prev = new Map([['a.ts', ['b.ts']]])
    const curr = new Map([['a.ts', ['b.ts']], ['c.ts', ['d.ts']]])

    const diff = diffGraphs(prev, curr)

    expect(diff.added).toContain('c.ts')
  })

  test('identifies removed modules', () => {
    const prev = new Map([['a.ts', ['b.ts']], ['c.ts', ['d.ts']]])
    const curr = new Map([['a.ts', ['b.ts']]])

    const diff = diffGraphs(prev, curr)

    expect(diff.removed).toContain('c.ts')
  })

  test('identifies modified dependencies', () => {
    const prev = new Map([['a.ts', ['b.ts']]])
    const curr = new Map([['a.ts', ['b.ts', 'c.ts']]])

    const diff = diffGraphs(prev, curr)

    expect(diff.modified).toContain('a.ts')
  })
})
```

#### Cache Metadata Comparison

**File**: `packages/builder/tests/cache-metadata.test.ts`

```typescript
import { describe, test, expect } from 'bun:test'
import { compareMetadata } from '../src/cache/metadata'

describe('Cache metadata', () => {
  test('matches identical metadata', () => {
    const meta = {
      analyzerVersion: '1.0.0',
      schemaHash: 'abc123',
      configHash: 'def456',
      timestamp: Date.now(),
    }

    expect(compareMetadata(meta, meta)).toBe(true)
  })

  test('detects schema hash mismatch', () => {
    const meta1 = {
      analyzerVersion: '1.0.0',
      schemaHash: 'abc123',
      configHash: 'def456',
      timestamp: Date.now(),
    }

    const meta2 = { ...meta1, schemaHash: 'different' }

    expect(compareMetadata(meta1, meta2)).toBe(false)
  })
})
```

### Test Utilities Implementation

**File**: `tests/utils/workspace.ts`

```typescript
import { mkdtemp, rm, writeFile, readFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

export interface TestWorkspace {
  root: string
  path(...segments: string[]): string
  readFile(path: string): Promise<string>
  writeFile(path: string, content: string): Promise<void>
  modifyFile(path: string, content: string): Promise<void>
  cleanup(): Promise<void>
  runBuilder(options?: any): Promise<any>
  runCodegen(options?: any): Promise<any>
}

export async function setupTestWorkspace(
  files: Record<string, string>
): Promise<TestWorkspace> {
  const root = await mkdtemp(join(tmpdir(), 'soda-gql-test-'))

  // Write all files
  for (const [path, content] of Object.entries(files)) {
    const fullPath = join(root, path)
    const dir = join(fullPath, '..')
    await mkdir(dir, { recursive: true })
    await writeFile(fullPath, content, 'utf-8')
  }

  return {
    root,
    path(...segments) {
      return join(root, ...segments)
    },
    async readFile(path) {
      return await readFile(join(root, path), 'utf-8')
    },
    async writeFile(path, content) {
      const fullPath = join(root, path)
      const dir = join(fullPath, '..')
      await mkdir(dir, { recursive: true })
      await writeFile(fullPath, content, 'utf-8')
    },
    async modifyFile(path, content) {
      await writeFile(join(root, path), content, 'utf-8')
    },
    async cleanup() {
      await rm(root, { recursive: true, force: true })
    },
    async runBuilder(options = {}) {
      const { runBuilder } = await import('@soda-gql/builder')
      return await runBuilder({ ...options, cwd: root })
    },
    async runCodegen(options = {}) {
      const { runCodegen } = await import('@soda-gql/codegen')
      return await runCodegen({ ...options, cwd: root })
    },
  }
}
```

**File**: `tests/utils/fixtures.ts`

```typescript
import { join } from 'node:path'
import { readFile } from 'node:fs/promises'
import { setupTestWorkspace, type TestWorkspace } from './workspace'

const FIXTURES_DIR = join(__dirname, '../fixtures')

export async function loadFixture(name: string): Promise<{
  filePath: string
  source: string
}> {
  const filePath = join(FIXTURES_DIR, name, 'index.ts')
  const source = await readFile(filePath, 'utf-8')
  return { filePath, source }
}

export async function setupFixture(name: string): Promise<TestWorkspace> {
  // Load fixture directory structure
  const fixturePath = join(FIXTURES_DIR, name)
  const files = await loadFixtureFiles(fixturePath)

  return await setupTestWorkspace(files)
}

async function loadFixtureFiles(dir: string): Promise<Record<string, string>> {
  // Recursively load all files in fixture directory
  // Implementation details...
  return {}
}
```

**File**: `tests/utils/assertions.ts`

```typescript
import { expect } from 'bun:test'
import type { Result } from 'neverthrow'

export function expectResult<T, E>(result: Result<T, E>) {
  return {
    toBeOk() {
      expect(result.isOk()).toBe(true)
    },
    toHaveValue(expected: T) {
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value).toEqual(expected)
      }
    },
  }
}

export function expectError<T, E>(result: Result<T, E>) {
  return {
    toHaveCode(code: string) {
      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect((result.error as any).code).toBe(code)
      }
    },
    toContainMessage(substring: string) {
      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect((result.error as any).message).toContain(substring)
      }
    },
  }
}
```

### Integration Test Scenarios

#### Full Build on Node.js

**File**: `tests/integration/node_runtime.test.ts`

```typescript
import { describe, test, expect } from 'bun:test'
import { spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { setupFixture } from '../utils/fixtures'

const execFile = promisify(require('node:child_process').execFile)

describe('Node.js runtime compatibility', () => {
  test('codegen runs on Node.js', async () => {
    const workspace = await setupFixture('simple-schema')

    // Run codegen with Node.js (not Bun)
    const { stdout, stderr } = await execFile('node', [
      workspace.path('node_modules/.bin/soda-gql'),
      'codegen',
      '--schema', 'schema.graphql',
      '--out', 'src/generated.ts',
    ], {
      cwd: workspace.root,
    })

    expect(stderr).toBe('')
    expect(await workspace.exists('src/generated.ts')).toBe(true)
  })
})
```

### Validation

- [ ] All critical paths have test coverage
- [ ] Coverage meets 80% threshold
- [ ] Tests are reliable (no flakiness)
- [ ] Test utilities are well-documented
- [ ] CI passes with coverage gates

---

## Completion Criteria

### Documentation

- [ ] Testing guide is comprehensive
- [ ] Coverage targets documented
- [ ] Test utilities documented
- [ ] Examples provided for each test type

### Coverage

- [ ] Unit tests: 80%+ line coverage
- [ ] Integration tests cover critical workflows
- [ ] Contract tests cover all public APIs
- [ ] Edge cases tested

### Quality

- [ ] No flaky tests
- [ ] Tests run fast (< 2 min total)
- [ ] Clear, descriptive test names
- [ ] Tests are maintainable

### CI Integration

- [ ] Coverage reporting in CI
- [ ] Coverage gates enforced
- [ ] Test results visible in PR checks

---

## Final Deliverables

After Phase 4 completion, the project should have:

1. ✅ **Comprehensive test suite** covering all features
2. ✅ **High code coverage** (80%+)
3. ✅ **Clear testing documentation**
4. ✅ **Reliable CI pipeline**
5. ✅ **Confidence in code quality**

---

## Post-Implementation

### Deferred Items (Next Iteration)

- Path normalization Windows tests (#1)
- Package exports build scripts (#3)
- Monorepo build tooling (#11)
- `@soda-gql/runtime` consolidation

### Continuous Improvement

- Monitor coverage trends
- Add tests for bug fixes
- Update documentation as needed
- Refine test utilities based on usage

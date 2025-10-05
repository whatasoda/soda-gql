# Plugin Implementation Plan: Vite, Metro, NestJS

**Status**: Planned
**Created**: 2025-10-05
**Codex Analysis**: Completed ([Conversation initiated 2025-10-05])

This document outlines the implementation plan for three new soda-gql plugins following the existing `plugin-babel` pattern.

---

## Overview

### Objective
Create bundler/framework-specific plugins to support soda-gql zero-runtime transformations across different development ecosystems:
- **plugin-vite**: Vite development and build pipeline
- **plugin-metro**: React Native (Metro bundler)
- **plugin-nestjs**: NestJS applications

### Architecture Principle
Extract reusable abstractions from `plugin-babel` into a shared package (`plugin-shared`) to avoid duplication and ensure consistent behavior across all plugins.

---

## Phase 1: Shared Abstraction Layer

### Package: `packages/plugin-shared`

Extract bundler-agnostic logic from `plugin-babel`:

#### 1.1 Options Normalization (`src/options.ts`)
```typescript
export interface SodaGqlPluginOptions {
  mode: 'runtime' | 'zero-runtime';
  importIdentifier?: string;
  diagnostics?: 'console' | 'json' | 'off';
  artifactSource:
    | { type: 'file'; path: string }
    | { type: 'builder'; config: BuilderConfig };
}

export function normalizePluginOptions(
  options: Partial<SodaGqlPluginOptions>
): Result<NormalizedOptions, PluginError>;
```

**Extracts from**:
- `packages/plugin-babel/src/options.ts:1` - Option defaults and validation
- Artifact source discriminated union handling

#### 1.2 State Management (`src/state.ts`)
```typescript
export interface PluginState {
  artifact: BuilderArtifact;
  options: NormalizedOptions;
  diagnostics: DiagnosticCollector;
}

export function prepareArtifactState(
  options: NormalizedOptions
): Result<PluginState, PluginError>;
```

**Extracts from**:
- `packages/plugin-babel/src/state.ts:1` - Artifact loading (file/builder)
- Error mapping to `PluginError` variants

#### 1.3 Cache Layer (`src/cache.ts`)
```typescript
export class PluginCache {
  private artifactHash: string;
  private builderService?: BuilderService;

  // Memoize artifact by config hash
  async getOrLoadArtifact(
    options: NormalizedOptions
  ): Result<BuilderArtifact, PluginError>;

  // Invalidate on file changes
  invalidate(changedFiles: string[]): void;
}
```

**Features**:
- Hash-based artifact caching
- Singleton `BuilderService` per plugin instance
- Watch mode invalidation

#### 1.4 Transform Abstraction (`src/transform/index.ts`)
```typescript
export interface TransformContext {
  artifact: BuilderArtifact;
  options: NormalizedOptions;
  filePath: string;
  source: string;
}

export interface TransformResult {
  code: string;
  map?: SourceMap;
  diagnostics: Diagnostic[];
}

// AST-agnostic transformer interface
export interface Transformer {
  transform(context: TransformContext): Result<TransformResult, PluginError>;
}
```

**Extracts from**:
- Runtime call builders from `packages/plugin-babel/src/transform/runtime-builders.ts:1`
- Common transformation logic

#### 1.5 Error Handling (`src/errors.ts`)
```typescript
export type PluginError =
  | { type: 'InvalidOptions'; details: string }
  | { type: 'ArtifactLoadFailed'; path: string; cause: Error }
  | { type: 'BuilderFailed'; config: BuilderConfig; cause: Error }
  | { type: 'TransformFailed'; filePath: string; cause: Error };
```

**Uses**:
- neverthrow `Result` types throughout
- Explicit error variants for observability

---

## Phase 2: Vite Plugin

### Package: `packages/plugin-vite`

#### 2.1 Plugin Factory (`src/index.ts`)
```typescript
import type { Plugin as VitePlugin } from 'vite';
import { prepareArtifactState, PluginCache } from '@soda-gql/plugin-shared';

export function sodaGqlVitePlugin(
  options: SodaGqlPluginOptions
): VitePlugin {
  const cache = new PluginCache();
  let state: PluginState;

  return {
    name: 'soda-gql',

    async configResolved(config) {
      // Normalize options and prepare state
      const result = await prepareArtifactState(
        normalizePluginOptions(options)
      );
      state = result._unsafeUnwrap(); // or handle error
    },

    async transform(code, id) {
      // See 2.2
    },

    async handleHotUpdate({ file, server }) {
      // See 2.3
    },

    configureServer(server) {
      // See 2.4
    }
  };
}
```

#### 2.2 Transform Hook (`src/transform.ts`)
```typescript
async transform(code: string, id: string) {
  // Filter supported extensions
  if (!/\.(ts|tsx|js|jsx)$/.test(id)) return null;

  // Use Babel with plugin-babel via shared state
  const result = await transformAsync(code, {
    filename: id,
    plugins: [
      ['@soda-gql/plugin-babel', {
        ...state.options,
        artifact: state.artifact
      }]
    ],
    sourceMaps: true
  });

  // Collect diagnostics
  if (state.diagnostics.hasErrors) {
    // Surface via Vite error overlay
  }

  return {
    code: result.code,
    map: result.map
  };
}
```

#### 2.3 HMR Support (`src/watch.ts`)
```typescript
async handleHotUpdate({ file, server }) {
  // Invalidate cache for changed files
  cache.invalidate([file]);

  // Trigger builder update if in builder mode
  if (state.builderService) {
    await state.builderService.update([file]);
  }

  // Re-transform affected modules
  const modules = server.moduleGraph.getModulesByFile(file);
  return modules ? Array.from(modules) : undefined;
}
```

#### 2.4 Dev Server Integration (`src/plugin.ts`)
```typescript
configureServer(server) {
  if (state.options.diagnostics === 'json') {
    // Add middleware for diagnostic overlay
    server.middlewares.use((req, res, next) => {
      if (req.url === '/__soda-gql-diagnostics') {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(state.diagnostics.toJSON()));
        return;
      }
      next();
    });
  }
}
```

#### 2.5 File Structure
```
packages/plugin-vite/
├── src/
│   ├── index.ts          # Plugin factory
│   ├── plugin.ts         # Vite hooks implementation
│   ├── transform.ts      # Babel transform wrapper
│   └── watch.ts          # HMR and cache invalidation
├── tests/
│   ├── fixtures/
│   │   └── vite-app/     # Test Vite project
│   └── integration/
│       └── vite-plugin.test.ts
├── package.json
└── tsconfig.json
```

---

## Phase 3: Metro Transformer

### Package: `packages/plugin-metro`

#### 3.1 Transformer Factory (`src/index.ts`)
```typescript
import type { BabelTransformer } from 'metro-babel-transformer';
import { prepareArtifactState } from '@soda-gql/plugin-shared';

export function createSodaGqlMetroTransformer(
  options: SodaGqlPluginOptions
): BabelTransformer {
  let state: PluginState;

  return {
    async transform({ src, filename, options: metroOptions }) {
      // Lazy initialize state
      if (!state) {
        const result = await prepareArtifactState(
          normalizePluginOptions(options)
        );
        state = result._unsafeUnwrap();
      }

      // Inject soda-gql plugin into Metro's Babel config
      const plugins = [
        ...(metroOptions.plugins || []),
        ['@soda-gql/plugin-babel', {
          ...state.options,
          artifact: state.artifact
        }]
      ];

      return upstream.transform({
        src,
        filename,
        options: { ...metroOptions, plugins }
      });
    },

    getCacheKey() {
      // Include artifact hash in cache key
      return `soda-gql:${state.artifactHash}`;
    }
  };
}
```

#### 3.2 Metro Config Integration (`src/metro-transformer.ts`)
```typescript
// metro.config.js usage
const { createSodaGqlMetroTransformer } = require('@soda-gql/plugin-metro');

module.exports = {
  transformer: {
    babelTransformerPath: createSodaGqlMetroTransformer({
      mode: 'runtime',
      artifactSource: {
        type: 'builder',
        config: { /* ... */ }
      }
    })
  }
};
```

#### 3.3 Watch Mode (`src/watch.ts`)
```typescript
export function enableMetroWatch(
  metroServer: MetroServer,
  state: PluginState
) {
  metroServer.addFileChangeListener((change) => {
    if (change.type === 'change' || change.type === 'delete') {
      // Invalidate and update builder
      state.cache.invalidate([change.filePath]);
      state.builderService?.update([change.filePath]);
    }
  });
}
```

#### 3.4 File Structure
```
packages/plugin-metro/
├── src/
│   ├── index.ts              # Transformer factory
│   ├── metro-transformer.ts  # Metro-specific adapter
│   ├── cache-key.ts          # Cache key generation
│   └── watch.ts              # File change handling
├── tests/
│   ├── fixtures/
│   │   └── rn-app/           # React Native test app
│   └── integration/
│       └── metro-transformer.test.ts
├── package.json
└── tsconfig.json
```

---

## Phase 4: NestJS Plugin

### Package: `packages/plugin-nestjs`

#### 4.1 Plugin Factory (`src/index.ts`)
```typescript
import type { Configuration as WebpackConfig } from 'webpack';
import { prepareArtifactState } from '@soda-gql/plugin-shared';

export function sodaGqlNestPlugin(
  options: SodaGqlPluginOptions
) {
  return {
    name: 'soda-gql-nest',

    // Webpack config augmentation
    async configureWebpack(config: WebpackConfig) {
      const state = await prepareArtifactState(
        normalizePluginOptions(options)
      )._unsafeUnwrap();

      config.module.rules.push({
        test: /\.(ts|tsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            plugins: [
              ['@soda-gql/plugin-babel', {
                ...state.options,
                artifact: state.artifact
              }]
            ]
          }
        }
      });

      return config;
    }
  };
}
```

#### 4.2 CLI Integration (`src/prebuild.ts`)
```typescript
import { BuilderService } from '@soda-gql/builder';

export async function runPrebuildStep(
  config: BuilderConfig
): Promise<void> {
  const service = await BuilderService.create(config);
  await service.build();
  await service.writeArtifacts();
}

// Usage in nest-cli.json
{
  "compilerOptions": {
    "beforeBuild": ["node scripts/soda-gql-prebuild.js"]
  }
}
```

#### 4.3 Watch Mode (`src/webpack-plugin.ts`)
```typescript
import type { Compiler } from 'webpack';

export class SodaGqlNestWebpackPlugin {
  constructor(private state: PluginState) {}

  apply(compiler: Compiler) {
    compiler.hooks.watchRun.tapAsync(
      'SodaGqlNestPlugin',
      async (compilation, callback) => {
        const changedFiles = Array.from(
          compilation.modifiedFiles || []
        );

        await this.state.builderService?.update(changedFiles);
        this.state.cache.invalidate(changedFiles);

        callback();
      }
    );
  }
}
```

#### 4.4 Runtime Module (`src/runtime-module.ts`)
```typescript
import { DynamicModule, Module } from '@nestjs/common';
import type { BuilderArtifact } from '@soda-gql/builder';

@Module({})
export class GraphqlSystemModule {
  static forRoot(artifact: BuilderArtifact): DynamicModule {
    return {
      module: GraphqlSystemModule,
      providers: [
        {
          provide: 'GRAPHQL_ARTIFACT',
          useValue: artifact
        }
      ],
      exports: ['GRAPHQL_ARTIFACT']
    };
  }
}
```

#### 4.5 File Structure
```
packages/plugin-nestjs/
├── src/
│   ├── index.ts             # Plugin factory
│   ├── webpack-plugin.ts    # Webpack integration
│   ├── prebuild.ts          # CLI prebuild step
│   └── runtime-module.ts    # NestJS module
├── tests/
│   ├── fixtures/
│   │   └── nest-app/        # Minimal NestJS app
│   └── integration/
│       └── nest-plugin.test.ts
├── package.json
└── tsconfig.json
```

---

## Integration with Builder System

### Shared Integration Points

All plugins integrate with the builder system through:

1. **BuilderService Creation**
   ```typescript
   const service = await BuilderService.create(config);
   ```
   - Singleton per plugin instance
   - Cached across file transformations

2. **Artifact Hashing**
   ```typescript
   const hash = computeArtifactHash(artifact);
   if (hash === lastHash) {
     // Skip rebuild
     return cachedArtifact;
   }
   ```

3. **Watch Mode Updates**
   ```typescript
   await builderService.update(changedFiles);
   ```
   - Incremental rebuilds
   - Cache invalidation

4. **Canonical ID Consistency**
   - Reuse `collectGqlDefinitionMetadata` from `@soda-gql/builder`
   - Ensure AST adapters feed identical scope events

5. **Diagnostics Export**
   - Console mode: `console.warn(diagnostic)`
   - JSON mode: Write to `.soda-gql/diagnostics.json`
   - Plugin-specific overlays (Vite, Metro, Webpack)

---

## Testing Strategy

### Unit Tests

**Location**: `tests/unit/plugin-{vite,metro,nestjs}/`

**Coverage**:
- Option normalization edge cases
- Artifact loader error scenarios
- Cache key generation
- Runtime call builder output

**Example**:
```typescript
// tests/unit/plugin-vite/options.test.ts
describe('normalizePluginOptions', () => {
  it('should set default mode to runtime', () => {
    const result = normalizePluginOptions({});
    expect(result._unsafeUnwrap().mode).toBe('runtime');
  });

  it('should reject invalid artifact source', () => {
    const result = normalizePluginOptions({
      artifactSource: { type: 'builder' } // missing config
    });
    expect(result.isErr()).toBe(true);
  });
});
```

### Integration Tests

**Location**: `tests/integration/plugin-{vite,metro,nestjs}/`

**Coverage**:
- Full build pipeline execution
- Sourcemap generation
- HMR/watch mode behavior
- Error propagation

#### Vite Integration Test
```typescript
// tests/integration/plugin-vite/build.test.ts
describe('plugin-vite integration', () => {
  it('should transform gql calls in Vite build', async () => {
    const fixture = path.join(__dirname, '../fixtures/vite-app');

    // Run Vite build
    await build({
      root: fixture,
      plugins: [
        sodaGqlVitePlugin({
          mode: 'runtime',
          artifactSource: {
            type: 'file',
            path: path.join(fixture, 'artifact.json')
          }
        })
      ]
    });

    // Verify output
    const output = await fs.readFile(
      path.join(fixture, 'dist/index.js'),
      'utf-8'
    );
    expect(output).toContain('gqlRuntime.operation');
    expect(output).not.toContain('gql.query'); // Original removed
  });
});
```

#### Metro Integration Test
```typescript
// tests/integration/plugin-metro/transform.test.ts
describe('plugin-metro integration', () => {
  it('should transform with Metro bundler', async () => {
    const transformer = createSodaGqlMetroTransformer({
      mode: 'runtime',
      artifactSource: { /* ... */ }
    });

    const result = await transformer.transform({
      src: 'export const query = gql.query(...)',
      filename: 'App.tsx',
      options: {}
    });

    expect(result.ast).toBeDefined();
    expect(result.code).toContain('gqlRuntime.operation');
  });
});
```

#### NestJS Integration Test
```typescript
// tests/integration/plugin-nestjs/build.test.ts
describe('plugin-nestjs integration', () => {
  it('should compile Nest app with plugin', async () => {
    const fixture = path.join(__dirname, '../fixtures/nest-app');

    // Run Nest build
    await runPrebuildStep(builderConfig);
    execSync('nest build', { cwd: fixture });

    // Import and execute
    const { bootstrap } = await import(
      path.join(fixture, 'dist/main.js')
    );
    const app = await bootstrap();

    // Verify operations registered
    const artifact = app.get('GRAPHQL_ARTIFACT');
    expect(artifact.operations).toHaveLength(1);
  });
});
```

### Watch Mode Tests

**Coverage**:
- File change detection
- `BuilderService.update()` invocation
- Cache hit/miss behavior

```typescript
// tests/integration/plugin-vite/watch.test.ts
describe('plugin-vite watch mode', () => {
  it('should invalidate cache on file change', async () => {
    const server = await createServer({
      plugins: [sodaGqlVitePlugin(options)]
    });

    // Track BuilderService.update calls
    const updateSpy = vi.spyOn(builderService, 'update');

    // Modify file
    await fs.writeFile(
      path.join(fixture, 'src/query.ts'),
      'export const newQuery = gql.query(...)'
    );

    // Trigger HMR
    await server.moduleGraph.invalidateModule(/* ... */);

    expect(updateSpy).toHaveBeenCalledWith([
      expect.stringContaining('query.ts')
    ]);
  });
});
```

### Fixture-Based Testing

**Principle**: Store test code as `.ts` fixture files, not inline strings

**Example Structure**:
```
tests/fixtures/
├── vite-app/
│   ├── src/
│   │   ├── query.ts         # gql.query usage
│   │   ├── mutation.ts      # gql.mutation usage
│   │   └── index.ts
│   ├── vite.config.ts
│   ├── artifact.json
│   └── package.json
├── rn-app/
│   ├── src/
│   │   └── App.tsx
│   ├── metro.config.js
│   └── package.json
└── nest-app/
    ├── src/
    │   ├── app.module.ts
    │   └── main.ts
    ├── nest-cli.json
    └── package.json
```

---

## Implementation Phases

### Phase 1: Foundation (Week 1-2)

**Tasks**:
1. Extract shared abstractions into `packages/plugin-shared`
   - [ ] Options normalization
   - [ ] State management
   - [ ] Cache layer
   - [ ] Error types
   - [ ] Transform interface

2. Refactor `plugin-babel` to use shared layer
   - [ ] Replace local options/state with shared imports
   - [ ] Validate existing tests remain green
   - [ ] Update documentation

3. Validation
   - [ ] All `plugin-babel` tests pass
   - [ ] No regressions in transform output
   - [ ] Shared package has 100% unit test coverage

### Phase 2: Vite Plugin (Week 3-4)

**Tasks**:
1. Implement `packages/plugin-vite`
   - [ ] Plugin factory
   - [ ] Transform hook
   - [ ] HMR support
   - [ ] Dev server integration

2. Testing
   - [ ] Unit tests for Vite-specific logic
   - [ ] Integration test with Vite build
   - [ ] Watch mode regression tests

3. Documentation
   - [ ] Usage guide in `docs/guides/plugin-vite.md`
   - [ ] API reference

### Phase 3: Metro & NestJS (Week 5-6)

**Tasks**:
1. Implement `packages/plugin-metro`
   - [ ] Transformer factory
   - [ ] Cache key integration
   - [ ] Watch mode support

2. Implement `packages/plugin-nestjs`
   - [ ] Webpack plugin
   - [ ] CLI prebuild integration
   - [ ] Runtime module

3. Cross-plugin validation
   - [ ] All three plugins produce identical transforms
   - [ ] Artifact caching works across plugins
   - [ ] Diagnostics format consistency

### Phase 4: Documentation & Release (Week 7)

**Tasks**:
1. Documentation
   - [ ] Update main README with plugin comparison
   - [ ] Migration guides from Babel to Vite/Metro/Nest
   - [ ] Troubleshooting guide

2. Release preparation
   - [ ] Version alignment (all plugins at v0.1.0)
   - [ ] Changelog entries
   - [ ] Package metadata (keywords, descriptions)

---

## Success Criteria

### Functional Requirements
- ✅ All three plugins transform `gql.*` calls identically to `plugin-babel`
- ✅ Watch mode triggers `BuilderService.update()` on file changes
- ✅ Diagnostics surface correctly in each environment (console/overlay/JSON)
- ✅ Sourcemaps generated and aligned with host bundler

### Performance Requirements
- ✅ Artifact caching prevents redundant builder invocations
- ✅ Transform overhead < 50ms per file (measured with Vite HMR)
- ✅ Cold start time < 500ms (builder initialization)

### Quality Requirements
- ✅ Test coverage > 90% for shared package
- ✅ Test coverage > 80% for plugin packages
- ✅ Zero `any` types without suppression comments
- ✅ All error paths return `Result` types (no `throw`)

---

## Future Enhancements

### SWC Support (Post-v0.1.0)
- Replace Babel with SWC for NestJS when using `@nestjs/cli` SWC builder
- Implement SWC plugin equivalent to `plugin-babel`
- Benchmark performance improvements

### Webpack Plugin (Independent)
- Direct webpack plugin (not NestJS-specific)
- Loader vs plugin architecture decision
- Integration with webpack's persistent caching

### Esbuild Plugin
- Native esbuild transform (Go plugin or JS wrapper)
- Performance comparison with Vite (which uses esbuild internally)

---

## References

### Implementation Guides
- [Vite Plugin API](https://vitejs.dev/guide/api-plugin.html)
- [Metro Transformer API](https://facebook.github.io/metro/docs/configuration#transformer)
- [NestJS CLI Plugins](https://docs.nestjs.com/cli/plugins)

### Internal References
- `packages/plugin-babel/src/plugin.ts:12` - Babel plugin lifecycle
- `packages/builder/src/service.ts:1` - BuilderService API
- `tests/contract/plugin-babel/plugin_babel.test.ts:75` - Transform contract tests

### Related Decisions
- [CLAUDE.md](../../CLAUDE.md) - Project conventions and AI-assisted development workflow

---

## Changelog

| Date | Author | Changes |
|------|--------|---------|
| 2025-10-05 | Codex Analysis + Claude | Initial plan based on plugin-babel analysis |

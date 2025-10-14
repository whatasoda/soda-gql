# Plugin Implementation Improvements

## Overview

このドキュメントは、現在のプラグイン実装に対する改善提案をまとめています。各提案は優先度（P0/P1/P2）と影響範囲（パフォーマンス/保守性/型安全性/信頼性）で分類されています。

---

## Critical Issues (P0)

### 1. Global DevManager Singleton の問題

**場所**: `packages/plugin-babel/src/dev/manager.ts:144-151`

**問題**:
```typescript
let globalManager: DevManager | null = null;

export const getDevManager = (): DevManager => {
  if (!globalManager) {
    globalManager = createDevManager();
  }
  return globalManager;
};
```

**影響**:
- **マルチプロジェクト環境で競合**: 複数の異なるプロジェクトが同じNode.jsプロセスで実行される場合（例: monorepo、test環境）、同一のDevManagerインスタンスを共有してしまう
- **状態汚染**: プロジェクトAのartifactがプロジェクトBに混入する可能性
- **テストの独立性欠如**: テスト間で状態が持ち越される

**改善案**:
```typescript
// Context-based manager registry
const managerRegistry = new Map<string, DevManager>();

export const getDevManager = (contextKey: string): DevManager => {
  let manager = managerRegistry.get(contextKey);
  if (!manager) {
    manager = createDevManager();
    managerRegistry.set(contextKey, manager);
  }
  return manager;
};

export const clearDevManager = (contextKey?: string): void => {
  if (contextKey) {
    const manager = managerRegistry.get(contextKey);
    if (manager) {
      manager.dispose();
      managerRegistry.delete(contextKey);
    }
  } else {
    for (const manager of managerRegistry.values()) {
      manager.dispose();
    }
    managerRegistry.clear();
  }
};
```

**代替案**: プロジェクトのconfigPathやrootDirをキーとして使用

---

### 2. BuilderArtifactProvider のキャッシュ戦略の問題

**場所**: `packages/plugin-shared/src/artifact/builder-provider.ts:24-42`

**問題**:
```typescript
async load(): Promise<Result<BuilderArtifact, PluginError>> {
  // Return cached artifact if available
  if (this.artifactCache) {
    return ok(this.artifactCache);
  }
  // ... build
}
```

**影響**:
- **キャッシュ無効化タイミングが不明瞭**: `invalidate()`が呼ばれない限り古いartifactを返し続ける
- **incremental buildとの不整合**: BuilderServiceがupdateを実行してもproviderのキャッシュは更新されない
- **watch modeでの同期問題**: ファイル変更後もキャッシュが残る

**改善案**:
```typescript
export class BuilderArtifactProvider implements ArtifactProvider {
  private lastBuildGeneration = 0;

  async load(options?: { force?: boolean }): Promise<Result<BuilderArtifact, PluginError>> {
    // Check if service has newer artifact
    const serviceGeneration = this.service.getGeneration?.() ?? 0;

    if (options?.force || !this.artifactCache || serviceGeneration > this.lastBuildGeneration) {
      const buildResult = await this.service.build();
      // ... handle result
      this.lastBuildGeneration = serviceGeneration;
      this.artifactCache = buildResult.value;
    }

    return ok(this.artifactCache);
  }
}
```

**推奨**: BuilderServiceにgeneration tracking機能を追加

---

### 3. StateStore の Error State 管理の不整合

**場所**: `packages/plugin-babel/src/dev/state-store.ts:66-69`

**問題**:
```typescript
setError(error) {
  _lastError = error;
  notify();
}
```

**影響**:
- **エラーが`getSnapshot()`で取得できない**: `_lastError`はprivateで外部から参照不可
- **エラー状態とPlugin状態の不一致**: `currentState`は有効なまま、`_lastError`だけ設定される
- **リスナーがエラーを検知できない**: エラーがあっても`getSnapshot()`は前回の成功状態を返す

**改善案**:
```typescript
export type StateStore = {
  initialize(options: NormalizedOptions, artifact: BuilderArtifact): void;
  getSnapshot(): PluginState | null;
  getError(): Error | null;
  hasError(): boolean;
  // ...
};

export const createStateStore = (): StateStore => {
  let currentState: PluginState | null = null;
  let currentError: Error | null = null;

  return {
    // ...
    getSnapshot() {
      if (currentError) {
        return null;
      }
      if (!currentState) {
        throw new Error("StateStore not initialized");
      }
      return currentState;
    },

    getError() {
      return currentError;
    },

    hasError() {
      return currentError !== null;
    },

    setError(error) {
      currentError = error;
      // Don't clear currentState - allow recovery
      notify();
    },

    updateArtifact(artifact) {
      // ... update
      currentError = null; // Clear error on success
      notify();
    },
  };
};
```

---

## High Priority Issues (P1)

### 4. Module-Level Cache の管理不足

**場所**:
- `packages/plugin-nestjs/webpack/plugin.ts:23`
- `packages/plugin-nestjs/webpack/loader.ts:17`

**問題**:
```typescript
const runtimeCache = new Map<string, Promise<PluginRuntime>>();
```

**影響**:
- **メモリリーク**: キャッシュが永続的に保持され、クリアする手段がない
- **テストの汚染**: テスト実行後もキャッシュが残る
- **動的な設定変更に対応できない**: 同じkeyでも設定が変わる場合に古いruntimeを返す

**改善案**:
```typescript
// Export cache control functions
export const clearRuntimeCache = (key?: string): void => {
  if (key) {
    const promise = runtimeCache.get(key);
    if (promise) {
      promise.then(runtime => runtime.dispose()).catch(() => {});
      runtimeCache.delete(key);
    }
  } else {
    for (const promise of runtimeCache.values()) {
      promise.then(runtime => runtime.dispose()).catch(() => {});
    }
    runtimeCache.clear();
  }
};

// Add to plugin cleanup hooks
compiler.hooks.watchClose.tap(PLUGIN_NAME, () => {
  clearRuntimeCache();
});
```

**追加**: Cache size limitとLRU eviction戦略の実装

---

### 5. Webpack Hooks での Error Handling の欠如

**場所**: `packages/plugin-nestjs/src/webpack/plugin.ts:275-330`

**問題**:
```typescript
run: async () => {
  try {
    // ... operations
  } catch (error) {
    // Errors are already recorded in diagnostics
    if (error instanceof Error) {
      logger.error(error.message);
    }
  }
}
```

**影響**:
- **エラーが無視される**: `bailOnError: false`の場合、エラーをログ出力するだけで処理を続行
- **部分的な失敗状態**: artifactのbuildは失敗したが、loaderは古いartifactで動作
- **ユーザーへの通知不足**: コンソールログのみで、compilation.errorsに追加されない場合もある

**改善案**:
```typescript
run: async () => {
  try {
    const runtime = await runtimePromise;
    if (builderController) {
      await runInitialBuild();
    } else {
      invalidateArtifactCache(options.artifactPath);
      await reportArtifactFromFile();
      await refreshRuntimeOrReport(runtime);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(errorMessage);

    // Always add to compilation errors for visibility
    compiler.hooks.thisCompilation.tap(PLUGIN_NAME, (compilation) => {
      compilation.errors.push(
        new Error(`[${PLUGIN_NAME}] Build failed: ${errorMessage}`)
      );
    });

    // Re-throw if bailOnError
    if (options.bailOnError) {
      throw error;
    }
  }
}
```

---

### 6. DevManager の Initialization Race Condition

**場所**: `packages/plugin-babel/src/dev/manager.ts:44-118`

**問題**:
```typescript
async ensureInitialized(params) {
  if (initialized) {
    return;
  }
  // ... async initialization
  initialized = true;
}
```

**影響**:
- **並行呼び出しで複数回初期化**: `initialized`フラグチェックと設定の間にasync operationがあるため、複数のcallerが同時に初期化を開始する可能性
- **リソースの多重確保**: 複数のbuilder serviceやwatcherが作成される
- **メモリリーク**: 古いインスタンスがdisposeされずに残る

**改善案**:
```typescript
export const createDevManager = (deps: DevManagerDependencies = {}): DevManager => {
  // ... existing code
  let initializationPromise: Promise<void> | null = null;

  return {
    async ensureInitialized(params) {
      // Return existing initialization if in progress
      if (initializationPromise) {
        return initializationPromise;
      }

      if (initialized) {
        return Promise.resolve();
      }

      // Create initialization promise
      initializationPromise = (async () => {
        try {
          // ... initialization logic
          initialized = true;
        } catch (error) {
          // Clean up on failure
          initializationPromise = null;
          throw error;
        }
      })();

      return initializationPromise;
    },
    // ...
  };
};
```

---

## Medium Priority Issues (P2)

### 7. Artifact Cache の mtime 精度の問題

**場所**: `packages/plugin-shared/src/cache.ts:91-96`

**問題**:
```typescript
const mtimeDiff = Math.abs(stats.mtime.getTime() - cached.mtimeMs);
if (mtimeDiff <= 2) {
  // Cache hit
}
```

**影響**:
- **マジックナンバー**: 2msの根拠が不明瞭
- **ファイルシステム依存**: 異なるFSでは異なる精度が必要な場合がある
- **高速なファイル更新の検出漏れ**: 2ms以内の連続更新を検出できない

**改善案**:
```typescript
// Add configurable tolerance
export interface LoadArtifactOptions {
  schemaHash?: string;
  mtimeTolerance?: number; // Default to 2ms for backwards compatibility
}

export const loadArtifact = async (
  path: string,
  options: LoadArtifactOptions = {},
): Promise<Result<BuilderArtifact, ArtifactError>> => {
  const mtimeTolerance = options.mtimeTolerance ?? 2;
  // ...
  const mtimeDiff = Math.abs(stats.mtime.getTime() - cached.mtimeMs);
  if (mtimeDiff <= mtimeTolerance) {
    return ok(cached.artifact);
  }
  // ...
};
```

---

### 8. PluginRuntime の Dispose 時のリソースリーク

**場所**: `packages/plugin-shared/src/runtime.ts:88-92`

**問題**:
```typescript
dispose: () => {
  cache.state = null;
  cache.initError = null;
}
```

**影響**:
- **ArtifactProvider が dispose されない**: `cache.provider` がクリアされず、内部リソース（BuilderService, watchers）が残る
- **メモリリーク**: 特にbuilder modeで大量のリソースが保持される
- **File handles**: Watcherがファイルハンドルを保持し続ける

**改善案**:
```typescript
dispose: () => {
  // Dispose provider first
  if (cache.provider && typeof cache.provider.dispose === 'function') {
    cache.provider.dispose();
  }

  cache.state = null;
  cache.initError = null;
  cache.provider = null as unknown as ArtifactProvider; // Type workaround
}

// Add dispose to ArtifactProvider interface
export interface ArtifactProvider {
  // ... existing methods
  dispose?(): void;
}

// Implement in BuilderArtifactProvider
export class BuilderArtifactProvider implements ArtifactProvider {
  // ... existing code

  dispose(): void {
    this.artifactCache = null;
    // Dispose builder service if it has cleanup
    if (typeof this.service.dispose === 'function') {
      this.service.dispose();
    }
  }
}
```

---

### 9. Options Validation の重複

**場所**: `packages/plugin-shared/src/options.ts` と `packages/plugin-nestjs/src/schemas/webpack.ts`

**問題**:
- plugin-sharedとplugin-nestjsで類似のvalidationを実装
- 検証ロジックが分散し、不整合が発生しやすい
- Zodスキーマとmanual validationの重複

**改善案**:
```typescript
// plugin-shared/src/schemas/plugin-options.ts
import { z } from "zod";

export const pluginOptionsSchema = z.object({
  mode: z.enum(["runtime", "zero-runtime"]).default("runtime"),
  importIdentifier: z.string().default("@/graphql-system"),
  diagnostics: z.enum(["json", "console"]).default("json"),
  configPath: z.string().optional(),
  artifact: z.object({
    useBuilder: z.boolean().default(true),
    path: z.string().optional(),
  }).optional(),
  dev: z.object({
    hmr: z.boolean().optional(),
  }).optional(),
});

export type PluginOptionsInput = z.input<typeof pluginOptionsSchema>;
export type PluginOptions = z.output<typeof pluginOptionsSchema>;

// Use in normalizePluginOptions
export const normalizePluginOptions = async (
  raw: PluginOptionsInput
): Promise<Result<NormalizedOptions, OptionsError>> => {
  const parseResult = pluginOptionsSchema.safeParse(raw);
  if (!parseResult.success) {
    return err({
      type: "OptionsError",
      code: "INVALID_OPTIONS",
      message: parseResult.error.message,
    });
  }

  const validated = parseResult.data;
  // ... rest of normalization
};
```

---

### 10. Webpack Loader の Source Map チェーンの問題

**場所**: `packages/plugin-nestjs/webpack/loader.ts:186-190`

**問題**:
```typescript
if (babelResult && transformed) {
  resultCode = babelResult.code ?? sourceCode;
  const mapValue = babelResult.map ?? (generateSourceMaps ? inputSourceMap : undefined);
  resultMap = typeof mapValue === "string" ? JSON.parse(mapValue) : mapValue;
}
```

**影響**:
- **Source map chain が壊れる**: inputSourceMapがあってもBabelの出力に含まれない場合、前段のmappingが失われる
- **デバッグ困難**: 元のTypeScriptソースへのマッピングが不正確
- **エラー報告の位置がずれる**: スタックトレースが変換後のコードを指す

**改善案**:
```typescript
import { SourceMapGenerator, SourceMapConsumer } from "source-map";

const babelOptions: TransformOptions = {
  // ... existing options
  inputSourceMap: inputSourceMap as any,
  sourceMaps: generateSourceMaps,
};

const babelResult = await transformAsync(sourceCode, babelOptions);

if (babelResult && transformed) {
  resultCode = babelResult.code ?? sourceCode;

  // Merge source maps if both input and output exist
  if (generateSourceMaps && inputSourceMap && babelResult.map) {
    try {
      const consumer = await new SourceMapConsumer(babelResult.map);
      const generator = SourceMapGenerator.fromSourceMap(consumer);

      if (typeof inputSourceMap === 'object') {
        const inputConsumer = await new SourceMapConsumer(inputSourceMap);
        generator.applySourceMap(inputConsumer);
      }

      resultMap = JSON.parse(generator.toString());
    } catch {
      // Fallback to babel map
      resultMap = babelResult.map;
    }
  } else {
    resultMap = babelResult.map ?? (generateSourceMaps ? inputSourceMap : undefined);
  }
}
```

---

## Architectural Improvements

### 11. TransformAdapter の拡張性の向上

**現在の制約**:
- `TransformAdapter.transformProgram()` が全fileを一度にtraverseすることを前提
- Incremental transformationをサポートしていない
- Multi-threaded transformに対応していない

**改善案**:
```typescript
export interface TransformAdapter {
  // ... existing methods

  /**
   * Transform a specific node instead of entire program
   * Useful for incremental updates and fine-grained control
   */
  transformNode?(
    context: TransformProgramContext,
    node: unknown,
    metadata: DefinitionMetadata
  ): TransformPassResult;

  /**
   * Check if this file needs transformation
   * Allows early bailout for files without GraphQL code
   */
  needsTransform?(context: TransformProgramContext): boolean;

  /**
   * Get serializable state for cross-thread communication
   * Enables parallel processing in worker threads
   */
  serialize?(): unknown;

  /**
   * Restore adapter from serialized state
   */
  static deserialize?(state: unknown): TransformAdapter;
}
```

---

### 12. Diagnostics の構造化

**現状**: Diagnosticsがwebpack pluginに限定され、Babel pluginから利用できない

**改善案**:
```typescript
// packages/plugin-shared/src/diagnostics/index.ts
export interface DiagnosticsCollector {
  recordError(error: PluginError): void;
  recordWarning(warning: PluginWarning): void;
  recordSuccess(artifact: BuilderArtifact): void;
  getReport(): DiagnosticsReport;
  clear(): void;
}

export interface DiagnosticsReport {
  readonly status: "success" | "warning" | "error";
  readonly errors: ReadonlyArray<FormattedError>;
  readonly warnings: ReadonlyArray<FormattedWarning>;
  readonly summary: {
    readonly schemaHash: string;
    readonly elementCount: number;
    readonly timestamp: number;
  };
}

// Use in both babel plugin and webpack plugin
export const createDiagnosticsCollector = (): DiagnosticsCollector => {
  // ... implementation
};
```

---

### 13. Builder Service との結合度削減

**現状**: Plugin層がBuilderServiceの実装詳細に依存

**改善案**:
```typescript
// Define abstract interface in plugin-shared
export interface ArtifactBuilderService {
  build(): Promise<Result<BuilderArtifact, BuilderError>>;
  update?(changeSet: unknown): Promise<Result<BuilderArtifact, BuilderError>>;
  getGeneration?(): number;
  dispose?(): void;
}

// BuilderArtifactProvider accepts the interface
export class BuilderArtifactProvider implements ArtifactProvider {
  constructor(
    private context: ProviderContext,
    private serviceFactory: (config: BuilderServiceConfig) => ArtifactBuilderService
  ) {
    // ...
  }
}

// This allows alternative builder implementations for testing or optimization
```

---

## Testing Improvements

### 14. Plugin Testing のサポート不足

**推奨する追加**:
```typescript
// packages/plugin-shared/src/testing/index.ts

/**
 * Test utilities for plugin development
 */
export const createMockArtifactProvider = (
  artifact: BuilderArtifact
): ArtifactProvider => ({
  mode: "artifact-file",
  load: async () => ok(artifact),
  invalidate: () => {},
  getArtifactById: (id) => artifact.elements[id],
  describe: () => "MockArtifactProvider",
});

export const createTestPluginRuntime = async (
  artifact: BuilderArtifact,
  options: Partial<PluginOptions> = {}
): Promise<PluginRuntime> => {
  // ... implementation
};

export const resetAllCaches = (): void => {
  invalidateArtifactCache();
  clearRuntimeCache();
  clearDevManager();
};
```

---

## Performance Optimizations

### 15. Artifact Loading の並列化

**現状**: 各loaderが独立してartifactをload

**改善案**:
```typescript
// Shared promise deduplication
const artifactLoadPromises = new Map<string, Promise<Result<BuilderArtifact, ArtifactError>>>();

export const loadArtifactWithDedup = async (
  path: string,
  options?: LoadArtifactOptions
): Promise<Result<BuilderArtifact, ArtifactError>> => {
  const key = `${path}:${options?.schemaHash ?? 'default'}`;

  let promise = artifactLoadPromises.get(key);
  if (!promise) {
    promise = loadArtifact(path, options);
    artifactLoadPromises.set(key, promise);

    // Clean up after load completes
    promise.finally(() => {
      artifactLoadPromises.delete(key);
    });
  }

  return promise;
};
```

---

### 16. Metadata Collection の最適化

**現状**: 毎回全ファイルをtraverse

**改善案**:
```typescript
// Cache metadata at program level
const metadataCache = new WeakMap<t.Program, GqlDefinitionMetadataMap>();

export const collectGqlDefinitionMetadata = (params: {
  programPath: NodePath<t.Program>;
  filename: string;
}): GqlDefinitionMetadataMap => {
  const program = params.programPath.node;

  let cached = metadataCache.get(program);
  if (cached) {
    return cached;
  }

  // ... collect metadata
  metadataCache.set(program, metadata);
  return metadata;
};
```

---

## Summary

改善提案の優先順位：

**即座に対応すべき (P0)**:
1. Global DevManager Singleton の修正
2. BuilderArtifactProvider のキャッシュ戦略
3. StateStore のError State管理

**早期対応が望ましい (P1)**:
4. Module-Level Cacheの管理
5. Webpack Hooks のError Handling
6. DevManager の Race Condition

**計画的に対応 (P2)**:
7-16. その他の最適化と改善

これらの改善により、以下の効果が期待できます：
- **信頼性**: Race conditionやメモリリークの解消
- **保守性**: コードの一貫性と可読性の向上
- **パフォーマンス**: キャッシュ戦略の最適化
- **テスタビリティ**: テストユーティリティの提供
- **拡張性**: より柔軟なアーキテクチャ

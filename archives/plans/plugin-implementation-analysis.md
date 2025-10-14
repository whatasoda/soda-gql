# Plugin Implementation Analysis Report

## Overview

soda-gqlのプラグインシステムは3つの主要パッケージで構成されています：

1. **@soda-gql/plugin-shared** - 共通基盤・抽象化レイヤー
2. **@soda-gql/plugin-babel** - Babel用のTransformAdapter実装
3. **@soda-gql/plugin-nestjs** - NestJS/Webpack統合

## 1. Package Roles and Responsibilities

### 1.1 @soda-gql/plugin-shared

**役割**: Library-neutral transformation infrastructure

**主要機能**:
- **TransformAdapter Interface** (`core/transform-adapter.ts:32-68`): AST library非依存の変換インターフェース
- **Intermediate Representation (IR)** (`core/ir.ts`): Library-neutralなGraphQL呼び出しの表現
- **Artifact Provider System** (`artifact/`): Builder artifactの読み込み抽象化
- **Plugin State Management** (`state.ts`): プラグイン状態の準備と管理
- **Dev Mode Support** (`dev/`): HMR/watch modeのサポート

**キーコンポーネント**:
```typescript
// TransformAdapter: AST library非依存のインターフェース
interface TransformAdapter {
  collectDefinitionMetadata(context): DefinitionMetadataMap;
  analyzeCall(context, candidate): GraphQLCallAnalysis | PluginError;
  transformProgram(context): TransformPassResult;
  insertRuntimeSideEffects(context, runtimeIR): void;
}
```

**Artifact Provider Pattern**:
- `BuilderArtifactProvider`: リアルタイムでbuilderを実行
- `FileArtifactProvider`: 事前生成されたartifact fileを読み込み
- Factory pattern (`createArtifactProvider`) で切り替え

**Dev Mode Architecture**:
- `BuilderServiceController`: Builder serviceのライフサイクル管理
- `BuilderWatch`: ファイル変更の追跡とchange setの生成
- Exclusive execution queue で並行実行を制御

### 1.2 @soda-gql/plugin-babel

**役割**: Babel-specific TransformAdapter implementation

**主要機能**:
- **BabelAdapter** (`adapter/adapter.ts:40-222`): TransformAdapterの具象実装
- **Babel Plugin** (`plugin.ts`): 標準的なBabelプラグインエントリーポイント
- **AST Analysis** (`adapter/analysis.ts`): GraphQL builder callの検出と解析
- **Code Transformation** (`adapter/transformer.ts`): AST変換の実行
- **Import Management** (`adapter/imports.ts`): runtime importの注入と未使用importの削除

**変換フロー**:
1. `collectGqlDefinitionMetadata()`: 全GraphQL定義のメタデータを収集
2. `findGqlBuilderCall()`: builder call expressionを検出
3. `extractGqlCall()`: 型付きGqlCall IRへ変換
4. `transformCallExpression()`: AST nodeを変換
5. `buildOperationRuntimeComponents()`: runtime registration callを生成

**特徴**:
- Babel ASTと library-neutral IR の相互変換
- `WeakMap` based metadata tracking (GC-friendly)
- Runtime expression handles (`RuntimeExpression`) で型安全性を保持

### 1.3 @soda-gql/plugin-nestjs

**役割**: NestJS/Webpack integration layer

**主要機能**:
- **SodaGqlWebpackPlugin** (`webpack/plugin.ts:160-362`): Artifactのビルドと管理
- **Webpack Loader** (`webpack/loader.ts`): ファイル単位の変換
- **NestJS Config Helper** (`config/with-soda-gql.ts`): NestJS統合のヘルパー関数
- **Diagnostics** (`internal/diagnostics.ts`): エラーレポート機能
- **Manifest Tracking** (`internal/manifest.ts`): Artifact変更の検出

**アーキテクチャの特徴**:

#### Plugin vs Loader の責務分離

**Plugin (plugin.ts)**:
- Artifact lifecycleの管理 (build/watch/invalidate)
- Builder serviceの初期化と更新
- Diagnosticsの収集と出力
- Artifact fileの永続化
- Runtime cacheの管理

**Loader (loader.ts)**:
- ファイル単位の変換実行
- `BabelAdapter` を使用してAST変換
- Source mapの生成
- Runtime cacheを共有 (module-level cache)

#### Two-Mode Architecture

**Builder Mode** (`artifactSource: { source: "builder" }`):
- `BuilderServiceController` でbuilderを実行
- `BuilderWatch` でincremental build
- HMR/watch mode対応

**Artifact-File Mode** (`artifactSource: { source: "artifact-file" }`):
- 事前生成されたartifact fileを使用
- File watchingでartifact変更を検出
- CI/production環境向け

## 2. Processing Flow and Data Transformations

### 2.1 Zero-Runtime Mode Transformation Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Plugin Initialization (Babel/Webpack)                   │
├─────────────────────────────────────────────────────────────┤
│ preparePluginState()                                        │
│   ├─ normalizePluginOptions()                              │
│   ├─ createArtifactProvider()                              │
│   │   └─ BuilderArtifactProvider / FileArtifactProvider    │
│   └─ load artifact                                          │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Per-File Transformation (Babel Visitor)                 │
├─────────────────────────────────────────────────────────────┤
│ BabelAdapter.transformProgram()                             │
│   ├─ collectGqlDefinitionMetadata()                        │
│   │   └─ Track all gql.* calls with WeakMap                │
│   ├─ Traverse CallExpression nodes                         │
│   │   ├─ findGqlBuilderCall()                              │
│   │   ├─ extractGqlCall() → GqlCall IR                     │
│   │   └─ transformCallExpression()                         │
│   │       ├─ gql.model() → gqlRuntime.model()              │
│   │       ├─ gql.slice() → gqlRuntime.slice()              │
│   │       └─ gql.operation() → gqlRuntime.operation()      │
│   ├─ ensureGqlRuntimeImport()                              │
│   └─ maybeRemoveUnusedGqlImport()                          │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. Runtime Side Effects Insertion                          │
├─────────────────────────────────────────────────────────────┤
│ BabelAdapter.insertRuntimeSideEffects()                     │
│   └─ Insert after @soda-gql/runtime import:                │
│       └─ __registerOperation(prebuild, slicesBuilder)      │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Data Transformation Layers

**Layer 1: Source Code → AST**
```typescript
// Input: source code
const userOp = gql.operation.query({}, ({ $ }) =>
  slice.build({ id: $.String() })
);

// Babel parses to AST (CallExpression nodes)
```

**Layer 2: AST → Library-Neutral IR**
```typescript
// BabelAdapter converts to IR
type GraphQLCallIR = {
  descriptor: RuntimeCallDescriptor;
  sourceFile: string;
};

type RuntimeOperationDescriptor = {
  type: "operation";
  canonicalId: CanonicalId;
  operationName: string;
  prebuildPayload: unknown;
  getSlices: RuntimeExpression; // opaque handle
};
```

**Layer 3: IR → Transformed AST**
```typescript
// Output: transformed code
import { __registerOperation, operation as gqlRuntime_operation }
  from "@soda-gql/runtime";

const userOp = gqlRuntime_operation({ /* prebuild */ },
  ({ $ }) => slice.build({ id: $.String() })
);

__registerOperation({ /* prebuild */ },
  ({ $ }) => slice.build({ id: $.String() })
);
```

### 2.3 Webpack Plugin Flow (NestJS)

```
┌─────────────────────────────────────────────────────────────┐
│ Compiler Hooks (SodaGqlWebpackPlugin)                      │
├─────────────────────────────────────────────────────────────┤
│ run (production build):                                     │
│   ├─ builderController.build()                             │
│   ├─ persistArtifact()                                     │
│   ├─ invalidateArtifactCache()                             │
│   └─ runtime.refresh()                                     │
│                                                             │
│ watchRun (development):                                     │
│   ├─ builderWatch.trackChanges(modified, removed)          │
│   ├─ builderWatch.flush() → BuilderChangeSet               │
│   ├─ builderController.update(changeSet)                   │
│   ├─ Detect manifest changes                               │
│   ├─ persistArtifact() if changed                          │
│   └─ runtime.refresh() if changed                          │
│                                                             │
│ thisCompilation:                                            │
│   ├─ Add artifact as file dependency                       │
│   ├─ Report diagnostics errors                             │
│   └─ Emit diagnostics.json asset                           │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Module Transformation (Webpack Loader)                      │
├─────────────────────────────────────────────────────────────┤
│ For each .ts/.tsx file:                                     │
│   ├─ normalizePluginOptions()                              │
│   ├─ createPluginRuntimeFromNormalized() (cached)          │
│   ├─ Create BabelAdapter                                   │
│   ├─ adapter.transformProgram()                            │
│   ├─ adapter.insertRuntimeSideEffects()                    │
│   └─ Return transformed code + source map                  │
└─────────────────────────────────────────────────────────────┘
```

## 3. Design Characteristics and Architectural Patterns

### 3.1 Library-Neutral Adapter Pattern

**目的**: 将来的にSWC/esbuild/ESTreeなど別のAST libraryへの移行を可能にする

**設計**:
- `TransformAdapter` interfaceで抽象化
- `RuntimeExpression` でadapter-specific ASTノードをカプセル化
- `GraphQLCallIR` でlibrary-neutralな中間表現

**利点**:
- Babel依存をplugin-babelに隔離
- plugin-sharedはAST library非依存
- 新しいadapterの追加が容易

### 3.2 Two-Phase Transformation

**Phase 1: Program Transformation**
- GraphQL builder callsを検出して変換
- Runtime importを注入
- `transformProgram()` で実行

**Phase 2: Runtime Side Effects**
- Operation registration callsを挿入
- `insertRuntimeSideEffects()` で実行
- Import declaration後に挿入

**理由**:
- AST traversalを最小化
- Side effectの挿入タイミングを制御
- Runtime callsをプログラム先頭に配置

### 3.3 Result-Based Error Handling

**パターン**: neverthrowの `Result<T, E>` 型を全域で使用

```typescript
type PluginStateResult = Result<PluginState, PluginError>;
type BuilderServiceResult = Result<BuilderArtifact, BuilderServiceFailure>;
```

**利点**:
- Type-safe error handling
- 例外を投げない (throw-free)
- Error propagationが明示的

### 3.4 Module-Level Caching

**実装箇所**:
- `plugin-nestjs/webpack/plugin.ts:23` - Runtime cache
- `plugin-nestjs/webpack/loader.ts:17` - Runtime cache

**キャッシュキー**:
```typescript
const key = JSON.stringify({
  artifactPath,
  mode,
  configPath
});
```

**理由**:
- Webpack watchモードで同じruntimeを再利用
- `normalizePluginOptions()` の重複実行を回避
- Artifact loadingの最適化

### 3.5 Manifest-Based Change Detection

**仕組み** (`plugin-nestjs/internal/manifest.ts`):
```typescript
type ArtifactManifest = {
  readonly schemaHash: string;
  readonly elementIds: ReadonlyArray<string>;
};

const manifestChanged = (prev, next) => {
  return prev.schemaHash !== next.schemaHash ||
         !setsEqual(prev.elementIds, next.elementIds);
};
```

**目的**:
- Artifact内容の実質的な変更のみを検出
- 不要なファイル書き込みとcache invalidationを回避
- Webpack rebuildのトリガーを最小化

### 3.6 Exclusive Execution Queue

**実装** (`plugin-shared/dev/builder-service-controller.ts:36-43`):
```typescript
const runExclusive = <T>(task: () => Promise<T>): Promise<T> => {
  const next = queue.then(task);
  queue = next.then(() => undefined, () => undefined);
  return next;
};
```

**目的**:
- Builder operationsの並行実行を防止
- build() と update() の順序を保証
- Race conditionの回避

### 3.7 Factory Pattern for Providers

**Artifact Provider Factory** (`plugin-shared/artifact/artifact-provider.ts:55-71`):
```typescript
const createArtifactProvider = (options): ArtifactProvider => {
  switch (options.artifact.type) {
    case "builder":
      return new BuilderArtifactProvider(context);
    case "artifact-file":
      return new FileArtifactProvider(context);
  }
};
```

**利点**:
- 実行環境に応じたprovider選択
- Lazy loading (dynamic require)
- 循環依存の回避

## 4. Integration Points Between Packages

### 4.1 plugin-shared ← plugin-babel

**依存関係**:
```
plugin-babel depends on plugin-shared
```

**Integration**:
- `BabelAdapter implements TransformAdapter`
- Babel AST → IR conversion
- `babelTransformAdapterFactory` をexport

### 4.2 plugin-shared ← plugin-nestjs

**依存関係**:
```
plugin-nestjs depends on plugin-shared and plugin-babel
```

**Integration**:
- `preparePluginState()` を使用してplugin状態を準備
- `createBuilderServiceController()` でbuilderを管理
- `createBuilderWatch()` でfile watchingを実装
- `formatPluginError()` でエラーフォーマット

### 4.3 plugin-babel ← plugin-nestjs

**依存関係**:
```
plugin-nestjs uses plugin-babel's adapter
```

**Integration**:
- Webpack loaderで `babelTransformAdapterFactory` を使用
- `BabelEnv` を構築してadapterを作成
- Babelの `transformAsync` でASTを取得

## 5. Key Implementation Details

### 5.1 Metadata Collection with WeakMap

**実装** (`plugin-babel/src/adapter/metadata.ts`):
```typescript
type GqlDefinitionMetadataMap = WeakMap<t.CallExpression, GqlDefinitionMetadata>;
```

**理由**:
- AST nodeをkeyとして使用
- Automatic garbage collection
- Memory leakを防止

### 5.2 Canonical ID Resolution

**フォーマット** (`plugin-shared`):
```typescript
type CanonicalId = `${string}#${string}`;
// Example: "/path/to/file.ts#Program/VariableDeclaration[0]/CallExpression"
```

**用途**:
- ファイル内の定義を一意に識別
- Artifactとsource codeの対応付け
- Library-neutral identifier

### 5.3 Dev Mode Detection

**条件** (`plugin-babel/src/plugin.ts:31-33`):
```typescript
const isDevMode =
  (rawOptions.dev?.hmr === true ||
   process.env.SODA_GQL_DEV === "true") &&
  normalizedState.options.artifact.type === "builder";
```

**動作**:
- Dev mode: `DevManager` でHMR対応
- Production: Static plugin state

### 5.4 Source Map Handling

**Loader** (`plugin-nestjs/webpack/loader.ts`):
- Input source mapを受け取る
- Babelの `transformAsync` で変換
- Output source mapを生成
- `retainLines: true` で行番号を保持

### 5.5 Diagnostics System

**Reporter** (`plugin-nestjs/internal/diagnostics.ts`):
```typescript
class DiagnosticsReporter {
  recordError(failure);
  recordSuccess(artifact);
  getFailure();
  getSummary();
}
```

**出力形式**:
- Console: webpack logger経由
- JSON: `soda-gql.diagnostics.json` asset

## Summary

soda-gqlのプラグインシステムは、以下の設計原則に基づいて構築されています：

1. **Separation of Concerns**: Library-neutral core (plugin-shared) と specific implementations (plugin-babel, plugin-nestjs) の分離
2. **Extensibility**: TransformAdapter interfaceによる将来的なAST library追加のサポート
3. **Type Safety**: neverthrowによるtype-safe error handling、IR型による厳密な変換パイプライン
4. **Performance**: Module-level caching、manifest-based change detection、exclusive execution queue
5. **Developer Experience**: HMR support、diagnostics、source maps、watch mode

このアーキテクチャにより、Babel以外のAST library (SWC/esbuild) への移行や、Webpack以外のbundler (Vite/Rollup) への対応が容易になっています。

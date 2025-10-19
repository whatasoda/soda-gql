# plugin-nestjs Unnecessary Code Analysis

> **アーカイブ通知**: このドキュメントは、v0.1.0で以下のパッケージに分割された歴史的な`@soda-gql/plugin-nestjs`パッケージについて記載しています:
> - `@soda-gql/plugin-tsc` - TypeScriptコンパイラプラグイン
> - `@soda-gql/plugin-swc` - SWCコンパイラプラグイン
> - `@soda-gql/plugin-webpack` - Webpackローダーとプラグイン（NestJSユーティリティを含む）

**Date**: 2025-10-14
**Purpose**: Identify unnecessary implementations in plugin-nestjs that are not required for build-time transformation

## Executive Summary

plugin-nestjsは当初NestJS固有の機能（サービス、プロバイダー、DIトークン）を含む設計でしたが、実際の要件は**ビルドプロセスでsoda-gqlで書かれたGraphQLドキュメントを置き換えることのみ**です。

**結論**: NestJSランタイム層全体（約**397行**）が不要で、削除可能です。

## Core Requirements (保持すべきもの)

### 1. Webpack Loader
**File**: `packages/plugin-nestjs/src/webpack/loader.ts` (248 LOC)
- **Purpose**: ビルド時にsoda-gqlコードを変換
- **Status**: ✅ **REQUIRED** - ビルド時変換の中核
- **Dependencies**:
  - Imports: webpack, Babel adapter, plugin-shared runtime helpers
  - Imported by: `webpack/index.ts`, package exports

### 2. Webpack Plugin
**File**: `packages/plugin-nestjs/src/webpack/plugin.ts` (286 LOC)
- **Purpose**: Artifactの生成・監視、診断、ランタイムキャッシュ更新
- **Status**: ✅ **REQUIRED** - アーティファクト管理の中核
- **Dependencies**:
  - Imports: `internal/diagnostics.js`, `internal/manifest.js`, builder service utilities
  - Used by: `withSodaGql`, `./webpack` exports

### 3. Webpack Hooks Helper
**File**: `packages/plugin-nestjs/src/webpack/hooks.ts` (46 LOC)
- **Purpose**: Webpack hookの登録ヘルパー
- **Status**: ✅ **REQUIRED** - Plugin専用ヘルパー
- **Dependencies**: Only used by `webpack/plugin.ts`

### 4. Configuration Helper
**File**: `packages/plugin-nestjs/src/config/with-soda-gql.ts` (99 LOC)
- **Purpose**: Nest CLI webpack設定にプラグイン・ローダーを注入
- **Status**: ✅ **REQUIRED** - ユーザー向けAPI
- **Dependencies**:
  - Validates via `schemas/config.js`, `schemas/webpack.js`
  - Exported by `config/index.ts`

### 5. Internal Support Files
**Files**:
- `packages/plugin-nestjs/src/internal/diagnostics.ts` (95 LOC)
- `packages/plugin-nestjs/src/internal/manifest.ts` (32 LOC)

**Purpose**: ビルド結果のサマリーと不要なアーティファクト再書き込み回避
**Status**: ✅ **REQUIRED** - Webpack Plugin専用サポート
**Dependencies**: Webpack pluginのみが使用

### 6. Schema Definitions (Build-time)
**Files**:
- `packages/plugin-nestjs/src/schemas/webpack.ts`
- `packages/plugin-nestjs/src/schemas/config.ts`

**Status**: ✅ **REQUIRED** - Loader/Plugin/Config helperのバリデーション

---

## Unnecessary Code (削除可能)

### 1. NestJS Module
**File**: `packages/plugin-nestjs/src/nest/module.ts` (20 LOC)

```typescript
// SodaGqlModule - NestJS DI container declaration
@Module({ ... })
export class SodaGqlModule {
  static forRoot(options: NestModuleOptions): DynamicModule { ... }
}
```

- **Purpose**: NestJSのDIコンテナ宣言
- **Status**: ❌ **UNNECESSARY** - Runtime artifact accessのみに使用
- **Dependencies**:
  - Imports: `@nestjs/common`, `nestModuleOptionsSchema`, Nest providers
  - Referenced by: `nest/index.ts` only
- **Impact**: ランタイムでのアーティファクトアクセス機能が失われる（ビルド時変換には不要）

### 2. NestJS Providers & Service
**File**: `packages/plugin-nestjs/src/nest/providers.ts` (274 LOC)

```typescript
// Runtime artifact access APIs
export class SodaGqlService {
  getOperationByName(name: string): BuilderArtifactOperation | null { ... }
  getOperationById(id: string): BuilderArtifactOperation | null { ... }
  getSliceById(id: string): BuilderArtifactSlice | null { ... }
  getModelByTypename(typename: string): BuilderArtifactModel | null { ... }
  listOperations(): BuilderArtifactOperation[] { ... }
  listSlices(): BuilderArtifactSlice[] { ... }
  listModels(): BuilderArtifactModel[] { ... }
}
```

- **Purpose**: DIプロバイダー + ランタイムレジストリAPI
- **Status**: ❌ **UNNECESSARY** - ランタイムクエリAPI（ビルド時には不要）
- **Dependencies**:
  - Imports: builder artifact types, `@nestjs/common`, `createNestArtifactProvider`
  - Used by: `SodaGqlModule` only
- **Impact**: NestJSアプリ内でのアーティファクト照会機能が失われる

### 3. DI Tokens
**File**: `packages/plugin-nestjs/src/nest/tokens.ts` (28 LOC)

```typescript
export const SODA_GQL_MODULE_OPTIONS = Symbol.for("@soda-gql/plugin-nestjs:options");
export const SODA_GQL_ARTIFACT = Symbol.for("@soda-gql/plugin-nestjs:artifact");
export const SODA_GQL_DIAGNOSTICS = Symbol.for("@soda-gql/plugin-nestjs:diagnostics");
```

- **Purpose**: NestJS DIシンボル定義
- **Status**: ❌ **UNNECESSARY** - ランタイムDIのみに使用
- **Dependencies**: Providers and module only
- **Impact**: DI経由のアーティファクト注入が不可能に

### 4. Nest Index Re-exports
**File**: `packages/plugin-nestjs/src/nest/index.ts` (11 LOC)

```typescript
export * from "./module.js";
export * from "./providers.js";
export * from "./tokens.js";
```

- **Purpose**: Nestランタイム層の公開API
- **Status**: ❌ **UNNECESSARY** - Nest層全体が不要
- **Impact**: `@soda-gql/plugin-nestjs/module` importが不可能に

### 5. Artifact Provider Bridge
**File**: `packages/plugin-nestjs/src/shared/artifact-provider.ts` (32 LOC)

```typescript
export const createNestArtifactProvider = async (
  options: NestModuleOptions
): Promise<ArtifactProvider> => { ... }
```

- **Purpose**: Nestモジュールオプションをplugin-sharedのartifact providerに橋渡し
- **Status**: ❌ **UNNECESSARY** - `nest/providers.ts`のみが使用
- **Dependencies**: Only imported by `nest/providers.ts`
- **Impact**: Nest層削除と同時に不要化

### 6. Nest Module Schema
**File**: `packages/plugin-nestjs/src/schemas/module.ts` (32 LOC)

```typescript
export const nestModuleOptionsSchema = z.object({
  artifactPath: z.string(),
  diagnostics: z.enum(["off", "console", "json"]).optional(),
  eagerRegistration: z.boolean().optional(),
});
```

- **Purpose**: NestJSモジュールオプションのZodバリデーション
- **Status**: ❌ **UNNECESSARY** - `nest/module.ts`, `nest/providers.ts`のみが参照
- **Dependencies**: No build-time callers
- **Impact**: Nest層削除と同時に不要化

### 7. Type Exports (Partial Cleanup)
**File**: `packages/plugin-nestjs/src/types.ts` (19 LOC)

```typescript
// Currently re-exports Nest types - REMOVE THESE
export type { NestModuleOptions, NestDiagnosticsMode } from "./schemas/module.js";

// Keep build-time types - KEEP THESE
export type { WebpackPluginOptions, WebpackLoaderOptions } from "./schemas/webpack.js";
export type { SodaGqlConfig } from "./schemas/config.js";
```

- **Status**: ⚠️ **PARTIAL CLEANUP** - Nest型の削除、ビルド時型は保持
- **Impact**: 公開型定義からNestJS関連が消失

### 8. Package Root Exports
**File**: `packages/plugin-nestjs/src/index.ts` (current state)

```typescript
// REMOVE THIS
export * from "./nest/index.js";

// KEEP THESE
export * from "./errors.js";
export * from "./webpack/index.js";
export * from "./config/index.js";
```

- **Status**: ⚠️ **PARTIAL CLEANUP** - Nest re-exportの削除
- **Impact**: パッケージルートからNest APIが消失

### 9. Package.json Configuration
**File**: `packages/plugin-nestjs/package.json`

```json
{
  "exports": {
    ".": { ... },
    "./webpack": { ... },
    "./config": { ... },
    "./module": { ... }  // ← REMOVE THIS
  },
  "peerDependencies": {
    "@nestjs/common": "^10.0.0",  // ← REMOVE
    "@nestjs/core": "^10.0.0"     // ← REMOVE
  }
}
```

- **Status**: ⚠️ **PARTIAL CLEANUP** - `./module` exportとNestJS peer依存の削除
- **Impact**: `@nestjs/*`のインストール強制がなくなる

---

## Summary Statistics

### Code to Delete

| Category | Files | LOC | Notes |
|----------|-------|-----|-------|
| **Nest Module** | 1 | 20 | `nest/module.ts` |
| **Nest Providers** | 1 | 274 | `nest/providers.ts` |
| **Nest Tokens** | 1 | 28 | `nest/tokens.ts` |
| **Nest Index** | 1 | 11 | `nest/index.ts` |
| **Artifact Provider Bridge** | 1 | 32 | `shared/artifact-provider.ts` |
| **Nest Schema** | 1 | 32 | `schemas/module.ts` |
| **Partial Cleanup** | 3 | ~20 | `types.ts`, `index.ts`, `package.json` |
| **TOTAL** | **9 files** | **~417 LOC** | **-14% of package** |

### Code to Keep

| Category | Files | LOC | Notes |
|----------|-------|-----|-------|
| **Webpack Loader** | 1 | 248 | Core transformation |
| **Webpack Plugin** | 1 | 286 | Artifact management |
| **Webpack Hooks** | 1 | 46 | Plugin helper |
| **Config Helper** | 1 | 99 | User-facing API |
| **Internal Support** | 2 | 127 | Diagnostics + manifest |
| **Schemas** | 2 | ~100 | Validation |
| **TOTAL** | **8 files** | **~906 LOC** | **Core build-time** |

---

## Recommendations

### 1. Delete Entire Nest Runtime Layer ✅ RECOMMENDED

```bash
# Delete files
rm -rf packages/plugin-nestjs/src/nest/
rm packages/plugin-nestjs/src/shared/artifact-provider.ts
rm packages/plugin-nestjs/src/schemas/module.ts
```

**Benefits**:
- ✅ Reduces package size by ~417 LOC (-14%)
- ✅ Eliminates unused runtime dependencies
- ✅ Clarifies package purpose (build-time only)
- ✅ Removes maintenance burden for DI/runtime features

### 2. Update Package Exports ✅ RECOMMENDED

**`packages/plugin-nestjs/src/index.ts`**:
```typescript
// Remove Nest re-export
// export * from "./nest/index.js"; // ← DELETE

// Keep build-time APIs
export * from "./errors.js";
export * from "./webpack/index.js";
export * from "./config/index.js";
```

**`packages/plugin-nestjs/package.json`**:
```json
{
  "exports": {
    ".": { ... },
    "./webpack": { ... },
    "./config": { ... }
    // Remove "./module": { ... }
  },
  "peerDependencies": {
    // Remove "@nestjs/common" and "@nestjs/core"
  }
}
```

### 3. Clean Up Type Exports ✅ RECOMMENDED

**`packages/plugin-nestjs/src/types.ts`**:
```typescript
// Remove Nest types
// export type { NestModuleOptions, NestDiagnosticsMode } from "./schemas/module.js";

// Keep build-time types only
export type { WebpackPluginOptions, WebpackLoaderOptions, WebpackDiagnosticsMode } from "./schemas/webpack.js";
export type { SodaGqlConfig } from "./schemas/config.js";
```

### 4. Update Documentation ⚠️ REQUIRED FOR RELEASE

**Breaking Changes**:
- ❌ `SodaGqlModule` removed
- ❌ `SodaGqlService` removed
- ❌ DI tokens (`SODA_GQL_*`) removed
- ❌ Runtime artifact query APIs removed
- ❌ `@soda-gql/plugin-nestjs/module` import path removed

**Migration Guide**:
```markdown
## Migrating from plugin-nestjs v0.x

### Before (with NestJS runtime)
```typescript
import { SodaGqlModule } from '@soda-gql/plugin-nestjs/module';

@Module({
  imports: [
    SodaGqlModule.forRoot({
      artifactPath: '.soda-gql/artifacts/artifact.json',
    }),
  ],
})
export class AppModule {}
```

### After (build-time only)
```typescript
// nest-cli.json or custom webpack config
import { withSodaGql } from '@soda-gql/plugin-nestjs/config';

export default withSodaGql({
  plugin: {
    mode: 'zero-runtime',
    artifactPath: '.soda-gql/artifacts/artifact.json',
  },
});
```

**Note**: Runtime artifact access is no longer supported. All soda-gql documents are transformed at build time.
```

### 5. Version Bump ⚠️ REQUIRED

**Semantic Versioning**:
- Current: `v0.1.0` (pre-release)
- After removal: `v0.2.0` (breaking change, but pre-1.0 allows minor bump)

**Changelog Entry**:
```markdown
## [0.2.0] - 2025-10-14

### BREAKING CHANGES
- Removed NestJS runtime layer (SodaGqlModule, SodaGqlService, DI tokens)
- Removed `@soda-gql/plugin-nestjs/module` export path
- Removed `@nestjs/*` peer dependencies

### Rationale
plugin-nestjs now focuses solely on build-time transformation via webpack loader/plugin.
Runtime artifact access is no longer required as all soda-gql documents are transformed during compilation.

### Migration
Use `withSodaGql()` config helper in webpack configuration. See migration guide for details.
```

---

## Impact Analysis

### User Impact

**Current Users (if any)**:
- ❌ **Breaking**: NestJS runtime integration stops working
- ⚠️ **Migration Required**: Must remove `SodaGqlModule` imports
- ✅ **No Impact**: Users only using webpack plugin/loader (likely majority)

**Future Users**:
- ✅ **Simpler API**: Only webpack configuration needed
- ✅ **Fewer Dependencies**: No `@nestjs/*` peer deps
- ✅ **Clearer Purpose**: Build-time transformation only

### Development Impact

**Maintenance**:
- ✅ **Less Code**: -417 LOC to maintain
- ✅ **Fewer Tests**: No need for DI/runtime tests
- ✅ **Clearer Scope**: Focus on webpack integration only

**Future Work**:
- Consider removing "nestjs" from package name (breaking, v1.0 candidate)
- Or rename to `@soda-gql/plugin-webpack` for clarity

---

## Implementation Plan

### Phase 1: Code Removal (1 hour)
1. Delete `src/nest/` directory
2. Delete `src/shared/artifact-provider.ts`
3. Delete `src/schemas/module.ts`
4. Update `src/index.ts` (remove Nest re-export)
5. Update `src/types.ts` (remove Nest types)
6. Update `package.json` (remove `./module` export, Nest peer deps)

### Phase 2: Documentation (1 hour)
1. Update README with new API surface
2. Write migration guide
3. Update examples to show webpack-only usage
4. Add changelog entry

### Phase 3: Testing (1 hour)
1. Remove Nest-specific tests
2. Verify webpack loader/plugin tests still pass
3. Add integration test for `withSodaGql` helper
4. Test in sample NestJS project (build-time only)

### Phase 4: Release (30 min)
1. Bump version to v0.2.0
2. Commit with breaking change message
3. Create release notes
4. Publish to npm (if applicable)

**Total Estimate**: 3.5 hours

---

## Conclusion

plugin-nestjsのNestJSランタイム層は、ビルド時変換のみを目的とする場合**完全に不要**です。

**削除推奨**:
- ✅ 9ファイル、~417行のコード削除
- ✅ パッケージサイズ14%削減
- ✅ API明確化（ビルド時専用）
- ✅ 不要な依存関係削除

**トレードオフ**:
- ⚠️ 破壊的変更（既存のNestJS runtime integration使用者に影響）
- ⚠️ マイグレーションガイド必須

**推奨アクション**:
プレリリース段階（v0.1.0）なので、今すぐ削除して v0.2.0 としてリリースするのが最適なタイミング。

---

**Generated**: 2025-10-14
**Codex Analysis**: Used for detailed codebase inspection and dependency analysis

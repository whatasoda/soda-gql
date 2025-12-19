# Builder Package Memory Optimization Plan

## Goal

Peak heap memory usage を削減する（現状: xlarge で 38.7MB）

## Benchmark Command

```bash
bun run perf:builder --fixture xlarge --iterations 5 --gc
```

---

## Priority 1: AST Early Release (推定 10-20% 削減)

**問題**: AST オブジェクト（特に `ts.SourceFile`）がパース後も保持される

**対象ファイル**:

- `packages/builder/src/ast/core.ts`
- `packages/builder/src/ast/adapters/typescript.ts`
- `packages/builder/src/ast/adapters/swc.ts`

**実装**:

1. `AnalyzerAdapter` インターフェースを変更し、パース済み AST を返さない
2. 分析結果のみを返し、AST は関数スコープ内で解放
3. アダプターの `parse()` と `analyze()` を統合

---

## Priority 2: Slim Discovery Snapshot (推定 15-25% 削減)

**問題**: `DiscoverySnapshot.analysis` に完全な `ModuleAnalysis` を保持

**対象ファイル**:

- `packages/builder/src/discovery/types.ts`
- `packages/builder/src/discovery/discoverer.ts`
- `packages/builder/src/session/builder-session.ts`

**実装**:

1. Discovery 完了後、セッション状態には軽量版スナップショットを保存
2. `analysis.expression` 文字列は中間モジュール生成後に解放
3. キャッシュ用とセッション用で型を分離

---

## Priority 3: Script Object Release (推定 5-8% 削減)

**問題**: `IntermediateModule.script: Script` がセッション状態に保持される

**対象ファイル**:

- `packages/builder/src/intermediate-module/types.ts` (line 18)
- `packages/builder/src/intermediate-module/evaluation.ts`
- `packages/builder/src/intermediate-module/codegen.ts`

**実装**:

1. `IntermediateModule` から `script` フィールドを削除
2. `transpiledCode` のみを保持
3. 評価時にオンデマンドで `new Script()` を実行し、即座に解放

---

## Priority 4: Differential State (推定 10-15% 削減)

**問題**: `new Map(previousIntermediateModules)` で毎回フルコピー

**対象ファイル**:

- `packages/builder/src/session/builder-session.ts` (line 310)

**実装**:

1. Map のフルコピーを避け、in-place で更新
2. 影響を受けたファイルのみ削除・追加
3. イミュータブルパターンから効率的な可変更新に変更

---

## Priority 5: Fingerprint Cache LRU (推定 3-5% 削減)

**問題**: フィンガープリントキャッシュが無制限に成長

**対象ファイル**:

- `packages/builder/src/discovery/fingerprint.ts`

**実装**:

1. 最大エントリ数を設定（例: 2000）
2. LRU 近似のエビクションを実装
3. ビルド完了後に古いエントリをトリム

---

## Priority 6: Module Adjacency Array (推定 3-5% 削減)

**問題**: `Map<string, Set<string>>` で多数の Set オブジェクトを生成

**対象ファイル**:

- `packages/builder/src/session/module-adjacency.ts`

**実装**:

1. `Set<string>` を `string[]` に変更（配列は Set より軽量）
2. 構築時にソートし、ルックアップは二分探索
3. 重複除去は構築時に一度だけ実施

---

## Verification Strategy

各最適化の後に:

1. `bun run perf:builder --fixture xlarge --iterations 3 --gc` で計測
2. Peak heap used の変化を記録
3. テストスイート実行で動作確認

---

## Critical Files Summary

| ファイル                                            | 変更内容              |
| --------------------------------------------------- | --------------------- |
| `packages/builder/src/ast/core.ts`                  | AST 早期解放          |
| `packages/builder/src/ast/adapters/*.ts`            | アダプター統合        |
| `packages/builder/src/discovery/types.ts`           | SlimSnapshot 型追加   |
| `packages/builder/src/discovery/discoverer.ts`      | スナップショット軽量化 |
| `packages/builder/src/discovery/fingerprint.ts`     | LRU キャッシュ        |
| `packages/builder/src/intermediate-module/types.ts` | Script 削除           |
| `packages/builder/src/intermediate-module/evaluation.ts` | オンデマンド Script |
| `packages/builder/src/session/builder-session.ts`   | 差分更新              |
| `packages/builder/src/session/module-adjacency.ts`  | Array 変換            |

# soda-gql 改善計画 (2025-09-28)

## 全体サマリー
- SWC ベースのモジュール解析〜中間モジュール生成までは形になったが、`packages/builder/src/ast/analyze-module-swc.ts:1` が 889 行に肥大化し、`any` 多用や重複ロジックが散在して保守性が急速に悪化している。
- Babel プラグインとビルダーの契約が揃っておらず、zero-runtime でも runtime でもビルダー生成物を `../../builder/src/types` のような相対パスに頼って解釈している (`packages/plugin-babel/src/artifact.ts:6` 等)。
- ビルダーの実行は毎回全ファイルを再読込し、`Bun.write` と乱数ファイル名の `.ts` 中間モジュールを生成するため、キャッシュ・ウォッチを活かせない (`packages/builder/src/module-loader.ts:39`, `packages/builder/src/intermediate-module.ts:160`)。

## 優先度マップ
|カテゴリ|優先度|決定理由|
|---|---|---|
|アーキテクチャ|P0|プラグインとビルダーの契約不整合がゼロランタイムの約束を満たしていないため|
|エラーハンドリング|P0|`throw new Error` による未整理コードが本番でクラッシュを誘発するため|
|テスト|P0|監視モードや SWC 分岐の回帰を防ぐ仕組みが未整備のため|
|型安全性|P0|`any` の氾濫で静的保証が崩れており後続作業の土台にならないため|
|コード品質|P1|巨大ファイル・重複ロジックの分割は必須だが上記 P0 作業と並行で進められるため|
|パフォーマンス|P1|根幹機能を壊さずにキャッシュ導入で大幅な体感改善が見込めるため|
|依存関係|P1|Babel などの peer 依存を宣言しないと外部ユーザーが落ちるリスクが高いため|
|ワークフロー|P1|ビルド/テストの一括実行やウォッチ整備がチーム速度に直結するため|
|一貫性|P2|命名・パス規約の乱れは整理したいが上位優先度と競合しない|
|ドキュメント|P2|機能差分のキャッチアップは重要だがまず実装を確定させる必要がある|

---

## 1. コード品質 (優先度: P1)

### 現状の課題
- `packages/builder/src/ast/analyze-module-swc.ts:1` が 889 行に及び、AST 走査・シンボル解決・エクスポート抽出が単一関数に凝集している。
- `packages/builder/src/ast/analyze-module.ts:1` との間でロジックを二重実装しており、修正漏れの温床になっている。
- `packages/builder/src/intermediate-module.ts:92` では TypeScript AST を直接操作しつつ文字列置換を併用しており、読み手にとって意図が不透明。

### 提案する解決策
- SWC/TS 双方で共有できる AST ユーティリティを `packages/builder/src/ast/shared/` に新設し、責務ごとにモジュールを分割する。
- エクスポート抽出、依存解決、式の書き換えをステートレスな純関数に分割し、ユニットテスト可能にする。
- 文字列操作ではなく `@swc/core` のプリンターに統一してフォーマットの揺れを排除する。

### 実装アプローチ
1. `ModuleTraversalContext` など共通型を切り出した `shared/context.ts` を作成し、SWC/TS 双方から参照できるようにする。
2. `collectGqlCalls`, `collectExports`, `resolveReferences` をそれぞれ独立関数に分割し、現在の巨大ファイルから移植する。
3. `rewriteExpression` を SWC 版に置き換え、`typescript` 依存を削減する。
4. 分割後に `bun test --filter module_analysis` を増補してリグレッションを防ぐ。

### コード例
```ts
// packages/builder/src/ast/shared/gql-call.ts
import { type CallExpression } from "@swc/core";
import { visitModule } from "./visitor";

export const collectGqlCalls = (module: Module) => {
  const calls: GqlCallMeta[] = [];
  visitModule(module, {
    callExpression(node: CallExpression) {
      if (isGqlCall(node)) {
        calls.push(toMeta(node));
      }
      return node;
    },
  });
  return calls;
};
```

### マイグレーション戦略
- 内部実装のみの変更であり、外部 API の互換性は維持される想定。既存の SWC/TS 両テストが通ることを確認すれば追加のマイグレーションは不要。

---

## 2. アーキテクチャ (優先度: P0)

### 現状の課題
- Babel プラグインは `gql.query` 以外の書き換えにビルダー生成物を使わず、`packages/plugin-babel/src/plugin.ts:305` でモデルやスライスを手作りしている。
- プラグインが `../../builder/src/types` を直接 import しており、パッケージ境界を破っている (`packages/plugin-babel/src/artifact.ts:6`)。
- 中間モジュールは `as const` 付きの `.ts` ファイルとして生成され、Node.js ランタイムでは読み込めない (`packages/builder/src/intermediate-module.ts:160`)。

### 提案する解決策
- ビルダー側で「ランタイム公開面」を `@soda-gql/runtime-bindings` などの新パッケージとして出力し、プラグインはその公開 API のみを依存対象にする。
- 中間モジュールを `.mjs` に変更し、ハッシュ付き安定ファイル名 + `export const` のみを含むバンドル済み JS を出力する。
- プラグインの runtime/zero-runtime 分岐を「アーティファクト導入→runtime import 置換」の 2 段階に整理し、BuilderArtifact のスキーマを統一する。

### 実装アプローチ
1. `packages/builder/src/runtime-names.ts` を拡張し、`generateRuntimeBindings(artifact)` を新設して必要なエクスポートを列挙する。
2. 新規 `packages/runtime-bindings` を追加し、ビルダー実行時に `graphql-system/runtime.mjs` を生成して再利用できるようにする。
3. プラグイン側で `lookupModelArtifact` などを runtime バインディングに差し替え、`createRuntimeBindingName` の参照を排除する。
4. `runBuilder` の `outPath` を JS ファイル生成に切り替え、`bundler.writeJs` のようなユーティリティを追加する。

### コード例
```ts
// packages/builder/src/runtime-bindings.ts
export const generateRuntimeBindings = (artifact: BuilderArtifact) => ({
  models: Object.fromEntries(
    Object.entries(artifact.models).map(([id, entry]) => [id, entry.prebuild])
  ),
  slices: artifact.slices,
  operations: artifact.operations,
});
```

### マイグレーション戦略
- 破壊的変更: 中間モジュールのファイル拡張子と生成先が変わるため、既存利用者には以下を案内する。
  1. `soda-gql@0.x` 最終版で deprecation 警告を出し、`--legacy-intermediate` フラグで旧挙動を残す。
  2. 次のマイナーリリースで新形式をデフォルトにし、旧フラグは 1 リリース後に削除。
  3. ドキュメントと CHANGELOG で新しい import パス (`@soda-gql/runtime-bindings`) を告知する。

---

## 3. パフォーマンス (優先度: P1)

### 現状の課題
- `packages/builder/src/module-loader.ts:39` が毎回すべての依存ファイルを読み込み直し、ヒット率に関係なく AST 解析を繰り返している。
- `.cache/soda-gql/builder/runtime/intermediate-xxxx.ts` のファイル名に乱数が含まれるため、ウォッチャーが毎回新規ファイルとして扱い差分ビルドが効かない。
- `packages/builder/src/intermediate-module.ts:130` で TypeScript のプリンターを呼び出すため、SWC に比べて 2〜3 倍遅い。

### 提案する解決策
- ファイルハッシュ単位の AST キャッシュを永続化し、変更のないファイルは AST を再利用する。
- 中間モジュールのファイル名を `intermediate/index.mjs` に固定し、内容差分のみ書き換える。
- SWC のプリンター (`print` API) を採用し、TypeScript 依存を削減する。

### 実装アプローチ
1. `createModuleCache` に `persist()` / `loadAll()` を追加し、`Bun.file` ではなく JSON スナップショットを保存する。
2. `createIntermediateModule` に `writeFileSync` + 一時ファイル→rename の手順を導入し、原子的に差し替える。
3. `rewriteExpression` を SWC AST に変換して `@swc/core` のプリンターを利用する。
4. `bun test --filter builder_cache_flow` を更新し、ヒット率の検証とウォッチモード擬似テストを追加する。

### コード例
```ts
// packages/builder/src/cache/persistent.ts
export const createPersistentCache = (root: string) => {
  const indexPath = join(root, "modules.json");
  const index = loadIndex(indexPath);
  return {
    load(filePath: string, hash: string) {
      return index.get(`${filePath}:${hash}`) ?? null;
    },
    store(analysis: ModuleAnalysis) {
      index.set(`${analysis.filePath}:${analysis.hash}`, analysis);
      scheduleFlush(indexPath, index);
    },
  };
};
```

### マイグレーション戦略
- キャッシュディレクトリ構造が変わるが利用者影響は軽微。初回実行時に旧 `.cache/soda-gql/builder/modules` を削除する処理を入れて自動移行する。

---

## 4. 型安全性 (優先度: P0)

### 現状の課題
- `packages/builder/src/ast/analyze-module-swc.ts` に 30 以上の `as any` が存在し、AST 形状が保証されていない。
- `packages/cli/src/commands/codegen.ts:156` などで `as any` に頼って合計を算出している。
- `packages/builder/src/intermediate-module.ts:100` の `unwrapNullish` 依存は型ガードになっておらず、期待と異なる構造を渡すと実行時例外になる。

### 提案する解決策
- `@swc/types` の型をもとに `Guard` ユーティリティを追加し、型レベルでノード種別を判定する。
- `neverthrow` の `Result` 型を活用し、`unwrapNullish` を返り値の `Result` に置き換える。
- CLI 側の統計計算には `z.number()` のスキーマを使い、`unknown` から安全に変換する。

### 実装アプローチ
1. `packages/builder/src/ast/shared/guards.ts` に `isCallExpression`, `isIdentifier` 等の型ガードをまとめる。
2. `rewriteExpression` の戻り値を `Result<string, BuilderError>` に変更し、呼び出し側で `isErr` チェックを徹底する。
3. CLI コマンドのメトリクス集計を `ReportSchema` で検証し、`reduce` に直接 `z.number` でパースした値を渡す。
4. `bun test --filter type-safety` を追加し、異常系の戻り値が `err` になることを確認する。

### コード例
```ts
// packages/builder/src/ast/shared/guards.ts
import { type Expression } from "@swc/core";

export const isIdentifier = (node: Expression): node is Identifier =>
  node.type === "Identifier";

export const expectIdentifier = (node: Expression, context: string) =>
  isIdentifier(node) ? ok(node) : err({ code: "UNEXPECTED_AST", context });
```

### マイグレーション戦略
- 戻り値が `Result` になる箇所は内部呼び出しのみ。ビルダーの公開 API には影響しないため追加マイグレーションは不要。

---

## 5. テスト (優先度: P0)

### 現状の課題
- SWC / TS アナライザーの分岐を統合的に検証するウォッチモードのテストが存在しない。
- `bun test` は存在するが `package.json` のスクリプトに登録されておらず、CI での標準実行が保証されない。
- Babel プラグインのエラーコード (`SODA_GQL_*`) が `tests/contract/plugin-babel` で部分的にしか検証されていない。

### 提案する解決策
- `tests/integration/runtime_builder_flow.test.ts` を拡張し、`analyzer: "swc"` パスと `--watch` 擬似モードを加える。
- `package.json` に `test`, `test:watch` スクリプトを追加し、CI で `bun run test` を必須化する。
- プラグインのエラーケースを網羅するデータ駆動テストを追加し、コードフレームの内容まで検証する。

### 実装アプローチ
1. テスト共通ユーティリティに `runBuilderInWatchMock` を追加してファイル変更イベントを模倣する。
2. CI ワークフローに `bun run test` を追加し、`bun run quality` 前後で実行する。
3. Babel プラグイン用に `tests/contract/plugin-babel/error_matrix.test.ts` を新設し、想定する各エラーコードを配列で列挙する。
4. `bun test --coverage` を導入し、カバレッジ欠落箇所をレポートに反映する。

### コード例
```json
// package.json (抜粋)
{
  "scripts": {
    "test": "bun test",
    "test:watch": "bun test --watch",
    "quality": "bun run biome:check && bun run typecheck && bun run test"
  }
}
```

### マイグレーション戦略
- CI での実行に影響するのみ。既存利用者には新しい `quality` スクリプトがテストも含む点を CHANGELOG で通知する。

---

## 6. 一貫性 (優先度: P2)

### 現状の課題
- パッケージ間 import が `../../builder/src/index.ts` のような相対パスと `@soda-gql/*` のエイリアスで混在している。
- ファイル命名が `camelCase` と `kebab-case` で揺れており、コード検索性が低下している (`packages/plugin-babel/src/imports.ts` 等)。

### 提案する解決策
- すべての内部参照をワークスペースエイリアスに統一し、`paths` 設定を `tsconfig.base.json` に一本化する。
- ファイル命名規則を `kebab-case.ts` に統一し、Biome ルールと lint ルールを追加する。

### 実装アプローチ
1. `tsconfig.base.json` の `compilerOptions.paths` に各パッケージの `src` を定義し、相対 import を置換する codemod を適用する。
2. Biome の `naming-convention` ルールでファイル名を検証し、逸脱ファイルには自動修正を適用する。
3. `package.json` に `lint:paths` スクリプトを追加し、`tsx` のパス解決を検証する。
4. PR テンプレートに「相対 import 禁止」チェックボックスを追加する。

### コード例
```json
// tsconfig.base.json (抜粋)
{
  "compilerOptions": {
    "paths": {
      "@soda-gql/builder/*": ["packages/builder/src/*"],
      "@soda-gql/plugin-babel/*": ["packages/plugin-babel/src/*"]
    }
  }
}
```

### マイグレーション戦略
- ファイル名変更に伴い `git mv` が必要だが、公開 API は影響を受けない。大規模差分になるためカテゴリごとに段階実施する。

---

## 7. 依存関係 (優先度: P1)

### 現状の課題
- `packages/plugin-babel/package.json` が `@babel/core` を通常依存に置いており、プラグイン利用側でダブルインストールが発生する。
- `packages/builder/package.json` が `typescript` を通常依存に含めているため、バンドルサイズが不要に肥大化する。
- `bun.lock` に不要な transitive 依存が残り、`bun install --production` で削除されない。

### 提案する解決策
- Babel プラグインは `peerDependencies` に `@babel/core` を宣言し、`devDependencies` に最小バージョンを残す。
- ビルダーから `typescript` を外し、必要箇所 (現状 `rewriteExpression`) がなくなった後は `devDependencies` のみに移行する。
- `bun pm prune` を導入し、CI で lockfile の健全性を担保する。

### 実装アプローチ
1. `packages/plugin-babel/package.json` に `peerDependencies` を追加し、`peerDependenciesMeta` でオプショナルを設定する。
2. `packages/builder` で `rewriteExpression` の SWC 化を終えたタイミングで `typescript` を削除する。
3. ルート `package.json` に `prune` スクリプトを追加し、CI で実行する。
4. lockfile 更新後に `bunx depcheck` を用いて未使用依存を検出する。

### コード例
```json
// packages/plugin-babel/package.json (抜粋)
{
  "peerDependencies": {
    "@babel/core": "^7.24.0"
  },
  "devDependencies": {
    "@babel/core": "^7.24.0",
    "@types/babel__core": "^7.20.5"
  }
}
```

### マイグレーション戦略
- プラグイン利用者には `@babel/core` の同時インストールを求めるため、リリースノートで明示し、`pnpm dlx` 等のテンプレート更新を行う。

---

## 8. ワークフロー (優先度: P1)

### 現状の課題
- `bun quality` が lint と型チェックのみでテストを含まず、CI で失敗が検知できない。
- ローカル開発でビルダー／プラグインを同時ウォッチする手段がなく、手動で `bun --watch` を複数起動する必要がある。
- コントリビューションガイドが古く、`bun install` 手順のみで終わっている。

### 提案する解決策
- `just` または `turbo` による複数プロセス管理を導入し、`bun run dev` でビルダー・プラグイン・テストを並列起動できるようにする。
- `bun quality` にテストを追加し、CI の必須ステップとする。
- `docs/contributing.md` を更新し、ウォッチャーやキャッシュクリーンの方法を追記する。

### 実装アプローチ
1. ルートに `justfile` を追加し、`dev`, `test:ci`, `clean` タスクを定義する。
2. `package.json` に `dev` スクリプトを追加し、`just dev` を委譲する。
3. `docs` に「開発ループ」セクションを追加し、`bun run dev --filter builder` 等のコマンドを説明する。
4. CI ワークフロー (`.github/workflows/ci.yml`) を更新し、`bun run dev --dry-run` で設定ミスを検出する。

### コード例
```make
# justfile
set shell := ["bash", "-lc"]

dev:
  bun --watch packages/builder/src/index.ts &
  bun --watch packages/plugin-babel/src/index.ts &
  wait
```

### マイグレーション戦略
- `just` を導入するため、開発者には `cargo install just` もしくは `brew install just` を案内する。CI では `setup-just` を追加して自動化する。

---

## 9. エラーハンドリング (優先度: P0)

### 現状の課題
- `packages/plugin-babel/src/plugin.ts:277` など多数箇所で `throw new Error("SODA_GQL_EXPORT_NOT_FOUND")` としており、Babel のコードフレーム情報が失われる。
- `packages/builder/src/intermediate-module.ts:126` の `throw new Error("RUNTIME_MODULE_TRANSFORM_FAILURE")` が `neverthrow` の慣習を破っている。
- CLI (`packages/cli/src/commands/codegen.ts`) のエラーは `console.error` のみで exit code が一律 `1` になり、呼び出し元が原因を区別できない。

### 提案する解決策
- Babel プラグインでは `path.buildCodeFrameError` を用いた独自エラー型 (`SodaGqlPluginError`) を導入し、エラーコード・ヒント・修正例を含める。
- ビルダー内部は `Result` 型に統一し、例外はロギング後に `err({ code, message })` を返す。
- CLI は `process.exitCode` を設定し、`--diagnostics=json` 時は構造化 JSON を返す。

### 実装アプローチ
1. `packages/plugin-babel/src/errors.ts` を作成し、`createPluginError(code, path, details)` を提供する。
2. `createIntermediateModule` の `try/catch` で例外を `err({ code: "RUNTIME_TRANSFORM_FAILED", message, cause })` に変換する。
3. CLI の `handleError` 関数を実装し、`Result` を `process.exitCode` と連動させる。
4. `tests/contract/plugin-babel` にコードフレームの snapshot テストを追加する。

### コード例
```ts
// packages/plugin-babel/src/errors.ts
export const createPluginError = (code: SodaGqlErrorCode, path: NodePath) =>
  path.buildCodeFrameError(`[${code}] ${messages[code].summary}`, {
    code: "SODA_GQL_ERROR",
    reasonCode: code,
  });
```

### マイグレーション戦略
- エラー表現が変わるため、CLI の利用者には `stderr` 形式の変更を CHANGELOG に記載し、`--diagnostics=json` を通じて後方互換 JSON を提供する。

---

## 10. ドキュメント (優先度: P2)

### 現状の課題
- `README.md` が旧来の runtime モードの説明に偏っており、`gqlRuntime` 依存や中間モジュール生成について触れていない。
- `docs/plan-history/` には更新履歴があるが、利用者向けの移行ガイドが欠落している。
- コントリビューター向けガイドが `bun install` で止まっており、テスト・ウォッチ・デバッグフローの説明が不足している。

### 提案する解決策
- README を「ゼロランタイム導入ガイド」「Babel プラグイン設定」「CLI オプション」の 3 部構成に再編する。
- `docs/improvement-plan.md` と連動した「移行ガイド」を `docs/migration/zero-runtime-v2.md` として作成する。
- コントリビューターガイドに `just dev` やキャッシュクリア手順 (`bun run cleanup`) を追記する。

### 実装アプローチ
1. README の例コードを最新の `gqlRuntime` ベースに差し替え、`graphql-system/runtime` の import 例を掲載する。
2. `docs/migration/zero-runtime-v2.md` を作成し、旧形式との diff と CLI フラグ (`--legacy-intermediate`) を説明する。
3. `docs/contributing.md` を追加し、テスト/ウォッチ/デバッグの流れを段階的に説明する。
4. ドキュメント更新後に `bunx markdownlint` を導入し、記法の統一を図る。

### コード例
```ts
import { gqlRuntime } from "@soda-gql/runtime";

export const profileQuery = gqlRuntime.query({
  prebuild: ProfilePageQueryDocument,
  runtime: { getSlices },
});
```

### マイグレーション戦略
- ドキュメントのみの更新。公開時に `README` の変更点をリリースノートに抜粋し、既存ユーザーへの告知を行う。

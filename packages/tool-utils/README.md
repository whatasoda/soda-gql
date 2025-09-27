# @soda-gql/tool-utils

ツールチェイン専用のユーティリティコレクション

## ⚠️ 重要な使用制限

このパッケージは以下の制限事項を厳守してください：

- **ツールチェインでのみ使用**：builder、cli などの開発ツールでのみ使用可能
- **core パッケージでの使用禁止**：@soda-gql/core では絶対に使用しない
- **runtime パッケージでの使用禁止**：@soda-gql/runtime では絶対に使用しない
- **アプリケーションランタイムでの実行禁止**：エンドユーザーのアプリケーションで実行されないようにする

## なぜこの制限があるのか

このパッケージに含まれるユーティリティは、ビルド時やコード生成時の処理を簡潔に記述するためのものです。
これらは開発者の意図を明確に表現するためのものであり、実行時の堅牢性よりも開発時の表現力を重視しています。

## 利用可能なユーティリティ

### unwrapNullish

型的には nullable だが、実装上 nullish になることがあり得ない値を安全に unwrap するための関数。

詳細は [unwrap-nullish のドキュメント](./docs/unwrap-nullish.md) を参照してください。

## インストール

```bash
bun add @soda-gql/tool-utils
```

## 使用例

```typescript
import { unwrapNullish } from "@soda-gql/tool-utils";

// 配列の長さを確認済みの場合
const arr = ["a", "b", "c"];
if (arr.length >= 3) {
  const thirdItem = unwrapNullish(arr[2], "safe-array-item-access");
  // thirdItem は string として扱える
}
```
# unwrap-nullish ユーティリティ

## 概要

`unwrapNullish` は、型システム上は nullable（`T | null | undefined`）として扱われるが、コードの実装上では確実に値が存在することが保証されている場合に、その値を安全に unwrap（非 null 値として取り出す）するためのユーティリティ関数です。

## なぜ必要か

TypeScript の型システムは、配列アクセスや Map の lookup など、多くの操作で安全側に倒して nullable な型を返します。これは一般的には良い設計ですが、開発者が事前の検証によって値の存在を保証している場合には、冗長な null チェックを強いることになります。

### 典型的な例

```typescript
// 型システム的には arr[2] は string | undefined
const arr: string[] = ["a", "b", "c"];
if (arr.length >= 3) {
  const thirdItem = arr[2]; // string | undefined 😕
  // 本来は string として扱いたい
}
```

## 使用方法

```typescript
import { unwrapNullish } from "@soda-gql/tool-utils";

const arr: string[] = ["a", "b", "c"];
if (arr.length >= 3) {
  const thirdItem = unwrapNullish(arr[2], "safe-array-item-access");
  // thirdItem は string として扱える ✅
}
```

## 承認済みの理由（ApprovedFairReasonToStripNullish）

`unwrapNullish` を使用する際は、必ず事前定義された「理由」を指定する必要があります。これにより、なぜその値が null でないと断言できるのかを明示的に文書化します。

### 現在承認されている理由

| key | 説明 |
|-----|------|
| `safe-array-item-access` | 配列の長さを事前に検証し、アクセスするインデックスに値が存在することが保証されている場合 |
| `validated-map-lookup` | Map や Object のキーの存在を事前に検証済みの場合 |
| `guaranteed-by-control-flow` | 制御フロー解析により値が非 null であることが保証されている場合 |
| `validated-string-split` | 文字列の split 結果が期待する数の要素を持つことが保証されている場合 |

### 新しい理由の追加

新しい使用ケースが発生した場合、`ApprovedFairReasonToStripNullish` 型に新しいエントリを追加できます：

```typescript
type ApprovedFairReasonToStripNullish =
  | // ... 既存の理由
  | {
      key: "your-new-reason";
      description: "詳細な説明";
    };
```

**注意**: 新しい理由は定期的に人間によるレビューの対象となります。

## エラーハンドリング

万が一、値が null または undefined だった場合は、`UnwrapNullishError` が throw されます。このエラーには、指定された理由が含まれるため、デバッグが容易になります。

```typescript
try {
  const value = unwrapNullish(maybeNull, "safe-array-item-access");
} catch (error) {
  if (error instanceof UnwrapNullishError) {
    console.error(error.message);
    // "Value is null or undefined although it was expected to be not null or undefined because: safe-array-item-access"
  }
}
```

## 使用上の注意

### ⚠️ 重要な制限事項

1. **ツールチェインでのみ使用**: この関数は builder、cli などの開発ツールでのみ使用してください
2. **ランタイムでの使用禁止**: アプリケーションのランタイムコードでは使用しないでください
3. **core/runtime パッケージでの使用禁止**: @soda-gql/core と @soda-gql/runtime では使用しないでください

### なぜこれらの制限があるのか

`unwrapNullish` は開発者の意図を明確にし、ツールチェインのコードを簡潔にするためのものです。エンドユーザーのアプリケーションでは、適切なエラーハンドリングや防御的プログラミングが必要であり、このような assertion 的な関数は適していません。

## 使用例

### 配列アクセス

```typescript
const tokens = input.split(",");
if (tokens.length >= 2) {
  const secondToken = unwrapNullish(tokens[1], "safe-array-item-access");
  // secondToken を string として使用
}
```

### Map の lookup

```typescript
const cache = new Map<string, Value>();
// ... cache にデータを追加

if (cache.has(key)) {
  const value = unwrapNullish(cache.get(key), "validated-map-lookup");
  // value を Value として使用
}
```

### 制御フローによる保証

```typescript
let value: string | null = null;

if (condition) {
  value = "initialized";
}

if (condition) {
  // 同じ condition なので value は必ず非 null
  const nonNullValue = unwrapNullish(value, "guaranteed-by-control-flow");
}
```

## まとめ

`unwrapNullish` は、型システムの限界を補い、開発者の意図を明確に表現するためのツールです。適切に使用することで、ツールチェインのコードをより読みやすく、保守しやすくできます。ただし、使用は開発ツールに限定し、エンドユーザーのコードでは従来通りの null チェックを行ってください。
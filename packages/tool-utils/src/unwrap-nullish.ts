/**
 * unwrap-nullish utility
 *
 * このユーティリティは、型的にはnullableであるが、コードの実装上nullishになることがあり得ない値を
 * 安全にunwrapするための関数です。
 *
 * 使用例:
 * - 配列の長さが3以上であることを確認済みの場合、arr[2]はstring | undefinedではなくstringとして扱いたい
 *
 * 重要な制約:
 * - 利用できる理由（fairReasonToStripNullish）は事前に定義されたもののみ
 * - ApprovedFairReasonToStripNullishに定義され、定期的に人間がレビューを行う
 * - AIは必要であればエントリを追加可能
 *
 * 使用制限:
 * - ツールチェイン上でのみ使用すること
 * - soda-gqlを使うアプリケーションのランタイム上で実行されないようにすること
 * - coreパッケージとruntimeパッケージでは絶対に使用しないこと
 */

export class UnwrapNullishError extends Error {
  constructor(fairReasonToStripNullish: string) {
    super(`Value is null or undefined although it was expected to be not null or undefined because: ${fairReasonToStripNullish}`);
    this.name = "UnwrapNullishError";
  }
}

/**
 * 承認済みのnullish除去理由の定義
 *
 * 新しい理由を追加する際は:
 * 1. keyに一意な識別子を設定
 * 2. descriptionに理由の詳細な説明を記載
 * 3. 定期的な人間によるレビューの対象となることを理解する
 */
type ApprovedFairReasonToStripNullish =
  | {
      key: "safe-array-item-access";
      description: "array item access to a non-null-item array that is already validated to have item to target index";
    }
  | {
      key: "validated-map-lookup";
      description: "map lookup that has been previously validated to contain the key";
    }
  | {
      key: "guaranteed-by-control-flow";
      description: "value is guaranteed to be non-null by preceding control flow analysis";
    }
  | {
      key: "validated-string-split";
      description: "string split result that is guaranteed to have expected number of parts";
    };

/**
 * nullishな値を安全にunwrapする関数
 *
 * @param value - unwrapしたい値（nullable）
 * @param fairReasonToStripNullish - nullishでないことが保証される理由（ApprovedFairReasonToStripNullishのkeyを指定）
 * @returns unwrapされた非null値
 * @throws {UnwrapNullishError} 値がnullまたはundefinedの場合
 *
 * @example
 * ```typescript
 * const arr = ["a", "b", "c"];
 * if (arr.length >= 3) {
 *   const thirdItem = unwrapNullish(arr[2], "safe-array-item-access");
 *   // thirdItemはstringとして扱える
 * }
 * ```
 */
export const unwrapNullish = <T>(
  value: T | null | undefined,
  fairReasonToStripNullish: ApprovedFairReasonToStripNullish["key"],
): T => {
  if (value === null || value === undefined) {
    throw new UnwrapNullishError(fairReasonToStripNullish);
  }
  return value;
};
// このファイルはUTF-8マルチバイト文字を含むテストフィクスチャです
// テスト: 非ASCII文字がGraphQLテンプレートの前に存在する場合
import { gql } from "@/graphql-system";

// コメント: ユーザー情報を取得するクエリ 🚀
export const GetUser = gql.default(({ query }) => query`query GetUser($id: ID!) { user(id: $id) { id name } }`);

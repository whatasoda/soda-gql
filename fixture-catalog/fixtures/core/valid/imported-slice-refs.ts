import { gql } from "../../../graphql-system";
import { topLevelModel } from "./common/top-level";

export const pageQuery = gql.default(({ query }) =>
  query("ProfilePageQuery")({
    variables: `($userId: ID!)`,
    fields: ({ f, $ }) => ({ ...f("employee", { id: $.userId })(() => ({ ...topLevelModel.spread() })) }),
  })(),
);

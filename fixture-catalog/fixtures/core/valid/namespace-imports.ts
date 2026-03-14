import { gql } from "../../../graphql-system";
import * as topLevel from "./common/top-level";

export const pageQuery = gql.default(({ query }) =>
  query("ProfilePageQuery")({
    variables: `($userId: ID!)`,
    fields: ({ f, $ }) => ({ ...f("employee", { id: $.userId })(() => ({ ...topLevel.topLevelModel.spread() })) }),
  })(),
);

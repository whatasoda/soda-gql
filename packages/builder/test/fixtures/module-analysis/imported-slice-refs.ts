import { gql } from "../../codegen-fixture/graphql-system";
import { topLevelModel } from "../common/top-level";

export const pageQuery = gql.default(({ query }, { $var }) =>
  query.operation({
    name: "ProfilePageQuery",
    variables: { ...$var("userId").scalar("ID:!") },
    fields: ({ f, $ }) => ({ ...f.user({ id: $.userId })(() => ({ ...topLevelModel.embed() })) }),
  }),
);

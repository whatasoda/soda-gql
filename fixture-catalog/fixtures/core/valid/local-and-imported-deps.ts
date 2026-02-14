import { gql } from "../../../graphql-system";
import { topLevelModel } from "./common/top-level";

export const taskFragment = gql.default(({ fragment }) => fragment`fragment TaskFragment on Task { id }`());

export const pageQuery = gql.default(({ query, $var }) =>
  query.operation({
    name: "PageQuery",
    variables: { ...$var("employeeId").ID("!"), ...$var("taskId").ID("!") },
    fields: ({ f, $ }) => ({
      ...f.employee({ id: $.employeeId })(() => ({ ...topLevelModel.spread() })),
      ...f.task({ id: $.taskId })(() => ({ ...taskFragment.spread() })),
    }),
  }),
);

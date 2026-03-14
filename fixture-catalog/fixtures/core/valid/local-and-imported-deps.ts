import { gql } from "../../../graphql-system";
import { topLevelModel } from "./common/top-level";

export const taskFragment = gql.default(({ fragment }) => fragment("TaskFragment", "Task")`{ id }`());

export const pageQuery = gql.default(({ query }) =>
  query("PageQuery")({
    variables: `($employeeId: ID!, $taskId: ID!)`,
    fields: ({ f, $ }) => ({
      ...f("employee", { id: $.employeeId })(() => ({ ...topLevelModel.spread() })),
      ...f("task", { id: $.taskId })(() => ({ ...taskFragment.spread() })),
    }),
  })(),
);

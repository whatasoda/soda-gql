import { gql } from "../../../graphql-system";
import { topLevelModel } from "./common/top-level";

export const taskFragment = gql.default(({ fragment }) => fragment`fragment TaskFragment on Task { id }`());

export const pageQuery = gql.default(({ query }) =>
  query`query PageQuery($employeeId: ID!, $taskId: ID!) {
    employee(id: $employeeId) { ${topLevelModel} }
    task(id: $taskId) { ${taskFragment} }
  }`(),
);

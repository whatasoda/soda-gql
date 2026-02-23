import { gql } from "../../../graphql-system";

export const user_remoteFragment = {
  forIterate: gql.default(({ fragment }) => fragment("ForIterateFragment", "Employee")`{ id }`()),
};

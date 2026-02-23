import { gql } from "../../../graphql-system";

const config = {
  models: {
    user: gql.default(({ fragment }) => fragment("UserFragment", "Employee")`{ id }`()),
  },
};

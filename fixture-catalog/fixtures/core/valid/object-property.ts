import { gql } from "../../../graphql-system";

const config = {
  models: {
    user: gql.default(({ fragment }) => fragment`fragment UserFragment on Employee { id }`()),
  },
};

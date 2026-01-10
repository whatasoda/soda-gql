import { gql } from "../../graphql-system";

const config = {
  models: {
    user: gql.default(({ fragment }) => fragment.User({ fields: ({ f }) => ({ ...f.id() }) })),
  },
};

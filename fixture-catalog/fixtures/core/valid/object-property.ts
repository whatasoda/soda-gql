import { gql } from "../../../graphql-system";

const config = {
  models: {
    user: gql.default(({ fragment }) => fragment.Employee({ fields: ({ f }) => ({ ...f.id() }) })),
  },
};

import { gql } from "../../../graphql-system";

export const factory = () => {
  return gql.default(({ fragment }) => fragment.User({ fields: ({ f }) => ({ ...f.id() }) }));
};

import { gql } from "../../../graphql-system";

export const factory = () => {
  return gql.default(({ fragment }) => fragment.Employee({ fields: ({ f }) => ({ ...f.id() }) }));
};

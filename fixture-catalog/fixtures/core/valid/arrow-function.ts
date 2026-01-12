import { gql } from "../../../graphql-system";

const factory = () => {
  const fragment = gql.default(({ fragment }) => fragment.Employee({ fields: ({ f }) => ({ ...f.id() }) }));
  return fragment;
};

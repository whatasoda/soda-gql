import { gql } from "../../../graphql-system";

export function getFragment() {
  const fragment = gql.default(({ fragment }) => fragment.Employee({ fields: ({ f }) => ({ ...f.id() }) }));
  return fragment;
}

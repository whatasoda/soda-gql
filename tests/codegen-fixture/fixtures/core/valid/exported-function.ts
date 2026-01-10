import { gql } from "../../graphql-system";

export function getFragment() {
  const fragment = gql.default(({ fragment }) => fragment.User({ fields: ({ f }) => ({ ...f.id() }) }));
  return fragment;
}

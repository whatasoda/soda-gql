// Invalid pattern: gql imported with alias
// The analyzer only recognizes the identifier "gql", not aliases like "g"
import { gql as g } from "../../../../graphql-system";

// This definition will NOT be detected because "g" is not recognized
export const userFragment = g.default(({ fragment }) =>
  fragment.User({ fields: ({ f }) => ({ ...f.id(), ...f.name() }) }),
);

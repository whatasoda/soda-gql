import { gql } from "../../../graphql-system";

const fragment1 = gql.default(({ fragment }) => fragment`fragment Fragment1 on Employee { id }`());
const fragment2 = gql.default(({ fragment }) => fragment`fragment Fragment2 on Employee { id }`());

function factory() {
  const fragment1 = gql.default(({ fragment }) => fragment`fragment InnerFragment1 on Employee { id }`());
  const fragment2 = gql.default(({ fragment }) => fragment`fragment InnerFragment2 on Employee { id }`());
}

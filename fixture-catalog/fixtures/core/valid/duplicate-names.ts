import { gql } from "../../../graphql-system";

const fragment1 = gql.default(({ fragment }) => fragment("Fragment1", "Employee")`{ id }`());
const fragment2 = gql.default(({ fragment }) => fragment("Fragment2", "Employee")`{ id }`());

function factory() {
  const fragment1 = gql.default(({ fragment }) => fragment("InnerFragment1", "Employee")`{ id }`());
  const fragment2 = gql.default(({ fragment }) => fragment("InnerFragment2", "Employee")`{ id }`());
}

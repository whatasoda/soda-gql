import { gql } from "../../../../../graphql-system";

export const userFragment = gql.default(({ fragment }) => fragment("UserFragment", "Employee")`{ id name }`());

export const productFragment = gql.default(({ fragment }) => {
  return fragment("ProductFragment", "Project")`{ id title }`();
});

export const fragments = {
  user: gql.default(({ fragment }) => fragment("UserIdFragment", "Employee")`{ id }`()),
};

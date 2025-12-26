import { gql } from "@/graphql-system";

/**
 * Fragment for UserCard component.
 * Defines the data requirements colocated with the component.
 */
export const userCardFragment = gql.default(({ model }, { $var }) =>
  model.Query({ variables: [$var("userId").scalar("ID:!")] }, ({ f, $ }) => [
    f.user({ id: $.userId })(({ f }) => [f.id(), f.name(), f.email()]),
  ]),
);

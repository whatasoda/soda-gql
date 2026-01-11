import { gql } from "../../../graphql-system";

// Config objects should NOT be touched (variables object)
export const userQuery = gql.default(({ query, $var }) =>
  query.operation({
    name: "GetUser",
    variables: { ...$var("id").ID("!") },
    fields: ({ f, $ }) => ({ ...f.user({ id: $.id })(({ f }) => ({ ...f.id(), ...f.name() })) }),
  }),
);

// Regular arrays outside gql.default should not be touched
const regularArray = [1, 2, 3];
const configArray = { options: ["a", "b", "c"] };

export { regularArray, configArray };

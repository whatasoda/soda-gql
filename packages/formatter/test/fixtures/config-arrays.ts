import { gql } from "@/graphql-system";

// Config objects should NOT be touched (variables object)
export const model = gql.default(({ model }, { $var }) =>
  model.User({ variables: { ...$var("id").scalar("ID:!") }, fields: ({ f }) => ({ ...f.id(), ...f.name() }) }),
);

// Regular arrays outside gql.default should not be touched
const regularArray = [1, 2, 3];
const configArray = { options: ["a", "b", "c"] };

export { regularArray, configArray };

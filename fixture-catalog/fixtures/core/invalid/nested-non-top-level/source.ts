import { gql } from "../../../../graphql-system";

const buildOperation = () => {
  const invalid = gql.default(({ query }) =>
    // @ts-expect-error - Test fixture: options object missing required 'fields' property
    query("InvalidOp")({ variables: `($id: ID!)` })(),
  );
  return invalid;
};

export const userOperation = buildOperation();

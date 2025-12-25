import { gql } from "../../codegen-fixture/graphql-system";

const buildOperation = () => {
  const invalid = gql.default(({ query }) =>
    query.operation(
      { name: "InvalidOp" },
      // @ts-expect-error - Test fixture with invalid arguments
      () => ({}),
    ),
  );
  return invalid;
};

export const userOperation = buildOperation();

import { gql } from "../../../graphql-system";

// Already has newline - should be skipped
export const fragment1 = gql.default(({ fragment }) =>
  fragment.Employee({
    fields: ({ f }) => ({
      ...f.id(),
      ...f.name(),
    }),
  }),
);

// Nested with newlines
export const fragment2 = gql.default(({ fragment }) =>
  fragment.Employee({
    fields: ({ f }) => ({
      ...f.id(),
      ...f.tasks({})(({ f }) => ({
        ...f.id(),
        ...f.title(),
      })),
    }),
  }),
);

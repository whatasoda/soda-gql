import { gql } from "../../../graphql-system";

// Already has newline - should be skipped
export const fragment1 = gql.default(({ fragment }) =>
  fragment.User({
    fields: ({ f }) => ({
      ...f.id(),
      ...f.name(),
    }),
  }),
);

// Nested with newlines
export const fragment2 = gql.default(({ fragment }) =>
  fragment.User({
    fields: ({ f }) => ({
      ...f.id(),
      ...f.posts({})(({ f }) => ({
        ...f.id(),
        ...f.title(),
      })),
    }),
  }),
);

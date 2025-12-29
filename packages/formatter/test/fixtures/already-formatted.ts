import { gql } from "@/graphql-system";

// Already has newline - should be skipped
export const model1 = gql.default(({ model }) =>
  model.User({
    fields: ({ f }) => ({
      ...f.id(),
      ...f.name(),
    }),
  }),
);

// Nested with newlines
export const model2 = gql.default(({ model }) =>
  model.User({
    fields: ({ f }) => ({
      ...f.id(),
      ...f.posts()(({ f }) => ({
        ...f.id(),
        ...f.title(),
      })),
    }),
  }),
);

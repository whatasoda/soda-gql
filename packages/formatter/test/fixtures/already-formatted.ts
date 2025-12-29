import { gql } from "@/graphql-system";

// Already has empty comment - should be skipped
export const model1 = gql.default(({ model }) =>
  model.User({
    fields: ({ f }) => [
      //
      f.id(),
      f.name(),
    ],
  }),
);

// Nested with comments
export const model2 = gql.default(({ model }) =>
  model.User({
    fields: ({ f }) => [
      //
      f.id(),
      f.posts()(({ f }) => [
        //
        f.id(),
        f.title(),
      ]),
    ],
  }),
);

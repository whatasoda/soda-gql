import { gql } from "@/graphql-system";

// Should be formatted - no newline after opening brace
export const model1 = gql.default(({ model }) => model.User({ fields: ({ f }) => ({ ...f.id(), ...f.name() }) }));

// Nested selections also need formatting
export const model2 = gql.default(({ model }) =>
  model.User({ fields: ({ f }) => ({ ...f.id(), ...f.posts()(({ f }) => ({ ...f.id(), ...f.title() })) }) }),
);

// Query operation
export const query1 = gql.default(({ query }) =>
  query.operation({ name: "GetUser", fields: ({ f }) => ({ ...f.user()(({ f }) => ({ ...f.id(), ...f.name() })) }) }),
);

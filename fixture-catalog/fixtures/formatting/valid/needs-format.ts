import { gql } from "../../../graphql-system";

// Should be formatted - no newline after opening brace
export const fragment1 = gql.default(({ fragment }) => fragment.User({ fields: ({ f }) => ({ ...f.id(), ...f.name() }) }));

// Nested selections also need formatting
export const fragment2 = gql.default(({ fragment }) =>
  fragment.User({ fields: ({ f }) => ({ ...f.id(), ...f.posts({})(({ f }) => ({ ...f.id(), ...f.title() })) }) }),
);

// Query operation
export const query1 = gql.default(({ query }) =>
  query.operation({ name: "GetUsers", fields: ({ f }) => ({ ...f.users({})(({ f }) => ({ ...f.id(), ...f.name() })) }) }),
);

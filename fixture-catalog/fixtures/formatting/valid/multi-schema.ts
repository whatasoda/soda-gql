import { gql } from "../../../graphql-system";

// Multi-schema: admin schema (should be formatted)
export const adminFragment = gql.admin(({ fragment }) => fragment.Task({ fields: ({ f }) => ({ ...f.id(), ...f.title() }) }));

// Multi-schema: default schema (should still work)
export const defaultQuery = gql.default(({ query }) =>
  query.operation({
    name: "GetData",
    fields: ({ f }) => ({ ...f.employees({})(({ f }) => ({ ...f.id() })) }),
  }),
);

// Multi-schema: nested selections (Task has id, title, completed - no description)
export const nestedAdmin = gql.admin(({ fragment }) =>
  fragment.Task({ fields: ({ f }) => ({ ...f.id(), ...f.title(), ...f.completed() }) }),
);

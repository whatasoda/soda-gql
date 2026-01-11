import { gql } from "../../../graphql-system";

export const adminFragment = gql.admin(({ fragment }) => fragment.Employee({ fields: ({ f }) => ({ ...f.id(), ...f.name() }) }));

export const defaultQuery = gql.default(({ query }) =>
  query.operation({
    name: "DefaultData",
    fields: ({ f }) => ({ ...f.employees({})(({ f }) => ({ ...f.id() })) }),
  }),
);

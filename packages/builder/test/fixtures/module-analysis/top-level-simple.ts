import { gql } from "../../codegen-fixture/graphql-system";

export const userFragment = gql.default(({ fragment }) => fragment.User({ fields: ({ f }) => [f.id()] }));

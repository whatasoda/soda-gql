import { gql } from "../../codegen-fixture/graphql-system";

export const userFragment = gql.default(({ fragment }) => fragment.User({}, ({ f }) => [f.id()]));

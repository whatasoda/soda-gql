import { gql } from "../../../codegen-fixture/graphql-system";

export const postModel = gql.default(({ model }) => model.Post({}, ({ f }) => [f.id(), f.title(), f.body()]));

import { gql } from "../../codegen-fixture/graphql-system";

export const user_remoteModel = {
  forIterate: gql.default(({ model }) => model.User({}, ({ f }) => [f.id()])),
};

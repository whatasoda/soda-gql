import { gql } from "../../codegen-fixture/graphql-system";

export const user_remoteFragment = {
  forIterate: gql.default(({ fragment }) => fragment.User({}, ({ f }) => [f.id()])),
};

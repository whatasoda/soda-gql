import { gql } from "../../../graphql-system";

export const user_remoteFragment = {
  forIterate: gql.default(({ fragment }) => fragment`fragment ForIterateFragment on Employee { id }`()),
};

import { gql } from "../../../graphql-system";

export const user_remoteFragment = {
  forIterate: gql.default(({ fragment }) => fragment.User({ fields: ({ f }) => ({ ...f.id() }) })),
};

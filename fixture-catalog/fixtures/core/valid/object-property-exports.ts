import { gql } from "../../../graphql-system";

export const user_remoteFragment = {
  forIterate: gql.default(({ fragment }) => fragment.Employee({ fields: ({ f }) => ({ ...f.id() }) })),
};

import { gql } from "../graphql-system";

export const anonymousFragment = gql.default(({ fragment }) => fragment("AnonymousUserFields", "User")`{ id }`());

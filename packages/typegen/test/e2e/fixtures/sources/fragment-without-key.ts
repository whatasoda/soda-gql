import { gql } from "../graphql-system";

export const anonymousFragment = gql.default(({ fragment }) => fragment`fragment AnonymousUserFields on User { id }`());

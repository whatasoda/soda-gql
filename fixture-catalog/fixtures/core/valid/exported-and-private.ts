import { gql } from "../../../graphql-system";

export const userFragment = gql.default(({ fragment }) => fragment`fragment UserFragment on Employee { id }`());

const privateFragment = gql.default(({ fragment }) => fragment`fragment PrivateFragment on Employee { id }`());

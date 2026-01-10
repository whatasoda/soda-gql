import { gql } from "../../graphql-system";

const { attach } = gql.default(({ fragment }) => fragment.User({ fields: ({ f }) => ({ ...f.id() }) }));

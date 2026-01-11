import { gql } from "../../../graphql-system";

const { attach } = gql.default(({ fragment }) => fragment.Employee({ fields: ({ f }) => ({ ...f.id() }) }));

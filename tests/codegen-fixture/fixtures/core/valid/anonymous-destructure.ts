import { gql } from "../../codegen-fixture/graphql-system";

const { attach } = gql.default(({ fragment }) => fragment.User({ fields: ({ f }) => ({ ...f.id() }) }));

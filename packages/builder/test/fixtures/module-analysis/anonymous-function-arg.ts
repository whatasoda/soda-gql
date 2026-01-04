import { gql } from "../../codegen-fixture/graphql-system";

declare function someFunction(fragment: unknown): void;

someFunction(gql.default(({ fragment }) => fragment.User({ fields: ({ f }) => ({ ...f.id() }) })));

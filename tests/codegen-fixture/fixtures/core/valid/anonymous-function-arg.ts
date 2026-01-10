import { gql } from "../../../graphql-system";

declare function someFunction(fragment: unknown): void;

someFunction(gql.default(({ fragment }) => fragment.User({ fields: ({ f }) => ({ ...f.id() }) })));

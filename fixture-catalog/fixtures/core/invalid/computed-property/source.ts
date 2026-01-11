// Invalid pattern: computed property access
// Must use static property access like gql.default, not gql["default"] or gql[variable]
import { gql } from "../../../../graphql-system";

const schemaName = "default";

// This call is invalid - computed property access not supported
// @ts-expect-error - intentionally invalid for testing
export const dynamicSchema = gql[schemaName](({ fragment }) =>
  fragment.User({ fields: ({ f }) => ({ ...f.id() }) }),
);

// Even string literal computed access is not supported
// @ts-expect-error - intentionally invalid for testing
export const literalComputed = gql["default"](({ fragment }) =>
  fragment.User({ fields: ({ f }) => ({ ...f.name() }) }),
);

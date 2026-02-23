// Invalid pattern: computed property access
// Must use static property access like gql.default, not gql["default"] or gql[variable]
import { gql } from "../../../../graphql-system";

const schemaName = "default";

// This call is invalid - computed property access not supported
export const dynamicSchema = gql[schemaName](({ fragment }) =>
  fragment("DynamicSchema", "Employee")`{ id }`(),
);

// Even string literal computed access is not supported
export const literalComputed = gql["default"](({ fragment }) =>
  fragment("LiteralComputed", "Employee")`{ name }`(),
);

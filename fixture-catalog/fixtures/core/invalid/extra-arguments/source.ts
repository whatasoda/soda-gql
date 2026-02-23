// Invalid pattern: extra arguments passed to gql call
// gql.default() only accepts one arrow function argument
import { gql } from "../../../../graphql-system";

const extraArg = { cache: true };

// This call is invalid - extra arguments are ignored
// @ts-expect-error - intentionally invalid for testing (extra args not allowed by type)
export const extraArguments = gql.default(({ fragment }) => fragment("ExtraArguments", "Employee")`{ id }`(), extraArg);

// Multiple extra arguments
// @ts-expect-error - intentionally invalid for testing (extra args not allowed by type)
export const multipleExtras = gql.default(({ fragment }) => fragment("MultipleExtras", "Employee")`{ name }`(), "option1", "option2");

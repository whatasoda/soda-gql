// Invalid pattern: gql.default() called with wrong argument type
// The first argument must be an arrow function, not a string/object/etc
import { gql } from "../../../../graphql-system";

// This call is invalid - string instead of arrow function
// @ts-expect-error - intentionally invalid for testing
export const wrongTypeCall = gql.default("not a function");

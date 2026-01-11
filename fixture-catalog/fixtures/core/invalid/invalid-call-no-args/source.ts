// Invalid pattern: gql.default() called with no arguments
// The first argument must be an arrow function factory
import { gql } from "../../../../graphql-system";

// This call is invalid - missing required factory argument
// @ts-expect-error - intentionally invalid for testing
export const noArgCall = gql.default();

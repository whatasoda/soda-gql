// Invalid pattern: spread arguments in gql call
// Cannot statically analyze spread arguments
import { gql } from "../../../../graphql-system";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const args = [({ fragment }: any) => fragment.Employee({ fields: ({ f }: any) => ({ ...f.id() }) })];

// This call is invalid - spread arguments cannot be statically analyzed
// @ts-expect-error - intentionally invalid for testing
export const spreadArgument = gql.default(...args);

import type { GqlElementAttachment } from "@soda-gql/core";
import { gql } from "../../../graphql-system";

// Helper type for attachment fixtures
type TestAttachment<T extends object> = GqlElementAttachment<T, "test", { value: number }>;
const testAttachment = <T extends object>(): TestAttachment<T> => ({
  name: "test",
  createValue: () => ({ value: 1 }),
});

// Simple .attach() chaining
export const simpleAttach = gql
  .default(({ fragment }) => fragment`fragment SimpleAttach on Employee { id }`())
  .attach(testAttachment());

// Multiple .attach() chains
export const multipleAttach = gql
  .default(({ fragment }) => fragment`fragment MultipleAttach on Employee { id name }`())
  .attach(testAttachment())
  .attach({ name: "second", createValue: () => ({ b: 2 }) });

// Operation with .attach()
export const operationAttach = gql
  .default(({ query }) =>
    query.operation({ name: "GetUser", fields: ({ f }) => ({ ...f.employee({ id: "1" })(({ f }) => ({ ...f.id() })) }) }),
  )
  .attach(testAttachment());

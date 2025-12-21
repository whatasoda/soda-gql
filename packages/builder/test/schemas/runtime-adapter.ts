import { createRuntimeAdapter } from "@soda-gql/runtime";

export const adapter = createRuntimeAdapter(({ type }) => ({
  nonGraphqlErrorType: type<{ type: "non-graphql-error"; cause: unknown }>(),
}));

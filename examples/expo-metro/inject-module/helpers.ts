import { defineHelpers } from "@soda-gql/core";

export const helpers = defineHelpers({
  auth: {
    withAuth: (token: string) => ({
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }),
  },
  cache: {
    withCache: (maxAge: number) => ({
      headers: {
        "Cache-Control": `max-age=${maxAge}`,
      },
    }),
  },
});

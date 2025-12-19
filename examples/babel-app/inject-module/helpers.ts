import { defineHelpers } from "@soda-gql/core";

export const helpers = defineHelpers({
  auth: {
    requiresLogin: () => ({ requiresAuth: true as const }),
    adminOnly: () => ({ requiresAuth: true as const, role: "admin" as const }),
  },
  cache: {
    ttl: (seconds: number) => ({ cacheTTL: seconds }),
  },
});

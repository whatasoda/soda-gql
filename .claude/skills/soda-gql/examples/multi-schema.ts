/**
 * Multi-Schema Configuration Example
 *
 * Configure and use multiple GraphQL schemas in a single project.
 * Each schema has its own types, scalars, and operations.
 */

// ============================================
// soda-gql.config.ts
// ============================================
/*
import { defineConfig } from "@soda-gql/config";

export default defineConfig({
  outdir: "./src/graphql-system",
  include: ["./src/**\/*.ts"],
  schemas: {
    // Default schema for main API
    default: {
      schema: "./schemas/main.graphql",
      inject: "./src/graphql-system/default.inject.ts",
    },
    // Admin schema for admin API
    admin: {
      schema: "./schemas/admin.graphql",
      inject: "./src/graphql-system/admin.inject.ts",
    },
    // External schema for third-party API
    external: {
      schema: "./schemas/external.graphql",
      inject: "./src/graphql-system/external.inject.ts",
    },
  },
});
*/

// ============================================
// Usage in application code
// ============================================
import { gql } from "@/graphql-system";

// Operations using the default schema
export const getUserQuery = gql.default(({ query, $var }) =>
  query.operation({
    name: "GetUser",
    variables: { ...$var("id").ID("!") },
    fields: ({ f, $ }) => ({
      ...f.user({ id: $.id })(({ f }) => ({
        ...f.id(),
        ...f.name(),
        ...f.email(),
      })),
    }),
  }),
);

// Operations using the admin schema
export const getAdminUsersQuery = gql.admin(({ query, $var }) =>
  query.operation({
    name: "GetAdminUsers",
    variables: {
      ...$var("role").String("?"),
      ...$var("limit").Int("?"),
    },
    fields: ({ f, $ }) => ({
      ...f.adminUsers({ role: $.role, limit: $.limit })(({ f }) => ({
        ...f.id(),
        ...f.email(),
        ...f.role(),
        ...f.permissions()(({ f }) => ({
          ...f.name(),
          ...f.level(),
        })),
        ...f.lastLoginAt(),
      })),
    }),
  }),
);

// Operations using the external schema
export const getExternalProductsQuery = gql.external(({ query, $var }) =>
  query.operation({
    name: "GetExternalProducts",
    variables: { ...$var("category").String("!") },
    fields: ({ f, $ }) => ({
      ...f.products({ category: $.category })(({ f }) => ({
        ...f.sku(),
        ...f.name(),
        ...f.price(),
        ...f.inventory(),
      })),
    }),
  }),
);

// Each schema has its own types
type UserResult = typeof getUserQuery.$infer.output.projected;
type AdminUsersResult = typeof getAdminUsersQuery.$infer.output.projected;
type ProductsResult = typeof getExternalProductsQuery.$infer.output.projected;

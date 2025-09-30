// Example: Using Multiple GraphQL Schemas with soda-gql

import { gql } from "@/graphql-system";

// ============================================
// Using the default schema
// ============================================

// Define a model for User from the default schema
export const UserModel = gql.default(({ model, scalar }) =>
  model("User", ({ f }) => ({
    id: f.id(),
    name: f.name(),
    email: f.email(),
    // Only fetch posts when explicitly needed
    posts: f.posts({ model: PostModel }),
  })),
);

// Define a model for Post from the default schema
export const PostModel = gql.default(({ model }) =>
  model("Post", ({ f }) => ({
    id: f.id(),
    title: f.title(),
    content: f.content(),
    publishedAt: f.publishedAt(),
    author: f.author({ model: UserModel }),
  })),
);

// Create a query slice for user operations
export const userSlice = gql.default(({ querySlice }) =>
  querySlice({
    getUserWithPosts: ({ query }, userId: string) => query({ user: { $: { id: userId }, ...UserModel } }),

    getRecentPosts: ({ query }, limit: number) => query({ posts: { $: { limit }, ...PostModel } }),
  }),
);

// ============================================
// Using the admin schema
// ============================================

// Define models for admin entities
export const AdminUserModel = gql.admin(({ model }) =>
  model("AdminUser", ({ f }) => ({
    id: f.id(),
    username: f.username(),
    email: f.email(),
    role: f.role(),
    permissions: f.permissions({ model: PermissionModel }),
    lastLogin: f.lastLogin(),
  })),
);

export const PermissionModel = gql.admin(({ model }) =>
  model("Permission", ({ f }) => ({
    id: f.id(),
    name: f.name(),
    resource: f.resource(),
    action: f.action(),
  })),
);

// Admin-specific query slice
export const adminSlice = gql.admin(({ querySlice }) =>
  querySlice({
    getAdminDashboard: ({ query }) =>
      query({
        systemStats: {
          totalUsers: true,
          totalPosts: true,
          activeUsers: true,
          serverUptime: true,
        },
        allAdminUsers: AdminUserModel,
      }),

    getAuditLogs: ({ query }, limit: number) =>
      query({
        auditLogs: {
          $: { limit },
          id: true,
          action: true,
          resource: true,
          timestamp: true,
          user: {
            id: true,
            username: true,
          },
        },
      }),
  }),
);

// Admin mutations
export const adminMutations = gql.admin(({ query, model }) => ({
  createAdmin: (username: string, email: string, role: string) =>
    query({
      createAdminUser: {
        $: { username, email, role },
        ...AdminUserModel,
      },
    }),

  deleteUser: (userId: string) =>
    query({
      deleteUser: { $: { id: userId } },
    }),
}));

// ============================================
// Using short schema names
// ============================================

// You can also use short names like "_" for convenience
export const PublicUserModel = gql._(({ model }) =>
  model("User", ({ f }) => ({
    id: f.id(),
    name: f.name(),
    // Public schema might have limited fields
  })),
);

// ============================================
// Usage in components/services
// ============================================

async function _fetchUserDashboard(userId: string) {
  // Use the default schema for user data
  const userData = await userSlice.getUserWithPosts(userId);

  // Use the admin schema for admin data
  const adminData = await adminSlice.getAdminDashboard();

  return {
    user: userData.user,
    stats: adminData.systemStats,
  };
}

async function _createNewAdmin(username: string, email: string) {
  // Use admin schema mutations
  const newAdmin = await adminMutations.createAdmin(username, email, "MODERATOR");

  return newAdmin.createAdminUser;
}

// ============================================
// Migration from single-schema
// ============================================

// Before (single schema):
// const user = gql.model("User", /* ... */);

// After (multi-schema):
// const user = gql.default(({ model }) => model("User", /* ... */));

// The pattern ensures:
// 1. Each schema has completely isolated types
// 2. No accidental mixing of types between schemas
// 3. Clear indication of which schema is being used
// 4. Zero-runtime overhead (all resolved at build time)

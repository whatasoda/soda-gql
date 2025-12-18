import { join } from "node:path";
import type { ResolvedSodaGqlConfig } from "../../packages/config/src/types";

/**
 * Create a test config for integration tests.
 * Uses mock values suitable for temporary test workspaces.
 */
export const createTestConfig = (
  workspaceRoot: string,
  options?: { graphqlSystemAliases?: readonly string[] },
): ResolvedSodaGqlConfig => ({
  analyzer: "ts" as const,
  outdir: join(workspaceRoot, "graphql-system"),
  graphqlSystemAliases: options?.graphqlSystemAliases ?? ["@/graphql-system"],
  include: [join(workspaceRoot, "src/**/*.ts")],
  exclude: [],
  schemas: {
    default: {
      schema: join(workspaceRoot, "schema.graphql"),
      runtimeAdapter: join(workspaceRoot, "inject/runtime-adapter.ts"),
      scalars: join(workspaceRoot, "inject/scalars.ts"),
    },
  },
  styles: {
    importExtension: false,
  },
  plugins: {},
});

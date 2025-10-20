import { join } from "node:path";
import type { ResolvedSodaGqlConfig } from "../../packages/config/src/types";

/**
 * Create a test config for integration tests.
 * Uses mock values suitable for temporary test workspaces.
 */
export const createTestConfig = (
  workspaceRoot: string,
  options?: { graphqlSystemAlias?: string },
): ResolvedSodaGqlConfig => ({
  graphqlSystemPath: join(workspaceRoot, "graphql-system", "index.cjs"),
  graphqlSystemAlias: options?.graphqlSystemAlias ?? "@/graphql-system",
  corePath: "@soda-gql/core",
  builder: {
    entry: [join(workspaceRoot, "src/**/*.ts")],
    outDir: join(workspaceRoot, ".cache/soda-gql"),
    analyzer: "ts" as const,
  },
  codegen: {
    schema: join(workspaceRoot, "schema.graphql"),
    outDir: join(workspaceRoot, "graphql-system"),
  },
  plugins: {},
  configDir: workspaceRoot,
  configPath: join(workspaceRoot, "soda-gql.config.ts"),
  configHash: `test-${Date.now()}`,
  configMtime: Date.now(),
});

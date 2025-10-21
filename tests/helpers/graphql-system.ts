import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { runMultiSchemaCodegen } from "@soda-gql/codegen";
import { getDefaultRuntimeAdapterPath, getDefaultScalarPath } from "../fixtures/inject-module";

export type EnsureGraphqlSystemBundleOptions = {
  /**
   * Path to the output TypeScript file (e.g., /tmp/graphql-system/index.ts)
   */
  readonly outFile: string;

  /**
   * Path to the GraphQL schema file
   */
  readonly schemaPath: string;

  /**
   * Optional: Path to custom runtime adapter module.
   * If not provided, uses the default fixture.
   */
  readonly runtimeAdapterPath?: string;

  /**
   * Optional: Path to custom scalar module.
   * If not provided, uses the default fixture.
   */
  readonly scalarPath?: string;
};

export type EnsureGraphqlSystemBundleResult = {
  /**
   * Path to the generated TypeScript file
   */
  readonly outPath: string;

  /**
   * Path to the generated CJS bundle
   */
  readonly cjsPath: string;
};

/**
 * Test helper that generates both graphql-system/index.ts and graphql-system/index.cjs
 * using the production codegen pipeline.
 *
 * This ensures tests have the complete bundle that the builder expects when
 * resolving graphqlSystemPath to a .cjs file.
 *
 * @example
 * ```ts
 * const tmpDir = join(tmpRoot, `test-${Date.now()}`);
 * const graphqlSystemDir = join(tmpDir, "graphql-system");
 * const outFile = join(graphqlSystemDir, "index.ts");
 * const schemaPath = join(fixturesRoot, "schema.graphql");
 *
 * const { cjsPath } = await ensureGraphqlSystemBundle({
 *   outFile,
 *   schemaPath,
 * });
 *
 * // Now both index.ts and index.cjs exist
 * expect(await Bun.file(outFile).exists()).toBe(true);
 * expect(await Bun.file(cjsPath).exists()).toBe(true);
 * ```
 */
export const ensureGraphqlSystemBundle = async (
  options: EnsureGraphqlSystemBundleOptions,
): Promise<EnsureGraphqlSystemBundleResult> => {
  const { outFile, schemaPath, runtimeAdapterPath, scalarPath } = options;

  // Ensure output directory exists
  mkdirSync(dirname(outFile), { recursive: true });

  // Use default fixtures if custom paths not provided
  const adapterPath = runtimeAdapterPath ?? getDefaultRuntimeAdapterPath();
  const scalarModulePath = scalarPath ?? getDefaultScalarPath();

  // Run codegen with multi-schema format (production pipeline)
  const result = await runMultiSchemaCodegen({
    schemas: { default: schemaPath },
    outPath: outFile,
    format: "json",
    runtimeAdapters: { default: adapterPath },
    scalars: { default: scalarModulePath },
  });

  if (result.isErr()) {
    throw new Error(`Failed to generate graphql-system bundle: ${result.error.code} - ${result.error.message}`);
  }

  return {
    outPath: result.value.outPath,
    cjsPath: result.value.cjsPath,
  };
};

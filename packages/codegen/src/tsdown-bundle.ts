import { dirname, extname } from "node:path";
import { err, ok, type Result } from "neverthrow";
import type { Options } from "tsdown";
import type { CodegenError } from "./types";

export type BundleResult = {
  readonly cjsPath: string;
};

export const bundleGraphqlSystem = async (sourcePath: string): Promise<Result<BundleResult, CodegenError>> => {
  try {
    // Dynamic import to support CJS builds (tsdown is ESM-only)
    const { build } = await import("tsdown");

    const sourceDir = dirname(sourcePath);
    const sourceExt = extname(sourcePath);
    const baseName = sourcePath.slice(0, -sourceExt.length);

    await build({
      config: false,
      entry: sourcePath,
      format: ["cjs"],
      platform: "node",
      external: ["@soda-gql/core", "@soda-gql/runtime"],
      dts: false,
      outDir: sourceDir,
      fixedExtension: true,
      clean: false,
      minify: false,
      sourcemap: false,
      treeshake: false,
    } satisfies Options);

    const cjsPath = `${baseName}.cjs`;

    return ok({ cjsPath });
  } catch (error) {
    return err({
      code: "EMIT_FAILED",
      message: `Failed to bundle graphql-system: ${error instanceof Error ? error.message : String(error)}`,
      outPath: sourcePath,
    });
  }
};

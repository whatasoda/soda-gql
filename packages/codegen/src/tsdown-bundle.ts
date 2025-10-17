import { dirname, extname } from "node:path";
import { err, ok, type Result } from "neverthrow";
import { build } from "tsdown";
import type { CodegenError } from "./types";

export type BundleResult = {
  readonly cjsPath: string;
  readonly dtsPath: string;
};

export const bundleGraphqlSystem = async (sourcePath: string): Promise<Result<BundleResult, CodegenError>> => {
  try {
    const sourceDir = dirname(sourcePath);
    const sourceExt = extname(sourcePath);
    const baseName = sourcePath.slice(0, -sourceExt.length);

    await build({
      entry: sourcePath,
      format: ["cjs"],
      platform: "node",
      external: ["@soda-gql/core", "@soda-gql/runtime"],
      dts: {
        entry: sourcePath,
        resolve: true,
      },
      outDir: sourceDir,
      clean: false,
      minify: false,
      sourcemap: false,
      treeshake: false,
      logLevel: "silent",
    });

    const cjsPath = `${baseName}.cjs`;
    const dtsPath = `${baseName}.d.ts`;

    return ok({
      cjsPath,
      dtsPath,
    });
  } catch (error) {
    return err({
      code: "EMIT_FAILED",
      message: `Failed to bundle graphql-system: ${error instanceof Error ? error.message : String(error)}`,
      outPath: sourcePath,
    });
  }
};

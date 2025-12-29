import { extname } from "node:path";
import { build } from "esbuild";
import { err, ok } from "neverthrow";
import type { Bundler } from "./types";

export const esbuildBundler: Bundler = {
  name: "esbuild",
  bundle: async ({ sourcePath, external }) => {
    try {
      const sourceExt = extname(sourcePath);
      const baseName = sourcePath.slice(0, -sourceExt.length);
      const cjsPath = `${baseName}.cjs`;

      await build({
        entryPoints: [sourcePath],
        outfile: cjsPath,
        format: "cjs",
        platform: "node",
        bundle: true,
        external: [...external],
        sourcemap: false,
        minify: false,
        treeShaking: false,
      });

      return ok({ cjsPath });
    } catch (error) {
      return err({
        code: "EMIT_FAILED" as const,
        message: `[esbuild] Failed to bundle: ${error instanceof Error ? error.message : String(error)}`,
        outPath: sourcePath,
      });
    }
  },
};

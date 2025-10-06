import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { getPortableFS } from "@soda-gql/common";
import { transformSync } from "@swc/core";
import { err, ok, type Result } from "neverthrow";
import type { BuilderError } from "../../types";

/**
 * Generate a unique filename for the intermediate module.
 */
export const generateIntermediateFileName = (): string => {
  return `intermediate-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
};

export type EmitIntermediateModuleInput = {
  readonly outDir: string;
  readonly sourceCode: string;
};

export type EmitIntermediateModuleOutput = {
  readonly transpiledPath: string;
  readonly fileName: string;
};

/**
 * Emit the intermediate module by transpiling with SWC and writing to disk.
 */
export const emitIntermediateModule = async ({
  outDir,
  sourceCode,
}: EmitIntermediateModuleInput): Promise<Result<EmitIntermediateModuleOutput, BuilderError>> => {
  // Create output directory
  try {
    mkdirSync(outDir, { recursive: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return err({
      code: "WRITE_FAILED",
      message,
      outPath: outDir,
    });
  }

  const fileName = generateIntermediateFileName();
  const jsFilePath = join(outDir, `${fileName}.mjs`);

  // Transpile TypeScript to JavaScript using SWC
  let transpiledCode: string;
  try {
    const result = transformSync(sourceCode, {
      filename: `${fileName}.ts`,
      jsc: {
        parser: {
          syntax: "typescript",
          tsx: false,
        },
        target: "es2022",
      },
      module: {
        type: "es6",
      },
      sourceMaps: false,
      minify: false,
    });
    transpiledCode = result.code;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return err({
      code: "MODULE_EVALUATION_FAILED",
      filePath: jsFilePath,
      astPath: "",
      message: `SWC transpilation failed: ${message}`,
    });
  }

  // Write transpiled code to disk
  try {
    const fs = getPortableFS();
    await fs.writeFile(jsFilePath, transpiledCode);
    return ok({ transpiledPath: jsFilePath, fileName });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return err({
      code: "WRITE_FAILED",
      message,
      outPath: jsFilePath,
    });
  }
};

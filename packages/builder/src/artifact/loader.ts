import { pathToFileURL } from "node:url";
import { err, ok, type Result } from "neverthrow";
import type { IntermediateModule } from "../intermediate-module";
import type { BuilderError } from "../types";

export const loadIntermediateModule = async (
  intermediateModulePath: string,
): Promise<Result<IntermediateModule, BuilderError>> => {
  try {
    const module = (await import(pathToFileURL(intermediateModulePath).href)) as IntermediateModule;
    return ok(module);
  } catch (error) {
    return err({
      code: "MODULE_EVALUATION_FAILED",
      filePath: intermediateModulePath,
      astPath: "runtime",
      message: error instanceof Error ? error.message : String(error),
    });
  }
};

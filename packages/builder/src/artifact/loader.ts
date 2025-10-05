import { pathToFileURL } from "node:url";
import { getPseudoModuleRegistry } from "@soda-gql/core";
import { err, ok, type Result } from "neverthrow";
import type { IntermediateModuleOutput, IntermediateModuleRaw } from "../intermediate-module/types";
import type { BuilderError } from "../types";

export const loadIntermediateModule = async (
  intermediateModulePath: string,
): Promise<Result<IntermediateModuleRaw, BuilderError>> => {
  try {
    // Add cache-busting query parameter to force fresh import
    const url = pathToFileURL(intermediateModulePath);
    url.searchParams.set("t", Date.now().toString());
    const module = (await import(url.href)) as IntermediateModuleRaw;
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

export const loadIntermediateModules = async ({
  chunkPaths,
  evaluatorId,
}: {
  chunkPaths: Map<string, string>;
  evaluatorId: string;
}): Promise<Result<IntermediateModuleOutput, BuilderError>> => {
  try {
    for (const [_chunkId, transpiledPath] of chunkPaths.entries()) {
      const moduleResult = await loadIntermediateModule(transpiledPath);
      if (moduleResult.isErr()) {
        return err(moduleResult.error);
      }
    }

    const registry = getPseudoModuleRegistry(evaluatorId);

    return ok({ elements: registry.evaluate() });
  } catch (error) {
    return err({
      code: "MODULE_EVALUATION_FAILED",
      filePath: "",
      astPath: "runtime",
      message: error instanceof Error ? error.message : String(error),
    });
  }
};

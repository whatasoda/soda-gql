import { createHash } from "node:crypto";
import { Script } from "node:vm";
import { transformSync } from "@swc/core";
import { err, ok, type Result } from "neverthrow";
import type { ModuleAnalysis } from "../../ast";
import type { BuilderError } from "../../errors";
import { renderRegistryBlock } from "./codegen";
import type { IntermediateModule } from "./types";


export type BuildIntermediateModulesInput = {
  readonly analyses: Map<string, ModuleAnalysis>;
  readonly targetPaths: Set<string>;
};

/**
 * Compute a stable content hash for chunk source code.
 */
const computeContentHash = (sourceCode: string): string => {
  return createHash("sha256").update(sourceCode).digest("hex").slice(0, 16);
};

const transpile = ({
  filePath,
  sourceCode,
  contentHash,
}: {
  filePath: string;
  sourceCode: string;
  contentHash: string;
}): Result<string, BuilderError> => {
  try {
    const result = transformSync(sourceCode, {
      filename: `${contentHash}.ts`,
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

    return ok(result.code);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return err({
      code: "RUNTIME_MODULE_LOAD_FAILED",
      filePath: filePath,
      astPath: "",
      message: `SWC transpilation failed: ${message}`,
    });
  }
};

/**
 * Build intermediate modules from dependency graph.
 * Each intermediate module corresponds to one source file.
 */
export const buildIntermediateModules = ({ analyses, targetPaths }: BuildIntermediateModulesInput): Map<string, IntermediateModule> => {
  const intermediateModules = new Map<string, IntermediateModule>();

  for (const filePath of targetPaths) {
    const analysis = analyses.get(filePath);
    if (!analysis) {
      continue;
    }

    // Get canonical IDs for this intermediate module
    const canonicalIds = analysis.definitions.map(({ canonicalId }) => canonicalId);

    // Generate source code for this intermediate module
    const sourceCode = renderRegistryBlock({ filePath, analysis, analyses });

    // Compute content hash
    const contentHash = computeContentHash(sourceCode);

    // Transpile TypeScript to JavaScript using SWC
    const transpiledCodeResult = transpile({ filePath, sourceCode, contentHash });
    if (transpiledCodeResult.isErr()) {
      // error
      continue;
    }
    const transpiledCode = transpiledCodeResult.value;

    const script = new Script(transpiledCode);

    intermediateModules.set(filePath, {
      filePath,
      contentHash,
      canonicalIds,
      sourceCode,
      transpiledCode,
      script,
    });
  }

  return intermediateModules;
};

import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { createContext, Script } from "node:vm";
import { createPseudoModuleRegistry } from "@soda-gql/core";
import { transformSync } from "@swc/core";
import { err, ok, type Result } from "neverthrow";
import type { ModuleAnalysis } from "../../ast";
import type { BuilderError } from "../../errors";
import { renderRegistryBlock } from "./codegen";
import type { IntermediateModule } from "./types";

export type BuildIntermediateModulesInput = {
  readonly analyses: Map<string, ModuleAnalysis>;
  readonly targetFilePaths: Set<string>;
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
export const generateIntermediateModules = function* ({
  analyses,
  targetFilePaths,
}: BuildIntermediateModulesInput): Generator<IntermediateModule, void, undefined> {
  for (const filePath of targetFilePaths) {
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

    yield {
      filePath,
      contentHash,
      canonicalIds,
      sourceCode,
      transpiledCode,
      script,
    };
  }
};

export const evaluateIntermediateModules = async ({
  intermediateModules,
  graphqlSystemPath,
}: {
  intermediateModules: Map<string, IntermediateModule>;
  graphqlSystemPath: string;
}) => {
  // Determine import paths from config
  const registry = createPseudoModuleRegistry();
  const gqlImportPath = resolve(process.cwd(), graphqlSystemPath);

  const vmContext = createContext({
    ...(await import(gqlImportPath)),
    registry,
  });

  for (const { script, filePath } of intermediateModules.values()) {
    try {
      script.runInContext(vmContext);
    } catch (error) {
      console.error(`Error evaluating intermediate module ${filePath}:`, error);
      throw error;
    }
  }

  const elements = registry.evaluate();
  registry.clear();

  return elements;
};

import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { extname, resolve } from "node:path";
import { createContext, Script } from "node:vm";
import { createPseudoModuleRegistry } from "@soda-gql/core";
import { transformSync } from "@swc/core";
import { err, ok, type Result } from "neverthrow";
import type { ModuleAnalysis } from "../ast";
import type { BuilderError } from "../errors";
import { renderRegistryBlock } from "./codegen";
import type { IntermediateModule } from "./types";

export type BuildIntermediateModulesInput = {
  readonly analyses: Map<string, ModuleAnalysis>;
  readonly targetFiles: Set<string>;
};

const transpile = ({ filePath, sourceCode }: { filePath: string; sourceCode: string }): Result<string, BuilderError> => {
  try {
    const result = transformSync(sourceCode, {
      filename: `${filePath}.ts`,
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
 * Load GraphQL system module synchronously from CJS bundle.
 * Converts .ts/.mts paths to .cjs and uses createRequire for loading.
 * This is cached per session to avoid re-loading.
 */
let cachedGqlModule: unknown = null;
let cachedModulePath: string | null = null;

function loadGraphqlSystemModule(modulePath: string): unknown {
  // Use cached module if same path
  if (cachedModulePath === modulePath && cachedGqlModule !== null) {
    return cachedGqlModule;
  }

  // Convert source path to CJS path
  const ext = extname(modulePath);
  let cjsPath: string;

  if (ext === ".ts" || ext === ".mts") {
    // Replace extension with .cjs
    cjsPath = modulePath.slice(0, -ext.length) + ".cjs";
  } else if (ext === ".cjs") {
    // Already CJS
    cjsPath = modulePath;
  } else {
    throw new Error(
      `Invalid graphql-system module path: ${modulePath}. Expected .ts, .mts, or .cjs extension. ` +
        `Make sure codegen has generated the CJS bundle.`,
    );
  }

  // Load using createRequire for synchronous CJS loading
  const require = createRequire(import.meta.url);
  try {
    const loaded = require(resolve(cjsPath));
    const gql = loaded.gql || loaded.default?.gql || loaded.default;

    if (!gql) {
      throw new Error(`GraphQL system module at ${cjsPath} does not export 'gql'`);
    }

    // Cache the result
    cachedGqlModule = gql;
    cachedModulePath = modulePath;

    return gql;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to load graphql-system module from ${cjsPath}. ` +
        `Ensure codegen has run and generated the .cjs bundle. Error: ${message}`,
    );
  }
}

/**
 * Build intermediate modules from dependency graph.
 * Each intermediate module corresponds to one source file.
 */
export const generateIntermediateModules = function* ({
  analyses,
  targetFiles,
}: BuildIntermediateModulesInput): Generator<IntermediateModule, void, undefined> {
  for (const filePath of targetFiles) {
    const analysis = analyses.get(filePath);
    if (!analysis) {
      continue;
    }

    // Generate source code for this intermediate module
    const sourceCode = renderRegistryBlock({ filePath, analysis, analyses });

    // Transpile TypeScript to JavaScript using SWC
    const transpiledCodeResult = transpile({ filePath, sourceCode });
    if (transpiledCodeResult.isErr()) {
      // error
      continue;
    }
    const transpiledCode = transpiledCodeResult.value;

    const script = new Script(transpiledCode);

    const hash = createHash("sha1");
    hash.update(transpiledCode);
    const contentHash = hash.digest("hex");
    const canonicalIds = analysis.definitions.map((definition) => definition.canonicalId);

    yield {
      filePath,
      canonicalIds,
      sourceCode,
      transpiledCode,
      contentHash,
      script,
    };
  }
};

export const evaluateIntermediateModules = ({
  intermediateModules,
  graphqlSystemPath,
}: {
  intermediateModules: Map<string, IntermediateModule>;
  graphqlSystemPath: string;
}) => {
  // Determine import paths from config
  const registry = createPseudoModuleRegistry();
  const gqlImportPath = resolve(process.cwd(), graphqlSystemPath);

  // Load the GraphQL system module synchronously from CJS bundle
  const gql = loadGraphqlSystemModule(gqlImportPath);

  const vmContext = createContext({
    gql,
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

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { extname, resolve } from "node:path";
import { createContext, Script } from "node:vm";
import * as sandboxCore from "@soda-gql/core";
import * as sandboxRuntime from "@soda-gql/runtime";
import { transformSync } from "@swc/core";
import { err, ok, type Result } from "neverthrow";
import type { ModuleAnalysis } from "../ast";
import type { BuilderError } from "../errors";
import { renderRegistryBlock } from "./codegen";
import { createIntermediateRegistry } from "./registry";
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
 * Resolve graphql system path to the bundled CJS file.
 * Accepts both .ts (for backward compatibility) and .cjs paths.
 * Maps .ts to sibling .cjs file if it exists.
 */
function resolveGraphqlSystemPath(configPath: string): string {
  const ext = extname(configPath);

  // If already pointing to .cjs, use as-is
  if (ext === ".cjs") {
    return resolve(process.cwd(), configPath);
  }

  // If pointing to .ts, try to resolve to sibling .cjs
  if (ext === ".ts") {
    const basePath = configPath.slice(0, -3); // Remove .ts
    const cjsPath = `${basePath}.cjs`;
    const resolvedCjsPath = resolve(process.cwd(), cjsPath);

    // Check if .cjs exists, otherwise fall back to .ts (for error messages)
    if (existsSync(resolvedCjsPath)) {
      return resolvedCjsPath;
    }

    // Fall back to .ts path (will fail later with clearer error)
    return resolve(process.cwd(), configPath);
  }

  // For other extensions or no extension, use as-is
  return resolve(process.cwd(), configPath);
}

/**
 * Bundle and execute GraphQL system module using rspack + memfs.
 * Creates a self-contained bundle that can run in VM context.
 * This is cached per session to avoid re-bundling.
 */
let cachedGql: unknown = null;
let cachedModulePath: string | null = null;

function executeGraphqlSystemModule(modulePath: string): { gql: unknown } {
  // Use cached module if same path
  if (cachedModulePath === modulePath && cachedGql !== null) {
    return { gql: cachedGql };
  }

  // Bundle the GraphQL system module
  const bundledCode = readFileSync(modulePath, "utf-8");

  // Create a shared CommonJS module exports object
  const moduleExports: Record<string, unknown> = {};

  // Create sandbox with proper CommonJS emulation
  const sandbox = {
    // Provide @soda-gql packages through require()
    require: (path: string) => {
      if (path === "@soda-gql/core") {
        return sandboxCore;
      }
      if (path === "@soda-gql/runtime") {
        return sandboxRuntime;
      }
      throw new Error(`Unknown module: ${path}`);
    },
    // Both module.exports and exports point to the same object
    module: { exports: moduleExports },
    exports: moduleExports,
    __dirname: resolve(modulePath, ".."),
    __filename: modulePath,
    global: undefined as unknown,
    globalThis: undefined as unknown,
  };
  // Wire global and globalThis to the sandbox itself
  sandbox.global = sandbox;
  sandbox.globalThis = sandbox;

  new Script(bundledCode, { filename: modulePath }).runInNewContext(sandbox);

  // Read exported gql (handle both direct export and default export)
  const exportedGql = moduleExports.gql ?? moduleExports.default;

  if (exportedGql === undefined) {
    throw new Error(`No 'gql' export found in GraphQL system module: ${modulePath}`);
  }

  // Cache the result
  cachedGql = exportedGql;
  cachedModulePath = modulePath;

  return { gql: cachedGql };
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
  const registry = createIntermediateRegistry();
  const gqlImportPath = resolveGraphqlSystemPath(graphqlSystemPath);

  const { gql } = executeGraphqlSystemModule(gqlImportPath);

  const vmContext = createContext({ gql, registry });

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

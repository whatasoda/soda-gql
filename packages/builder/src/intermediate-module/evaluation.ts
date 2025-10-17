import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createContext, Script } from "node:vm";
import { rspack } from "@rspack/core";
import * as sandboxCore from "@soda-gql/core";
import { createPseudoModuleRegistry } from "@soda-gql/core";
import * as sandboxRuntime from "@soda-gql/runtime";
import { transformSync } from "@swc/core";
import { createFsFromVolume, Volume } from "memfs";
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
 * Bundle and execute GraphQL system module using rspack + memfs.
 * Creates a self-contained bundle that can run in VM context.
 * This is cached per session to avoid re-bundling.
 */
let cachedGqlModule: unknown = null;
let cachedModulePath: string | null = null;

async function bundleGraphqlSystemModule(modulePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // Create temporary directory for entry file
    const tmpDir = mkdtempSync(join(tmpdir(), "soda-gql-"));
    const entryPath = join(tmpDir, "entry.ts");

    // Create entry file that calls exportGql
    const entryCode = `import { gql } from ${JSON.stringify(modulePath)};
declare function exportGql(gql: any): void;
exportGql(gql);`;

    writeFileSync(entryPath, entryCode, "utf-8");

    // Create in-memory filesystem for output
    const volume = new Volume();
    const memoryFs = createFsFromVolume(volume);

    // Configure rspack to bundle into memory
    const compiler = rspack({
      mode: "development",
      entry: entryPath,
      output: {
        path: "/dist",
        filename: "bundle.js",
        iife: true,
      },
      module: {
        rules: [
          {
            test: /\.(ts|tsx)$/,
            use: {
              loader: "builtin:swc-loader",
              options: {
                jsc: {
                  parser: {
                    syntax: "typescript",
                  },
                  target: "es2022",
                },
              },
            },
            type: "javascript/auto",
          },
        ],
      },
      optimization: {
        minimize: false,
      },
      resolve: {
        extensions: [".ts", ".tsx", ".js", ".jsx"],
        conditionNames: ["development", "import", "default"],
        extensionAlias: {
          ".js": [".ts", ".tsx", ".js"],
          ".mjs": [".mts", ".mjs"],
          ".cjs": [".cts", ".cjs"],
        },
      },
      externals: {
        // Externalize @soda-gql packages to preserve Symbols
        // Use global variable names that will be provided in VM sandbox
        "@soda-gql/core": "__SODA_GQL_CORE__",
        "@soda-gql/runtime": "__SODA_GQL_RUNTIME__",
      },
    });

    // Use memory filesystem for output
    compiler.outputFileSystem = memoryFs as any;

    compiler.run((err, stats) => {
      // Cleanup temporary directory
      try {
        rmSync(tmpDir, { recursive: true, force: true });
      } catch (cleanupError) {
        // Ignore cleanup errors
      }

      if (err) {
        reject(new Error(`Rspack compilation failed: ${err.message}`));
        return;
      }

      if (stats?.hasErrors()) {
        const errors = stats
          .toJson()
          .errors?.map((e) => e.message)
          .join("\n");
        reject(new Error(`Rspack compilation errors:\n${errors}`));
        return;
      }

      try {
        // Read bundled code from memory
        const bundleCode = memoryFs.readFileSync("/dist/bundle.js", "utf-8") as string;
        resolve(bundleCode);
      } catch (readError) {
        reject(new Error(`Failed to read bundled output: ${readError}`));
      }
    });
  });
}

async function executeGraphqlSystemModule(modulePath: string): Promise<unknown> {
  // Use cached module if same path
  if (cachedModulePath === modulePath && cachedGqlModule !== null) {
    return cachedGqlModule;
  }

  // Bundle the GraphQL system module
  const bundledCode = await bundleGraphqlSystemModule(modulePath);

  // Execute in VM with exportGql callback
  let exportedGql: unknown = null;

  // Import @soda-gql packages to make them available to the bundled code
  const sandbox = {
    // Provide @soda-gql packages as global variables
    __SODA_GQL_CORE__: sandboxCore,
    __SODA_GQL_RUNTIME__: sandboxRuntime,
    exportGql: (gql: unknown) => {
      exportedGql = gql;
    },
  };
  const script = new Script(bundledCode);
  script.runInNewContext(sandbox);

  if (exportedGql === null) {
    throw new Error("exportGql was not called during bundle execution");
  }

  // Cache the result
  cachedGqlModule = exportedGql;
  cachedModulePath = modulePath;

  return cachedGqlModule;
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

  // Load the GraphQL system module using rspack bundling
  const gql = await executeGraphqlSystemModule(gqlImportPath);

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

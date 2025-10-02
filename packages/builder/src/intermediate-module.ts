import { existsSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import type { AnyModel, AnyOperationOf, AnyOperationSliceOf, IssueRegistry, OperationType } from "@soda-gql/core";
import { err, type Result } from "neverthrow";
import type { DependencyGraph } from "./dependency-graph";
import { analyzeGraph } from "./intermediate-module/analysis";
import { buildIntermediateModuleSource, buildRegistryBlocks } from "./intermediate-module/codegen";
import { emitIntermediateModule } from "./intermediate-module/emitter";
import type { BuilderError } from "./types";

export type IntermediateModule = {
  readonly models: Record<string, AnyModel>;
  readonly slices: Record<string, AnyOperationSliceOf<OperationType>>;
  readonly operations: Record<string, AnyOperationOf<OperationType>>;
  readonly issueRegistry: IssueRegistry;
};

export type CreateIntermediateModuleInput = {
  readonly graph: DependencyGraph;
  readonly outDir: string;
};

export const createIntermediateModule = async ({
  graph,
  outDir,
}: CreateIntermediateModuleInput): Promise<Result<{ transpiledPath: string; sourceCode: string }, BuilderError>> => {
  // Analyze the graph
  const { fileGroups, summaries, missingExpressions, workspaceRoot } = analyzeGraph(graph);

  // Check for missing expressions
  if (missingExpressions.length > 0) {
    const [first] = missingExpressions;
    const filePath = first?.filePath ?? outDir;
    const astPath = first?.definition.astPath ?? "";
    return err({
      code: "MODULE_EVALUATION_FAILED",
      filePath,
      astPath,
      message: "MISSING_EXPRESSION",
    });
  }

  // Determine gqlImportPath
  const graphqlSystemIndex = join(workspaceRoot, "graphql-system", "index.ts");
  let gqlImportPath = "@/graphql-system";

  if (existsSync(graphqlSystemIndex)) {
    const jsFilePath = join(outDir, "temp.mjs");
    const relativePath = relative(dirname(jsFilePath), graphqlSystemIndex).replace(/\\/g, "/");
    let sanitized = relativePath.length > 0 ? relativePath : "./index.ts";
    if (!sanitized.startsWith(".")) {
      sanitized = `./${sanitized}`;
    }
    gqlImportPath = sanitized.endsWith(".ts") ? sanitized.slice(0, -3) : sanitized;
  }

  // Generate code
  const registryBlocks = buildRegistryBlocks(fileGroups, summaries);
  const sourceCode = buildIntermediateModuleSource({ registryBlocks, gqlImportPath });

  // Emit the module
  const emitResult = await emitIntermediateModule({ outDir, sourceCode });

  return emitResult.map(({ transpiledPath }) => ({ transpiledPath, sourceCode }));
};

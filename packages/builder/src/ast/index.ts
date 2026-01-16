import { assertUnreachable } from "../errors";
import type { GraphqlSystemIdentifyHelper } from "../internal/graphql-system";
import type { BuilderAnalyzer } from "../types";
import { swcAdapter } from "./adapters/swc";
import { typescriptAdapter } from "./adapters/typescript";
import { analyzeModuleCore } from "./core";
import type { AnalyzeModuleInput, ModuleAnalysis } from "./types";

export type { AnalyzeModuleInput, ModuleAnalysis, ModuleDefinition, ModuleExport, ModuleImport } from "./types";

export const createAstAnalyzer = ({
  analyzer,
  graphqlHelper,
  baseDir,
}: {
  readonly analyzer: BuilderAnalyzer;
  readonly graphqlHelper: GraphqlSystemIdentifyHelper;
  /**
   * Base directory for relative path computation in canonical IDs.
   * When provided, all canonical IDs generated during analysis will use
   * relative paths from baseDir, enabling portable artifacts.
   */
  readonly baseDir?: string;
}) => {
  const analyze = (input: Omit<AnalyzeModuleInput, "baseDir">): ModuleAnalysis => {
    const inputWithBaseDir: AnalyzeModuleInput = { ...input, baseDir };
    if (analyzer === "ts") {
      return analyzeModuleCore(inputWithBaseDir, typescriptAdapter, graphqlHelper);
    }
    if (analyzer === "swc") {
      return analyzeModuleCore(inputWithBaseDir, swcAdapter, graphqlHelper);
    }
    return assertUnreachable(analyzer, "createAstAnalyzer");
  };

  return {
    type: analyzer,
    analyze,
  };
};

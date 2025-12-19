import { assertUnreachable } from "../errors";
import type { GraphqlSystemIdentifyHelper } from "../internal/graphql-system";
import type { BuilderAnalyzer } from "../types";
import { swcAdapter } from "./adapters/swc";
import { typescriptAdapter } from "./adapters/typescript";
import { analyzeModuleCore } from "./core";
import type { AnalyzeModuleInput, ModuleAnalysis } from "./types";

export type {
  AnalyzeModuleInput,
  ModuleAnalysis,
  ModuleDefinition,
  ModuleExport,
  ModuleImport,
  SourceLocation,
  SourcePosition,
} from "./types";

export const createAstAnalyzer = ({
  analyzer,
  graphqlHelper,
}: {
  readonly analyzer: BuilderAnalyzer;
  readonly graphqlHelper: GraphqlSystemIdentifyHelper;
}) => {
  const analyze = (input: AnalyzeModuleInput): ModuleAnalysis => {
    if (analyzer === "ts") {
      return analyzeModuleCore(input, typescriptAdapter, graphqlHelper);
    }
    if (analyzer === "swc") {
      return analyzeModuleCore(input, swcAdapter, graphqlHelper);
    }
    return assertUnreachable(analyzer, "createAstAnalyzer");
  };

  return {
    type: analyzer,
    analyze,
  };
};

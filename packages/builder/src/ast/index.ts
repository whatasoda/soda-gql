import type { BuilderAnalyzer } from "../types";
import { assertUnreachable } from "../errors";
import { swcAdapter } from "./adapters/swc";
import { typescriptAdapter } from "./adapters/typescript";
import { analyzeModuleCore } from "./core";
import type { AnalyzeModuleInput, ModuleAnalysis } from "./types";

export type {
  AnalyzeModuleInput,
  ModuleAnalysis,
  ModuleDefinition,
  ModuleDiagnostic,
  ModuleExport,
  ModuleImport,
  SourceLocation,
  SourcePosition,
} from "./types";

export const getAstAnalyzer = (analyzer: BuilderAnalyzer) => {
  const analyze = (input: AnalyzeModuleInput): ModuleAnalysis => {
    if (analyzer === "ts") {
      return analyzeModuleCore(input, typescriptAdapter);
    }
    if (analyzer === "swc") {
      return analyzeModuleCore(input, swcAdapter);
    }
    return assertUnreachable(analyzer, "getAstAnalyzer");
  };

  return {
    type: analyzer,
    analyze,
  };
};

import type { BuilderAnalyzer } from "../types";
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
    switch (analyzer) {
      case "ts":
        return analyzeModuleCore(input, typescriptAdapter);
      case "swc":
        return analyzeModuleCore(input, swcAdapter);
      default:
        throw new Error(`Unsupported analyzer: ${analyzer}`);
    }
  };

  return {
    type: analyzer,
    analyze,
  };
};

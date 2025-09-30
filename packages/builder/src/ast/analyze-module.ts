/**
 * TypeScript module analyzer entry point.
 * Re-exports the analyzer function and types for backward compatibility.
 */

export { analyzeModule } from "./adapters/typescript";

export type {
  AnalyzeModuleInput,
  GqlDefinitionKind,
  ModuleAnalysis,
  ModuleDefinition,
  ModuleDiagnostic,
  ModuleExport,
  ModuleImport,
  SourceLocation,
  SourcePosition,
} from "./analyzer-types";

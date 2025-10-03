import { z } from "zod";

export const SourcePositionSchema = z.object({
  line: z.number(),
  column: z.number(),
});

export const SourceLocationSchema = z.object({
  start: SourcePositionSchema,
  end: SourcePositionSchema,
});

export const ModuleDefinitionSchema = z.object({
  exportName: z.string(),
  astPath: z.string(),
  isTopLevel: z.boolean(),
  isExported: z.boolean(),
  exportBinding: z.string().optional(),
  loc: SourceLocationSchema,
  expression: z.string(),
});

export const ModuleDiagnosticSchema = z.object({
  code: z.literal("NON_TOP_LEVEL_DEFINITION"),
  message: z.string(),
  loc: SourceLocationSchema,
});

export const ModuleImportSchema = z.object({
  source: z.string(),
  imported: z.string(),
  local: z.string(),
  kind: z.enum(["named", "namespace", "default"]),
  isTypeOnly: z.boolean(),
});

export const ModuleExportSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("named"),
    exported: z.string(),
    local: z.string(),
    source: z.undefined().optional(),
    isTypeOnly: z.boolean(),
  }),
  z.object({
    kind: z.literal("reexport"),
    exported: z.string(),
    source: z.string(),
    local: z.string().optional(),
    isTypeOnly: z.boolean(),
  }),
]);

export const ModuleAnalysisSchema = z.object({
  filePath: z.string(),
  signature: z.string(),
  definitions: z.array(ModuleDefinitionSchema).readonly(),
  diagnostics: z.array(ModuleDiagnosticSchema).readonly(),
  imports: z.array(ModuleImportSchema).readonly(),
  exports: z.array(ModuleExportSchema).readonly(),
});

export type ModuleAnalysis = z.infer<typeof ModuleAnalysisSchema>;

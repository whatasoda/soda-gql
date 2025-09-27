import { z } from "zod";

const SourceLocationSchema = z.object({
  start: z.number(),
  end: z.number(),
});

const ModuleDefinitionSchema = z.object({
  kind: z.enum(["model", "slice", "operation"]),
  exportName: z.string(),
  loc: SourceLocationSchema,
  references: z.array(z.string()),
  expression: z.string(),
});

const ModuleDiagnosticSchema = z.object({
  code: z.literal("NON_TOP_LEVEL_DEFINITION"),
  message: z.string(),
  loc: SourceLocationSchema,
});

const ModuleImportSchema = z.object({
  source: z.string(),
  imported: z.string(),
  local: z.string(),
  kind: z.enum(["named", "namespace", "default"]),
  isTypeOnly: z.boolean(),
});

const ModuleExportSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("named"),
    exported: z.string(),
    local: z.string(),
    source: z.undefined().optional(),
    isTypeOnly: z.boolean(),
  }),
  z.object({
    kind: z.literal("namespace"),
    exported: z.string(),
    source: z.string(),
    isTypeOnly: z.boolean(),
  }),
  z.object({
    kind: z.literal("default"),
    exported: z.literal("default"),
    local: z.string(),
    source: z.undefined().optional(),
    isTypeOnly: z.boolean(),
  }),
  z.object({
    kind: z.literal("all"),
    source: z.string(),
    exported: z.string().optional(),
    isTypeOnly: z.boolean(),
  }),
]);

export const ModuleAnalysisSchema = z.object({
  filePath: z.string(),
  sourceHash: z.string(),
  definitions: z.array(ModuleDefinitionSchema),
  diagnostics: z.array(ModuleDiagnosticSchema),
  imports: z.array(ModuleImportSchema),
  exports: z.array(ModuleExportSchema),
});

export type ModuleAnalysis = z.infer<typeof ModuleAnalysisSchema>;

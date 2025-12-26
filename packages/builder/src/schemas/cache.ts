import { CanonicalIdSchema } from "@soda-gql/common";
import { z } from "zod";

export const ModuleDefinitionSchema = z.object({
  canonicalId: CanonicalIdSchema,
  astPath: z.string(),
  isTopLevel: z.boolean(),
  isExported: z.boolean(),
  exportBinding: z.string().optional(),
  expression: z.string(),
});

export const ModuleImportSchema = z.object({
  source: z.string(),
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
  imports: z.array(ModuleImportSchema).readonly(),
  exports: z.array(ModuleExportSchema).readonly(),
});

export type ModuleAnalysis = z.infer<typeof ModuleAnalysisSchema>;

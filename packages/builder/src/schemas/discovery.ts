import { z } from "zod";

import {
	ModuleAnalysisSchema,
	ModuleDefinitionSchema,
	ModuleDiagnosticSchema,
	ModuleExportSchema,
	ModuleImportSchema,
} from "./cache";
import type { CanonicalId } from "../registry";

const BuilderAnalyzerSchema = z.enum(["ts", "swc"]);

// Type-safe schema for CanonicalId - validates as string but types as branded
const CanonicalIdSchema: z.ZodType<CanonicalId> = z.string() as unknown as z.ZodType<CanonicalId>;

export const DiscoveredDependencySchema = z.object({
	specifier: z.string(),
	resolvedPath: z.string().nullable(),
	isExternal: z.boolean(),
});

export const DiscoverySnapshotDefinitionSchema = ModuleDefinitionSchema.extend(
	{
		canonicalId: CanonicalIdSchema,
	},
);

export const DiscoverySnapshotSchema = z.object({
	filePath: z.string(),
	normalizedFilePath: z.string(),
	analyzer: BuilderAnalyzerSchema,
	signature: z.string(),
	createdAtMs: z.number(),
	analysis: ModuleAnalysisSchema,
	definitions: z.array(DiscoverySnapshotDefinitionSchema).readonly(),
	dependencies: z.array(DiscoveredDependencySchema).readonly(),
	diagnostics: z.array(ModuleDiagnosticSchema).readonly(),
	exports: z.array(ModuleExportSchema).readonly(),
	imports: z.array(ModuleImportSchema).readonly(),
});

import { z } from "zod";
import { ModuleAnalysisSchema } from "./cache";

const FileFingerprintSchema = z.object({
  hash: z.string(),
  sizeBytes: z.number(),
  mtimeMs: z.number(),
});

export const DiscoveredDependencySchema = z.object({
  specifier: z.string(),
  resolvedPath: z.string().nullable(),
  isExternal: z.boolean(),
});

export const DiscoverySnapshotSchema = z.object({
  filePath: z.string(),
  normalizedFilePath: z.string(),
  signature: z.string(),
  fingerprint: FileFingerprintSchema,
  analyzer: z.string(),
  createdAtMs: z.number(),
  analysis: ModuleAnalysisSchema,
  dependencies: z.array(DiscoveredDependencySchema).readonly(),
});

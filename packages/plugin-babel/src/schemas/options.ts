import { z } from "zod";

export const PluginOptionsSchema = z.object({
  artifactPath: z.string(),
  mode: z.enum(["runtime", "zero-runtime"]).optional().default("runtime"),
  exclude: z.array(z.string()).optional(),
});

export type PluginOptions = z.infer<typeof PluginOptionsSchema>;

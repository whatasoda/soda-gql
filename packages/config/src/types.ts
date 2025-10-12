// Builder-specific config
export type BuilderConfig = {
  readonly entry: readonly string[];
  readonly outDir: string;
  readonly analyzer: "ts" | "swc";
  readonly mode?: "runtime" | "zero-runtime";
};

// Codegen-specific config
export type CodegenConfig = {
  readonly schema: string;
  readonly outDir: string;
};

// Plugin-specific config (extensible)
export type PluginConfig = Record<string, unknown>;

// Per-project configuration
export type ProjectConfig = {
  readonly graphqlSystemPath: string;
  readonly corePath?: string;
  readonly builder?: BuilderConfig;
  readonly codegen?: CodegenConfig;
  readonly plugins?: PluginConfig;
};

// Top-level config (supports multi-project)
export type SodaGqlConfig = {
  // Single project mode (simpler)
  readonly graphqlSystemPath?: string;
  readonly corePath?: string;
  readonly builder?: BuilderConfig;
  readonly codegen?: CodegenConfig;
  readonly plugins?: PluginConfig;

  // Multi-project mode
  readonly projects?: Record<string, ProjectConfig>;
  readonly defaultProject?: string;
};

// Resolved config (normalized and validated)
export type ResolvedSodaGqlConfig = {
  readonly graphqlSystemPath: string;
  readonly corePath: string;
  readonly builder: Required<BuilderConfig>;
  readonly codegen?: Required<CodegenConfig>;
  readonly plugins: PluginConfig;
  readonly configDir: string;
  readonly configPath: string;
  readonly configHash: string; // For cache invalidation
  readonly configMtime: number; // For watch mode
};

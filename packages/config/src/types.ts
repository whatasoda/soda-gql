// Builder-specific config
export type BuilderConfig = {
  readonly entry: readonly string[];
  readonly outDir: string;
  readonly analyzer: "ts" | "swc";
};

// Codegen-specific config
export type CodegenSchemaConfig = {
  readonly schema: string;
  readonly runtimeAdapter: string;
  readonly scalars: string;
};

export type CodegenConfig = {
  readonly format?: "human" | "json";
  readonly output: string;
  readonly schemas: Record<string, CodegenSchemaConfig>;
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
  readonly graphqlSystemPath?: string;
  readonly graphqlSystemAlias?: string;
  readonly corePath?: string;
  readonly builder?: BuilderConfig;
  readonly codegen?: CodegenConfig;
  readonly plugins?: PluginConfig;
};

// Resolved config (normalized and validated)
export type ResolvedSodaGqlConfig = {
  readonly graphqlSystemPath: string;
  readonly graphqlSystemAlias: string | undefined;
  readonly corePath: string;
  readonly builder: Required<BuilderConfig>;
  readonly codegen?: Required<CodegenConfig>;
  readonly plugins: PluginConfig;
  readonly configDir: string;
  readonly configPath: string;
  readonly configHash: string; // For cache invalidation
  readonly configMtime: number; // For watch mode
};

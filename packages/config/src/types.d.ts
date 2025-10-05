export type BuilderConfig = {
    readonly entry: readonly string[];
    readonly outDir: string;
    readonly analyzer?: "ts" | "babel";
    readonly mode?: "runtime" | "zero-runtime";
};
export type CodegenConfig = {
    readonly schema: string;
    readonly outDir: string;
};
export type PluginConfig = Record<string, unknown>;
export type ProjectConfig = {
    readonly graphqlSystemPath: string;
    readonly corePath?: string;
    readonly builder?: BuilderConfig;
    readonly codegen?: CodegenConfig;
    readonly plugins?: PluginConfig;
};
export type SodaGqlConfig = {
    readonly graphqlSystemPath?: string;
    readonly corePath?: string;
    readonly builder?: BuilderConfig;
    readonly codegen?: CodegenConfig;
    readonly plugins?: PluginConfig;
    readonly projects?: Record<string, ProjectConfig>;
    readonly defaultProject?: string;
};
export type ResolvedSodaGqlConfig = {
    readonly graphqlSystemPath: string;
    readonly corePath: string;
    readonly builder: Required<BuilderConfig>;
    readonly codegen?: Required<CodegenConfig>;
    readonly plugins: PluginConfig;
    readonly configDir: string;
    readonly configPath: string;
    readonly configHash: string;
    readonly configMtime: number;
};
//# sourceMappingURL=types.d.ts.map
/**
 * SWC-based transformer for soda-gql GraphQL code generation.
 *
 * This module provides a TypeScript wrapper around the native Rust transformer.
 */

import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import type { BuilderArtifact } from "@soda-gql/builder";
import type { ResolvedSodaGqlConfig } from "@soda-gql/config";

// The native module will be loaded at runtime via the napi-rs generated loader
let nativeModule: NativeModule | null = null;

interface NativeModule {
  transform(inputJson: string): string;
  SwcTransformer: new (artifactJson: string, configJson: string) => NativeTransformer;
}

interface NativeTransformer {
  transform(sourceCode: string, sourcePath: string): string;
}

/**
 * Plugin error from the SWC transformer.
 * This matches the Rust PluginError structure for consistent error reporting.
 */
export type SwcPluginError = {
  /** Always "PluginError" for type discrimination */
  readonly type: "PluginError";
  /** Error code for programmatic handling (e.g., "SODA_GQL_METADATA_NOT_FOUND") */
  readonly code: string;
  /** Human-readable error message */
  readonly message: string;
  /** Stage where the error occurred */
  readonly stage: "analysis" | "transform";
  /** Source filename if applicable */
  readonly filename?: string;
  /** Canonical ID if applicable */
  readonly canonicalId?: string;
  /** Artifact type if applicable */
  readonly artifactType?: string;
  /** Builder type if applicable */
  readonly builderType?: string;
  /** Argument name if applicable */
  readonly argName?: string;
};

interface TransformResult {
  outputCode: string;
  transformed: boolean;
  sourceMap?: string;
  errors?: SwcPluginError[];
}

/**
 * Load the native module.
 * Uses the napi-rs generated loader which handles platform detection.
 */
const loadNativeModule = async (): Promise<NativeModule> => {
  if (nativeModule) {
    return nativeModule;
  }

  try {
    // Use require() for the napi-rs generated loader (CommonJS)
    const { createRequire } = await import("node:module");
    const require = createRequire(import.meta.url);
    nativeModule = require("./native/index.js") as NativeModule;
    return nativeModule;
  } catch (error) {
    throw new Error(
      "Failed to load @soda-gql/swc-transformer native module. " +
        "Make sure the native module is built for your platform. " +
        `Run 'bun run build' in the packages/swc-transformer directory. (${error})`,
    );
  }
};

export type ModuleFormat = "esm" | "cjs";

export type TransformOptions = {
  /** Compiler options for output format */
  compilerOptions?: {
    /** Module format: CommonJS or ESNext */
    module?: "CommonJS" | "ESNext";
  };
  /** Resolved soda-gql configuration */
  config: ResolvedSodaGqlConfig;
  /** Pre-built artifact from the builder */
  artifact: BuilderArtifact;
  /** Whether to generate source maps */
  sourceMap?: boolean;
};

export type TransformInput = {
  /** Source code to transform */
  sourceCode: string;
  /** Path to the source file */
  sourcePath: string;
};

/**
 * Normalize path separators to forward slashes (cross-platform).
 * This matches the behavior of @soda-gql/common normalizePath.
 */
const normalizePath = (value: string): string => value.replace(/\\/g, "/");

/**
 * Filter artifact to only include elements for the given source file.
 * This significantly reduces JSON serialization overhead for large codebases.
 *
 * Canonical IDs have the format: "filepath::astPath"
 * We filter by matching the filepath prefix.
 */
const filterArtifactForFile = (artifact: BuilderArtifact, sourcePath: string): BuilderArtifact => {
  const prefix = `${sourcePath}::`;

  const filteredElements: BuilderArtifact["elements"] = {};
  for (const [id, element] of Object.entries(artifact.elements)) {
    if (id.startsWith(prefix)) {
      (filteredElements as Record<string, typeof element>)[id] = element;
    }
  }

  return {
    elements: filteredElements,
    report: { stats: { hits: 0, misses: 0, skips: 0 }, durationMs: 0, warnings: [] },
  };
};

/**
 * Resolve the canonical path to the graphql-system file.
 * Uses realpath to resolve symlinks for accurate comparison.
 */
const resolveGraphqlSystemPath = (config: ResolvedSodaGqlConfig): string => {
  const graphqlSystemPath = resolve(config.outdir, "index.ts");
  try {
    return normalizePath(realpathSync(graphqlSystemPath));
  } catch {
    // If realpath fails (file doesn't exist yet), fall back to resolved path
    return normalizePath(resolve(graphqlSystemPath));
  }
};

export type TransformOutput = {
  /** Whether any transformation was performed */
  transformed: boolean;
  /** The transformed source code (or original if no transformation) */
  sourceCode: string;
  /** Source map JSON, if source map generation was enabled */
  sourceMap?: string;
  /** Errors encountered during transformation (non-fatal) */
  errors: SwcPluginError[];
};

/**
 * Transformer interface.
 */
export interface Transformer {
  transform(input: TransformInput): TransformOutput;
}

/**
 * Create a transformer instance.
 *
 * @param options - Transform options including config and artifact
 * @returns A transformer that can transform source files
 */
export const createTransformer = async (options: TransformOptions): Promise<Transformer> => {
  const native = await loadNativeModule();

  const isCJS = options.compilerOptions?.module === "CommonJS";

  // Resolve the graphql-system file path for stubbing
  const graphqlSystemPath = resolveGraphqlSystemPath(options.config);

  const configJson = JSON.stringify({
    graphqlSystemAliases: options.config.graphqlSystemAliases,
    isCjs: isCJS,
    graphqlSystemPath,
    sourceMap: options.sourceMap ?? false,
  });

  // Store full artifact for per-file filtering
  const fullArtifact = options.artifact;

  return {
    transform: ({ sourceCode, sourcePath }: TransformInput): TransformOutput => {
      // Resolve to absolute path and normalize for canonical ID consistency
      // This ensures bundlers can pass relative paths safely
      const normalizedPath = normalizePath(resolve(sourcePath));

      // Filter artifact to only include elements for this file
      // This significantly reduces JSON serialization overhead for large codebases
      const filteredArtifact = filterArtifactForFile(fullArtifact, normalizedPath);
      const filteredArtifactJson = JSON.stringify(filteredArtifact);

      // Create per-file transformer with filtered artifact
      const fileTransformer = new native.SwcTransformer(filteredArtifactJson, configJson);
      const resultJson = fileTransformer.transform(sourceCode, normalizedPath);
      const result: TransformResult = JSON.parse(resultJson);

      return {
        transformed: result.transformed,
        sourceCode: result.outputCode,
        sourceMap: result.sourceMap,
        errors: result.errors ?? [],
      };
    },
  };
};

/**
 * Transform a single source file (one-shot).
 *
 * For transforming multiple files, use createTransformer() to reuse the artifact.
 *
 * @param input - Transform input including source, path, artifact, and config
 * @returns Transform output
 */
export const transform = async (
  input: TransformInput & {
    artifact: BuilderArtifact;
    config: ResolvedSodaGqlConfig;
    isCjs?: boolean;
    sourceMap?: boolean;
  },
): Promise<TransformOutput> => {
  const native = await loadNativeModule();

  // Resolve to absolute path and normalize for canonical ID consistency
  // This ensures bundlers can pass relative paths safely
  const normalizedPath = normalizePath(resolve(input.sourcePath));

  // Filter artifact to only include elements for this file
  const filteredArtifact = filterArtifactForFile(input.artifact, normalizedPath);

  // Resolve the graphql-system file path for stubbing
  const graphqlSystemPath = resolveGraphqlSystemPath(input.config);

  const inputJson = JSON.stringify({
    sourceCode: input.sourceCode,
    sourcePath: normalizedPath,
    artifactJson: JSON.stringify(filteredArtifact),
    config: {
      graphqlSystemAliases: input.config.graphqlSystemAliases,
      isCjs: input.isCjs ?? false,
      graphqlSystemPath,
      sourceMap: input.sourceMap ?? false,
    },
  });

  const resultJson = native.transform(inputJson);
  const result: TransformResult = JSON.parse(resultJson);

  return {
    transformed: result.transformed,
    sourceCode: result.outputCode,
    sourceMap: result.sourceMap,
    errors: result.errors ?? [],
  };
};

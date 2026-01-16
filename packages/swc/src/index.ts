/**
 * SWC-based transformer for soda-gql GraphQL code generation.
 *
 * This module provides a TypeScript wrapper around the native Rust transformer.
 */

import { realpathSync } from "node:fs";
import { relative, resolve } from "node:path";
import remapping from "@ampproject/remapping";
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
      "Failed to load @soda-gql/swc native module. " +
        "Make sure the native module is built for your platform. " +
        `Run 'bun run build' in the packages/swc directory. (${error})`,
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
  /** Input source map from previous transformer (JSON string) */
  inputSourceMap?: string;
};

/**
 * Normalize path separators to forward slashes (cross-platform).
 * This matches the behavior of @soda-gql/common normalizePath.
 */
const normalizePath = (value: string): string => value.replace(/\\/g, "/");

/**
 * Compute the path prefix for filtering artifact elements.
 * Uses relative path from baseDir if provided, otherwise absolute path.
 */
const computeArtifactPathPrefix = (absolutePath: string, baseDir?: string): string => {
  if (baseDir) {
    const relativePath = normalizePath(relative(baseDir, absolutePath));
    return `${relativePath}::`;
  }
  return `${absolutePath}::`;
};

/**
 * Filter artifact to only include elements for the given source file.
 * This significantly reduces JSON serialization overhead for large codebases.
 *
 * Canonical IDs have the format: "filepath::astPath"
 * We filter by matching the filepath prefix.
 *
 * When baseDir is provided, the sourcePath is converted to a relative path
 * for matching against relative canonical IDs in the artifact.
 * The canonical IDs in the returned artifact are converted to absolute paths
 * to match what the Rust code will generate.
 */
const filterArtifactForFile = (artifact: BuilderArtifact, absoluteSourcePath: string, baseDir?: string): BuilderArtifact => {
  const relativePrefix = computeArtifactPathPrefix(absoluteSourcePath, baseDir);
  const absolutePrefix = `${absoluteSourcePath}::`;

  const filteredElements: BuilderArtifact["elements"] = {};
  for (const [id, element] of Object.entries(artifact.elements)) {
    if (id.startsWith(relativePrefix)) {
      // Convert the canonical ID from relative to absolute path format
      // so it matches what the Rust code will generate
      const absoluteId = id.replace(relativePrefix, absolutePrefix);
      (filteredElements as Record<string, typeof element>)[absoluteId] = element;
    }
  }

  return {
    elements: filteredElements,
    report: { stats: { hits: 0, misses: 0, skips: 0 }, durationMs: 0, warnings: [] },
  };
};

/**
 * Resolve a path with canonical normalization.
 * Uses realpath to resolve symlinks for accurate comparison.
 */
const resolveCanonicalPath = (filePath: string): string => {
  try {
    return normalizePath(realpathSync(filePath));
  } catch {
    // If realpath fails (file doesn't exist yet), fall back to resolved path
    return normalizePath(resolve(filePath));
  }
};

/**
 * Resolve the canonical path to the graphql-system file.
 * Returns absolute path for use in internal module stubbing.
 */
const resolveGraphqlSystemPath = (config: ResolvedSodaGqlConfig): string => {
  return resolveCanonicalPath(resolve(config.outdir, "index.ts"));
};

/**
 * Collect canonical paths to inject modules (scalars, adapter) from all schemas.
 * Returns absolute paths for use in internal module stubbing.
 */
const collectInjectPaths = (config: ResolvedSodaGqlConfig): string[] => {
  const paths: string[] = [];
  for (const schemaConfig of Object.values(config.schemas)) {
    paths.push(resolveCanonicalPath(schemaConfig.inject.scalars));
    if (schemaConfig.inject.adapter) {
      paths.push(resolveCanonicalPath(schemaConfig.inject.adapter));
    }
  }
  return paths;
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

  // Resolve paths for internal module stubbing
  const graphqlSystemPath = resolveGraphqlSystemPath(options.config);
  const injectPaths = collectInjectPaths(options.config);

  const configJson = JSON.stringify({
    graphqlSystemAliases: options.config.graphqlSystemAliases,
    isCjs: isCJS,
    graphqlSystemPath,
    injectPaths,
    sourceMap: options.sourceMap ?? false,
  });

  // Store full artifact for per-file filtering
  const fullArtifact = options.artifact;
  const baseDir = options.config.baseDir;

  return {
    transform: ({ sourceCode, sourcePath, inputSourceMap }: TransformInput): TransformOutput => {
      // Resolve to absolute path and normalize for canonical ID consistency
      // This ensures bundlers can pass relative paths safely
      const absolutePath = normalizePath(resolve(sourcePath));

      // Filter artifact to only include elements for this file
      // This significantly reduces JSON serialization overhead for large codebases
      // The filter function converts relative canonical IDs to absolute paths
      // to match what the Rust code will generate
      const filteredArtifact = filterArtifactForFile(fullArtifact, absolutePath, baseDir);
      const filteredArtifactJson = JSON.stringify(filteredArtifact);

      // Create per-file transformer with filtered artifact
      const fileTransformer = new native.SwcTransformer(filteredArtifactJson, configJson);

      // Pass absolute path to native transformer for internal module stubbing detection
      // and canonical ID computation (the filtered artifact has absolute canonical IDs)
      const resultJson = fileTransformer.transform(sourceCode, absolutePath);
      const result: TransformResult = JSON.parse(resultJson);

      // Handle source map chaining
      let finalSourceMap: string | undefined;
      if (result.sourceMap) {
        if (inputSourceMap) {
          // Chain source maps: our map -> input map -> original source
          const merged = remapping([JSON.parse(result.sourceMap), JSON.parse(inputSourceMap)], () => null);
          finalSourceMap = JSON.stringify(merged);
        } else {
          finalSourceMap = result.sourceMap;
        }
      }

      return {
        transformed: result.transformed,
        sourceCode: result.outputCode,
        sourceMap: finalSourceMap,
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
  const absolutePath = normalizePath(resolve(input.sourcePath));
  const baseDir = input.config.baseDir;

  // Filter artifact to only include elements for this file
  // The filter function converts relative canonical IDs to absolute paths
  const filteredArtifact = filterArtifactForFile(input.artifact, absolutePath, baseDir);

  // Resolve paths for internal module stubbing
  const graphqlSystemPath = resolveGraphqlSystemPath(input.config);
  const injectPaths = collectInjectPaths(input.config);

  const inputJson = JSON.stringify({
    sourceCode: input.sourceCode,
    sourcePath: absolutePath,
    artifactJson: JSON.stringify(filteredArtifact),
    config: {
      graphqlSystemAliases: input.config.graphqlSystemAliases,
      isCjs: input.isCjs ?? false,
      graphqlSystemPath,
      injectPaths,
      sourceMap: input.sourceMap ?? false,
    },
  });

  const resultJson = native.transform(inputJson);
  const result: TransformResult = JSON.parse(resultJson);

  // Handle source map chaining
  let finalSourceMap: string | undefined;
  if (result.sourceMap) {
    if (input.inputSourceMap) {
      // Chain source maps: our map -> input map -> original source
      const merged = remapping([JSON.parse(result.sourceMap), JSON.parse(input.inputSourceMap)], () => null);
      finalSourceMap = JSON.stringify(merged);
    } else {
      finalSourceMap = result.sourceMap;
    }
  }

  return {
    transformed: result.transformed,
    sourceCode: result.outputCode,
    sourceMap: finalSourceMap,
    errors: result.errors ?? [],
  };
};

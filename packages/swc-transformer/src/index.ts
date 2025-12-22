/**
 * SWC-based transformer for soda-gql GraphQL code generation.
 *
 * This module provides a TypeScript wrapper around the native Rust transformer.
 */

import type { BuilderArtifact } from "@soda-gql/builder";
import type { ResolvedSodaGqlConfig } from "@soda-gql/config";

// The native module will be loaded at runtime
// This is a placeholder for development - in production, the .node file will be loaded
let nativeModule: NativeModule | null = null;

interface NativeModule {
  transform(inputJson: string): string;
  SwcTransformer: new (artifactJson: string, configJson: string) => NativeTransformer;
}

interface NativeTransformer {
  transform(sourceCode: string, sourcePath: string): string;
}

interface TransformResult {
  outputCode: string;
  transformed: boolean;
}

/**
 * Get the platform-specific native module filename.
 */
const getNativeModulePath = (): string => {
  const platform = process.platform;
  const arch = process.arch;

  const platformMap: Record<string, Record<string, string>> = {
    darwin: {
      arm64: "../swc-transformer.darwin-arm64.node",
      x64: "../swc-transformer.darwin-x64.node",
    },
    linux: {
      x64: "../swc-transformer.linux-x64-gnu.node",
      arm64: "../swc-transformer.linux-arm64-gnu.node",
    },
    win32: {
      x64: "../swc-transformer.win32-x64-msvc.node",
    },
  };

  const platformPaths = platformMap[platform];
  if (!platformPaths) {
    throw new Error(`Unsupported platform: ${platform}`);
  }

  const path = platformPaths[arch];
  if (!path) {
    throw new Error(`Unsupported architecture for ${platform}: ${arch}`);
  }

  return path;
};

/**
 * Load the native module.
 * This is called lazily on first use.
 */
const loadNativeModule = async (): Promise<NativeModule> => {
  if (nativeModule) {
    return nativeModule;
  }

  try {
    // Use require() for Node-API modules (Bun doesn't support import() for .node files)
    const modulePath = getNativeModulePath();
    const path = await import("node:path");
    const url = await import("node:url");
    const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
    const absolutePath = path.resolve(__dirname, modulePath);

    // Use require() for native modules
    const { createRequire } = await import("node:module");
    const require = createRequire(import.meta.url);
    nativeModule = require(absolutePath) as NativeModule;
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

export type TransformOutput = {
  /** Whether any transformation was performed */
  transformed: boolean;
  /** The transformed source code (or original if no transformation) */
  sourceCode: string;
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

  const configJson = JSON.stringify({
    graphqlSystemAliases: options.config.graphqlSystemAliases,
    isCjs: isCJS,
  });

  const artifactJson = JSON.stringify(options.artifact);

  const nativeTransformer = new native.SwcTransformer(artifactJson, configJson);

  return {
    transform: ({ sourceCode, sourcePath }: TransformInput): TransformOutput => {
      // Normalize path for cross-platform compatibility
      const normalizedPath = normalizePath(sourcePath);
      const resultJson = nativeTransformer.transform(sourceCode, normalizedPath);
      const result: TransformResult = JSON.parse(resultJson);

      return {
        transformed: result.transformed,
        sourceCode: result.outputCode,
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
  },
): Promise<TransformOutput> => {
  const native = await loadNativeModule();

  // Normalize path for cross-platform compatibility
  const normalizedPath = normalizePath(input.sourcePath);

  const inputJson = JSON.stringify({
    sourceCode: input.sourceCode,
    sourcePath: normalizedPath,
    artifactJson: JSON.stringify(input.artifact),
    config: {
      graphqlSystemAliases: input.config.graphqlSystemAliases,
      isCjs: input.isCjs ?? false,
    },
  });

  const resultJson = native.transform(inputJson);
  const result: TransformResult = JSON.parse(resultJson);

  return {
    transformed: result.transformed,
    sourceCode: result.outputCode,
  };
};

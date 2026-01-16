import { relative, resolve } from "node:path";
import { type TransformOptions, transformSync } from "@babel/core";
import { createPluginWithArtifact } from "@soda-gql/babel/plugin";
import { type BuilderArtifact, type BuilderArtifactElement, collectAffectedFiles } from "@soda-gql/builder";
import {
  createPluginSession,
  getSharedState,
  getStateKey,
  type PluginSession,
  type SwcTransformerInterface,
  setSharedArtifact,
  setSharedPluginSession,
  setSharedSwcTransformer,
} from "@soda-gql/builder/plugin-support";
import { normalizePath } from "@soda-gql/common";
import type { HmrContext, ModuleNode, Plugin, ViteDevServer } from "vite";
import type { VitePluginOptions } from "./types";

/**
 * Vite plugin for soda-gql that handles GraphQL code transformations
 * at build time with HMR support for development.
 *
 * @example
 * ```typescript
 * // vite.config.ts
 * import { defineConfig } from "vite";
 * import react from "@vitejs/plugin-react";
 * import { sodaGqlPlugin } from "@soda-gql/vite-plugin";
 *
 * export default defineConfig({
 *   plugins: [sodaGqlPlugin({ debug: true }), react()],
 * });
 * ```
 */
export const sodaGqlPlugin = (options: VitePluginOptions = {}): Plugin => {
  const stateKey = getStateKey(options.configPath);

  let pluginSession: PluginSession | null = null;
  let currentArtifact: BuilderArtifact | null = null;
  let previousArtifact: BuilderArtifact | null = null;
  let _viteServer: ViteDevServer | null = null;
  let isDevMode = false;
  let swcTransformer: SwcTransformerInterface | null = null;
  let swcInitialized = false;

  const log = (message: string): void => {
    if (options.debug) {
      console.log(`[@soda-gql/vite-plugin] ${message}`);
    }
  };

  /**
   * Initialize SWC transformer if configured.
   */
  const initializeSwcTransformer = async (): Promise<void> => {
    if (swcInitialized || options.transformer !== "swc") {
      return;
    }

    swcInitialized = true;

    if (!currentArtifact || !pluginSession) {
      return;
    }

    try {
      const { createTransformer } = await import("@soda-gql/swc");
      swcTransformer = await createTransformer({
        config: pluginSession.config,
        artifact: currentArtifact,
        sourceMap: true,
      });
      setSharedSwcTransformer(stateKey, swcTransformer);
      log("SWC transformer initialized");
    } catch (error) {
      console.warn(
        `[@soda-gql/vite-plugin] Failed to initialize SWC transformer: ${error}. ` +
          "Make sure @soda-gql/swc is installed. Falling back to Babel.",
      );
      swcTransformer = null;
    }
  };

  /**
   * Convert an absolute file path to a relative path from baseDir.
   * This is used to match against artifact sourcePaths which are relative.
   */
  const toRelativePath = (absolutePath: string): string => {
    if (!pluginSession) {
      return normalizePath(absolutePath);
    }
    return normalizePath(relative(pluginSession.config.baseDir, absolutePath));
  };

  /**
   * Convert a relative file path to an absolute path using baseDir.
   * This is used to convert artifact sourcePaths to absolute paths for Vite's module graph.
   */
  const toAbsolutePath = (relativePath: string): string => {
    if (!pluginSession) {
      return relativePath;
    }
    return normalizePath(resolve(pluginSession.config.baseDir, relativePath));
  };

  /**
   * Check if a file path corresponds to a soda-gql source file.
   */
  const isSodaGqlFile = (filePath: string): boolean => {
    if (!currentArtifact) return false;

    const relativePath = toRelativePath(filePath);
    for (const element of Object.values(currentArtifact.elements)) {
      if (normalizePath(element.metadata.sourcePath) === relativePath) {
        return true;
      }
    }
    return false;
  };

  /**
   * Check if artifact has changed by comparing element counts and hashes.
   */
  const hasArtifactChanged = (): boolean => {
    if (!previousArtifact || !currentArtifact) return true;

    const prevCount = Object.keys(previousArtifact.elements).length;
    const newCount = Object.keys(currentArtifact.elements).length;
    if (prevCount !== newCount) return true;

    // Compare individual elements by their content hash
    const prevElements = previousArtifact.elements as Record<string, BuilderArtifactElement>;
    const currElements = currentArtifact.elements as Record<string, BuilderArtifactElement>;

    for (const [id, element] of Object.entries(currElements)) {
      const prevElement = prevElements[id];
      if (!prevElement) return true;
      if (element.metadata.contentHash !== prevElement.metadata.contentHash) {
        return true;
      }
    }

    return false;
  };

  /**
   * Get files that changed between previous and current artifact.
   */
  const getChangedSodaGqlFiles = (): Set<string> => {
    const changed = new Set<string>();

    if (!previousArtifact || !currentArtifact) return changed;

    const prevElements = previousArtifact.elements as Record<string, BuilderArtifactElement>;
    const currElements = currentArtifact.elements as Record<string, BuilderArtifactElement>;

    // Compare elements by their source paths and content hashes
    for (const [id, element] of Object.entries(currElements)) {
      const prevElement = prevElements[id];
      const sourcePath = element.metadata.sourcePath;

      if (!prevElement || prevElement.metadata.contentHash !== element.metadata.contentHash) {
        changed.add(normalizePath(sourcePath));
      }
    }

    // Check for removed elements
    for (const [id, element] of Object.entries(prevElements)) {
      if (!currElements[id]) {
        const sourcePath = element.metadata.sourcePath;
        changed.add(normalizePath(sourcePath));
      }
    }

    return changed;
  };

  return {
    name: "@soda-gql/vite-plugin",
    enforce: "pre", // Run before other plugins to transform source early

    configResolved(config) {
      isDevMode = config.command === "serve";
      log(`Mode: ${isDevMode ? "development" : "production"}`);
    },

    async buildStart() {
      // Initialize plugin session
      pluginSession = createPluginSession(options, "@soda-gql/vite-plugin");
      if (!pluginSession) {
        log("Plugin disabled or config load failed");
        return;
      }

      setSharedPluginSession(stateKey, pluginSession);

      // Build initial artifact
      currentArtifact = await pluginSession.getArtifactAsync();
      setSharedArtifact(stateKey, currentArtifact);

      log(`Initial build: ${Object.keys(currentArtifact?.elements ?? {}).length} elements`);

      // Initialize SWC transformer if configured
      await initializeSwcTransformer();
    },

    configureServer(server) {
      _viteServer = server;
      log("Dev server configured");
    },

    async transform(code, id) {
      // Skip non-JS/TS files
      if (!/\.[jt]sx?$/.test(id)) {
        return null;
      }

      // Skip node_modules
      if (id.includes("node_modules")) {
        return null;
      }

      // Skip if plugin is disabled or no artifact
      if (!pluginSession || !currentArtifact) {
        return null;
      }

      // Check if this file contains any soda-gql elements
      // Convert absolute path to relative for matching against artifact sourcePaths
      const relativePath = toRelativePath(id);
      const hasElements = Object.values(currentArtifact.elements).some(
        (element) => normalizePath(element.metadata.sourcePath) === relativePath,
      );

      if (!hasElements) {
        return null; // Not a soda-gql file
      }

      log(`Transforming: ${relativePath}`);

      // Try SWC transformer first if available
      if (swcTransformer) {
        const swcResult = swcTransformer.transform({
          sourceCode: code,
          sourcePath: id,
        });

        if (swcResult.transformed) {
          return {
            code: swcResult.sourceCode,
            map: swcResult.sourceMap ? JSON.parse(swcResult.sourceMap) : undefined,
          };
        }
        // SWC didn't transform (no soda-gql code), return null to pass through
        return null;
      }

      // Fall back to Babel transformer
      const babelOptions: TransformOptions = {
        filename: id,
        babelrc: false,
        configFile: false,
        plugins: [createPluginWithArtifact({ artifact: currentArtifact, config: pluginSession.config })],
        sourceMaps: true,
      };

      const result = transformSync(code, babelOptions);

      if (result?.code) {
        return {
          code: result.code,
          map: result.map,
        };
      }

      return null;
    },

    buildEnd() {
      if (!isDevMode) {
        // Cleanup for production builds
        log("Production build complete, cleaning up");
        pluginSession = null;
        currentArtifact = null;
        previousArtifact = null;
        swcTransformer = null;
        setSharedPluginSession(stateKey, null);
        setSharedArtifact(stateKey, null);
        setSharedSwcTransformer(stateKey, null);
      }
    },

    async handleHotUpdate(ctx: HmrContext): Promise<ModuleNode[] | void> {
      const { file, server, modules } = ctx;
      const normalizedPath = normalizePath(file);

      if (!pluginSession || !currentArtifact) {
        return; // Let Vite handle normally
      }

      // Check if the changed file is a soda-gql source file
      if (!isSodaGqlFile(normalizedPath)) {
        return; // Not a soda-gql file, let Vite handle normally
      }

      log(`soda-gql file changed: ${normalizedPath}`);

      // Store previous artifact for change detection
      previousArtifact = currentArtifact;

      // Rebuild artifact to detect changes
      currentArtifact = await pluginSession.getArtifactAsync();
      setSharedArtifact(stateKey, currentArtifact);

      if (!currentArtifact) {
        return;
      }

      // If artifact hasn't changed, just let normal HMR happen
      if (!hasArtifactChanged()) {
        log("Artifact unchanged, using normal HMR");
        return;
      }

      // Compute affected files using module adjacency
      const sharedState = getSharedState(stateKey);
      const changedFiles = getChangedSodaGqlFiles();

      const affectedFiles = collectAffectedFiles({
        changedFiles,
        removedFiles: new Set(),
        previousModuleAdjacency: sharedState.moduleAdjacency,
      });

      log(`Changed files: ${changedFiles.size}, Affected files: ${affectedFiles.size}`);

      // Convert affected file paths to Vite module nodes
      // affectedFiles contains relative paths, convert to absolute for Vite's module graph
      const affectedModules = new Set<ModuleNode>();

      for (const affectedPath of affectedFiles) {
        // Convert relative path to absolute for Vite's module graph lookup
        const absolutePath = toAbsolutePath(affectedPath);
        const modulesByFile = server.moduleGraph.getModulesByFile(absolutePath);
        if (modulesByFile) {
          for (const mod of modulesByFile) {
            affectedModules.add(mod);
          }
        }
      }

      // Include original modules
      for (const mod of modules) {
        affectedModules.add(mod);
      }

      if (affectedModules.size > 0) {
        log(`Invalidating ${affectedModules.size} modules for HMR`);
        return [...affectedModules];
      }

      // Fall back to original modules
      return modules;
    },
  };
};

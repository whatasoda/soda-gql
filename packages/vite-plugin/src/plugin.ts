import { type TransformOptions, transformSync } from "@babel/core";
import type { Plugin, ViteDevServer } from "vite";
import { createPluginWithArtifact } from "@soda-gql/babel-plugin";
import type { BuilderArtifact } from "@soda-gql/builder";
import { normalizePath } from "@soda-gql/common";
import {
  createPluginSession,
  getStateKey,
  type PluginSession,
  setSharedArtifact,
  setSharedPluginSession,
} from "@soda-gql/plugin-common";
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
  let viteServer: ViteDevServer | null = null;
  let isDevMode = false;

  const log = (message: string): void => {
    if (options.debug) {
      console.log(`[@soda-gql/vite-plugin] ${message}`);
    }
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
    },

    configureServer(server) {
      viteServer = server;
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
      const normalizedPath = normalizePath(id);
      const hasElements = Object.values(currentArtifact.elements).some(
        (element) => normalizePath(element.metadata.sourcePath) === normalizedPath,
      );

      if (!hasElements) {
        return null; // Not a soda-gql file
      }

      log(`Transforming: ${normalizedPath}`);

      // Transform using Babel plugin with direct artifact
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
        setSharedPluginSession(stateKey, null);
        setSharedArtifact(stateKey, null);
      }
    },
  };
};

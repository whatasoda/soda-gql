import type { BuilderArtifact, BuilderArtifactElement } from "@soda-gql/builder";
import { collectAffectedFiles } from "@soda-gql/builder";
import { normalizePath } from "@soda-gql/common";
import {
  createPluginSession,
  getSharedPluginSession,
  getSharedState,
  getStateKey,
  type PluginSession,
  type SwcTransformerInterface,
  setSharedArtifact,
  setSharedPluginSession,
  setSharedSwcTransformer,
} from "@soda-gql/plugin-common";
import type { Compiler } from "webpack";
import type { WebpackPluginOptions } from "./types";

/**
 * Webpack plugin for soda-gql that handles incremental rebuilds
 * when model files change during dev server execution.
 */
export class SodaGqlWebpackPlugin {
  static readonly pluginName = "SodaGqlWebpackPlugin";

  private readonly options: WebpackPluginOptions;
  private readonly stateKey: string;
  private pluginSession: PluginSession | null = null;
  private currentArtifact: BuilderArtifact | null = null;
  private previousArtifact: BuilderArtifact | null = null;
  private pendingInvalidations: Set<string> = new Set();
  private swcTransformer: SwcTransformerInterface | null = null;

  constructor(options: WebpackPluginOptions = {}) {
    this.options = options;
    this.stateKey = getStateKey(options.configPath);
  }

  apply(compiler: Compiler): void {
    // Initialize plugin session on first build
    compiler.hooks.beforeRun.tapAsync(SodaGqlWebpackPlugin.pluginName, async (_compiler, callback) => {
      try {
        await this.initialize();
        callback();
      } catch (error) {
        callback(error as Error);
      }
    });

    // Handle watch mode
    compiler.hooks.watchRun.tapAsync(SodaGqlWebpackPlugin.pluginName, async (_compiler, callback) => {
      try {
        await this.handleWatchRun();
        callback();
      } catch (error) {
        callback(error as Error);
      }
    });

    // Track file invalidations
    compiler.hooks.invalid.tap(SodaGqlWebpackPlugin.pluginName, (fileName, _changeTime) => {
      if (fileName) {
        this.handleFileInvalidation(fileName);
      }
    });

    // Cleanup on watch close
    compiler.hooks.watchClose.tap(SodaGqlWebpackPlugin.pluginName, () => {
      this.cleanup();
    });
  }

  /**
   * Initialize plugin session and build initial artifact.
   */
  private async initialize(): Promise<void> {
    if (this.pluginSession) return;

    // Try to reuse existing shared session (e.g., from client compilation in Next.js)
    const existingSession = getSharedPluginSession(this.stateKey);
    if (existingSession) {
      this.pluginSession = existingSession;

      // Still need to build artifact for this compilation
      this.currentArtifact = await this.pluginSession.getArtifactAsync();

      // Update shared artifact
      setSharedArtifact(this.stateKey, this.currentArtifact);

      // Initialize SWC transformer if configured
      await this.initializeSwcTransformer();

      this.log(`Reusing session: ${Object.keys(this.currentArtifact?.elements ?? {}).length} elements`);
      return;
    }

    // Fall back to creating new session (first plugin instance)
    this.pluginSession = createPluginSession(this.options, SodaGqlWebpackPlugin.pluginName);
    if (!this.pluginSession) {
      this.log("Plugin disabled or config load failed");
      return;
    }

    // Share the plugin session with loader and other plugin instances
    setSharedPluginSession(this.stateKey, this.pluginSession);

    // Initial artifact build
    this.currentArtifact = await this.pluginSession.getArtifactAsync();

    // Share artifact with loader
    setSharedArtifact(this.stateKey, this.currentArtifact);

    // Create SWC transformer if configured
    await this.initializeSwcTransformer();

    this.log(`Initial build complete: ${Object.keys(this.currentArtifact?.elements ?? {}).length} elements`);
  }

  /**
   * Handle watch mode run - rebuild artifact and compute affected files.
   */
  private async handleWatchRun(): Promise<void> {
    if (!this.pluginSession) {
      await this.initialize();
    }

    if (!this.pluginSession) return;

    // Store previous artifact for comparison
    this.previousArtifact = this.currentArtifact;

    // Rebuild artifact (BuilderService handles change detection internally)
    this.currentArtifact = await this.pluginSession.getArtifactAsync();

    // Share artifact with loader
    setSharedArtifact(this.stateKey, this.currentArtifact);

    // Reinitialize SWC transformer with new artifact
    await this.initializeSwcTransformer();

    if (!this.currentArtifact) {
      this.log("Failed to build artifact");
      return;
    }

    // If we have a previous artifact, compute what changed
    if (this.previousArtifact && this.hasArtifactChanged()) {
      const changedFiles = this.getChangedSodaGqlFiles();
      const sharedState = getSharedState(this.stateKey);
      const affectedFiles = this.computeAffectedFiles(changedFiles, sharedState.moduleAdjacency);

      this.log(`Changed files: ${changedFiles.size}, Affected files: ${affectedFiles.size}`);

      // Store affected files for webpack to pick up
      for (const filePath of affectedFiles) {
        this.pendingInvalidations.add(filePath);
      }
    }
  }

  /**
   * Handle file invalidation event from webpack.
   */
  private handleFileInvalidation(fileName: string): void {
    const normalized = normalizePath(fileName);
    if (this.isSodaGqlFile(normalized)) {
      this.log(`soda-gql file changed: ${normalized}`);
    }
  }

  /**
   * Check if artifact has changed by comparing element counts and hashes.
   */
  private hasArtifactChanged(): boolean {
    if (!this.previousArtifact || !this.currentArtifact) return true;

    const prevCount = Object.keys(this.previousArtifact.elements).length;
    const newCount = Object.keys(this.currentArtifact.elements).length;
    if (prevCount !== newCount) return true;

    // Compare individual elements by their content hash
    const prevElements = this.previousArtifact.elements as Record<string, BuilderArtifactElement>;
    const currElements = this.currentArtifact.elements as Record<string, BuilderArtifactElement>;

    for (const [id, element] of Object.entries(currElements)) {
      const prevElement = prevElements[id];
      if (!prevElement) return true;
      // Compare using metadata
      if (element.metadata.contentHash !== prevElement.metadata.contentHash) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get files that changed between previous and current artifact.
   */
  private getChangedSodaGqlFiles(): Set<string> {
    const changed = new Set<string>();

    if (!this.previousArtifact || !this.currentArtifact) return changed;

    const prevElements = this.previousArtifact.elements as Record<string, BuilderArtifactElement>;
    const currElements = this.currentArtifact.elements as Record<string, BuilderArtifactElement>;

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
  }

  /**
   * Compute all files affected by the changed files using module adjacency.
   */
  private computeAffectedFiles(changedFiles: Set<string>, moduleAdjacency: Map<string, Set<string>>): Set<string> {
    // Use the existing collectAffectedFiles from builder
    return collectAffectedFiles({
      changedFiles,
      removedFiles: new Set(),
      previousModuleAdjacency: moduleAdjacency,
    });
  }

  /**
   * Check if a file path corresponds to a soda-gql source file.
   */
  private isSodaGqlFile(filePath: string): boolean {
    if (!this.currentArtifact) return false;

    const normalized = normalizePath(filePath);
    for (const element of Object.values(this.currentArtifact.elements)) {
      if (normalizePath(element.metadata.sourcePath) === normalized) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get pending invalidations and clear the set.
   */
  getPendingInvalidations(): Set<string> {
    const invalidations = new Set(this.pendingInvalidations);
    this.pendingInvalidations.clear();
    return invalidations;
  }

  /**
   * Initialize SWC transformer if configured.
   * Creates a new transformer instance with the current artifact.
   */
  private async initializeSwcTransformer(): Promise<void> {
    if (this.options.transformer !== "swc") {
      return;
    }

    if (!this.currentArtifact || !this.pluginSession) {
      this.swcTransformer = null;
      setSharedSwcTransformer(this.stateKey, null);
      return;
    }

    try {
      const { createTransformer } = await import("@soda-gql/swc-transformer");
      this.swcTransformer = await createTransformer({
        config: this.pluginSession.config,
        artifact: this.currentArtifact,
        sourceMap: true,
      });
      setSharedSwcTransformer(this.stateKey, this.swcTransformer);
      this.log("SWC transformer initialized");
    } catch (error) {
      console.warn(
        `[@soda-gql/webpack-plugin] Failed to initialize SWC transformer: ${error}. ` +
          "Make sure @soda-gql/swc-transformer is installed.",
      );
      this.swcTransformer = null;
      setSharedSwcTransformer(this.stateKey, null);
    }
  }

  /**
   * Cleanup resources.
   */
  private cleanup(): void {
    this.pluginSession = null;
    this.currentArtifact = null;
    this.previousArtifact = null;
    this.pendingInvalidations.clear();
    this.swcTransformer = null;
    setSharedPluginSession(this.stateKey, null);
    setSharedArtifact(this.stateKey, null);
    setSharedSwcTransformer(this.stateKey, null);
  }

  /**
   * Log a message if debug mode is enabled.
   */
  private log(message: string): void {
    if (this.options.debug) {
      console.log(`[${SodaGqlWebpackPlugin.pluginName}] ${message}`);
    }
  }

  /**
   * Get the current artifact (for use by loader).
   */
  getArtifact(): BuilderArtifact | null {
    return this.currentArtifact;
  }
}

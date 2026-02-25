/**
 * Watch mode implementation for typegen command.
 *
 * Watches source files and regenerates prebuilt types on changes.
 * Uses debouncing to batch rapid file changes.
 *
 * @module
 */

import type { ResolvedSodaGqlConfig } from "@soda-gql/config";
import { runTypegen } from "@soda-gql/typegen";
import chokidar from "chokidar";

const DEBOUNCE_MS = 150;

/**
 * Options for running typegen in watch mode.
 */
export type TypegenWatchOptions = {
  /**
   * Resolved soda-gql configuration.
   */
  readonly config: ResolvedSodaGqlConfig;
};

type WatchState = {
  isRunning: boolean;
  pendingRun: boolean;
  pendingPaths: Set<string>;
  generation: number;
};

/**
 * Execute a single regeneration cycle.
 */
const executeRegenerate = async (
  config: ResolvedSodaGqlConfig,
  state: WatchState,
  changedPaths: readonly string[],
): Promise<void> => {
  // Prevent concurrent runs - accumulate paths for deferred execution
  if (state.isRunning) {
    state.pendingRun = true;
    for (const path of changedPaths) {
      state.pendingPaths.add(path);
    }
    return;
  }

  state.isRunning = true;
  const startTime = Date.now();

  // Clear console for fresh output
  console.clear();
  console.log(`[typegen] Regenerating... (gen ${state.generation + 1})`);

  if (changedPaths.length > 0) {
    const displayPaths = changedPaths.slice(0, 3).join(", ");
    const overflow = changedPaths.length > 3 ? ` (+${changedPaths.length - 3} more)` : "";
    console.log(`  Changed: ${displayPaths}${overflow}`);
  }

  // NOTE: This try-catch is intentionally used as a defensive boundary for the
  // long-running watch process. The primary error handling uses Result types from
  // runTypegen (properly handled via isOk/isErr). This catch is a last-resort
  // safety net for truly unexpected exceptions (V8 errors, memory issues, etc.)
  // that would otherwise crash the entire watch mode.
  try {
    const result = await runTypegen({
      config,
    });

    const elapsed = Date.now() - startTime;

    if (result.isOk()) {
      state.generation++;
      console.log(`[typegen] Done in ${elapsed}ms`);
      console.log(`  Fragments: ${result.value.fragmentCount}, Operations: ${result.value.operationCount}`);

      if (result.value.warnings.length > 0) {
        console.log(`  Warnings: ${result.value.warnings.length}`);
        for (const warning of result.value.warnings.slice(0, 3)) {
          console.log(`    - ${warning}`);
        }
        if (result.value.warnings.length > 3) {
          console.log(`    ... and ${result.value.warnings.length - 3} more`);
        }
      }
    } else {
      const error = result.error;
      console.error(`[typegen] Error [${error.code}]: ${error.message}`);

      if (error.code === "TYPEGEN_CODEGEN_REQUIRED") {
        console.error("  Hint: Run 'soda-gql codegen' first.");
      }
    }
  } catch (error) {
    console.error("[typegen] Unexpected error:", error);
  } finally {
    state.isRunning = false;

    // If changes came in during run, trigger another run with accumulated paths
    if (state.pendingRun) {
      state.pendingRun = false;
      const pathsToReport = [...state.pendingPaths];
      state.pendingPaths.clear();
      setTimeout(() => executeRegenerate(config, state, pathsToReport), 50);
    }
  }

  console.log("\n[typegen] Watching for changes... (Ctrl+C to stop)");
};

/**
 * Create a debounced regenerate function that accumulates changed paths.
 */
const createDebouncedRegenerate = (config: ResolvedSodaGqlConfig, state: WatchState): ((paths: readonly string[]) => void) => {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let changedPaths = new Set<string>();

  return (paths: readonly string[]) => {
    // Accumulate changed paths
    for (const path of paths) {
      changedPaths.add(path);
    }

    // Clear existing timeout
    if (timeout) {
      clearTimeout(timeout);
    }

    // Set new timeout
    timeout = setTimeout(() => {
      const pathsToReport = [...changedPaths];
      changedPaths = new Set();
      timeout = null;

      executeRegenerate(config, state, pathsToReport);
    }, DEBOUNCE_MS);
  };
};

/**
 * Run typegen in watch mode.
 *
 * This function watches source files and regenerates prebuilt types on changes.
 * It runs indefinitely until SIGINT/SIGTERM is received.
 *
 * @param options - Watch options including config
 * @returns Never returns (runs indefinitely)
 */
export const runTypegenWatch = async (options: TypegenWatchOptions): Promise<never> => {
  const { config } = options;

  const state: WatchState = {
    isRunning: false,
    pendingRun: false,
    pendingPaths: new Set(),
    generation: 0,
  };

  // Create debounced regenerate function
  const regenerate = createDebouncedRegenerate(config, state);

  // Setup watcher
  const watcher = chokidar.watch([...config.include], {
    ignored: [...config.exclude],
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 100,
      pollInterval: 50,
    },
  });

  // Setup SIGINT/SIGTERM handler for graceful shutdown
  const cleanup = () => {
    console.log("\n[typegen] Shutting down...");
    watcher.close();
    process.exit(0);
  };
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  // Wire up file events
  watcher.on("add", (path) => regenerate([path]));
  watcher.on("change", (path) => regenerate([path]));
  watcher.on("unlink", (path) => regenerate([path]));
  watcher.on("error", (error) => {
    console.error("[typegen] Watcher error:", error);
  });

  // Initial run
  console.log("[typegen] Starting watch mode...");
  console.log(`  Watching: ${config.include.join(", ")}`);
  console.log("");

  await executeRegenerate(config, state, []);

  // Keep alive indefinitely
  await new Promise(() => {});
  throw new Error("unreachable");
};

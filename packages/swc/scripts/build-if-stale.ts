/**
 * Build native module only if it is missing or stale.
 * Uses debug builds for faster iteration during development.
 */

import { spawnSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";

const PACKAGE_ROOT = join(import.meta.dirname, "..");

/**
 * Get the platform-specific native module filename.
 */
const getNativeModulePath = (): string | null => {
  const platform = process.platform;
  const arch = process.arch;

  const platformMap: Record<string, Record<string, string>> = {
    darwin: {
      arm64: "src/native/swc.darwin-arm64.node",
      x64: "src/native/swc.darwin-x64.node",
    },
    linux: {
      x64: "src/native/swc.linux-x64-gnu.node",
      arm64: "src/native/swc.linux-arm64-gnu.node",
    },
    win32: {
      x64: "src/native/swc.win32-x64-msvc.node",
    },
  };

  const platformPaths = platformMap[platform];
  if (!platformPaths) {
    return null;
  }
  return platformPaths[arch] ?? null;
};

/**
 * Get the most recent modification time of Rust source files.
 */
const getSourceMtime = (): number => {
  const rustFiles = [
    "src/lib.rs",
    "src/transform/mod.rs",
    "src/transform/analysis.rs",
    "src/transform/imports.rs",
    "src/transform/metadata.rs",
    "src/transform/runtime.rs",
    "src/transform/transformer.rs",
    "src/types/mod.rs",
    "src/types/artifact.rs",
    "src/types/config.rs",
    "Cargo.toml",
    "Cargo.lock",
  ];

  let latestMtime = 0;
  for (const file of rustFiles) {
    const fullPath = join(PACKAGE_ROOT, file);
    if (existsSync(fullPath)) {
      const stat = statSync(fullPath);
      latestMtime = Math.max(latestMtime, stat.mtimeMs);
    }
  }
  return latestMtime;
};

const main = () => {
  const moduleRelativePath = getNativeModulePath();
  if (!moduleRelativePath) {
    console.log("[build-if-stale] Unsupported platform, skipping build");
    process.exit(0);
  }

  const modulePath = join(PACKAGE_ROOT, moduleRelativePath);
  const sourceMtime = getSourceMtime();

  // Check if module exists
  if (!existsSync(modulePath)) {
    console.log("[build-if-stale] Native module missing, building (debug)...");
    const result = spawnSync("bun", ["run", "build:debug"], {
      cwd: PACKAGE_ROOT,
      stdio: "inherit",
    });
    process.exit(result.status ?? 1);
  }

  // Check if module is stale
  const moduleStat = statSync(modulePath);
  if (sourceMtime > moduleStat.mtimeMs) {
    console.log("[build-if-stale] Native module is stale, rebuilding (debug)...");
    const result = spawnSync("bun", ["run", "build:debug"], {
      cwd: PACKAGE_ROOT,
      stdio: "inherit",
    });
    process.exit(result.status ?? 1);
  }

  console.log("[build-if-stale] Native module is up to date");
};

main();

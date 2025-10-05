# @soda-gql/config Package Implementation Plan (Refined)

## Overview

Create a new package `@soda-gql/config` to centralize configuration management across all soda-gql packages (builder, codegen, plugins).

## Goals

1. **Single source of truth**: All tools use the same config file (`soda-gql.config.ts`)
2. **Type safety**: TypeScript-based config with helper functions
3. **Path resolution**: Automatic resolution with proper ESM module specifiers
4. **Gradual migration**: Support CLI override during deprecation period
5. **Test support**: Easy generation of temporary config files for tests
6. **Future-proof**: Support multi-project workspaces and async configs

## Package Structure

```
packages/config/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts              # Public API exports
│   ├── types.ts              # Config type definitions
│   ├── loader.ts             # Config file loading with tsx/esbuild
│   ├── path-resolver.ts      # Path resolution with extension mapping
│   ├── helper.ts             # defineConfig/defineWorkspace helpers
│   ├── validator.ts          # Zod-based validation
│   ├── errors.ts             # Error taxonomy
│   ├── defaults.ts           # Default values and constants
│   └── test-utils.ts         # Test helpers (withTempConfig, etc.)
└── README.md
```

## Implementation Steps

### Phase 1: Package Setup

1. **Create package.json**
   - Name: `@soda-gql/config`
   - Version: `0.1.0`
   - Dependencies: `neverthrow`, `zod`, `esbuild` (for TS loading)
   - Exports: ESM only with both sync/async entry points

2. **Create tsconfig.json**
   - Extend from workspace config
   - Target: ES2022
   - Module: ESNext

3. **Setup build configuration**
   - Output to `dist/`
   - Type declarations included

### Phase 2: Type Definitions (`types.ts`)

**Refined with domain separation and multi-project support**:

```typescript
// Builder-specific config
export type BuilderConfig = {
  readonly entry: readonly string[];
  readonly outDir: string;
  readonly analyzer?: "ts" | "babel";
  readonly mode?: "runtime" | "zero-runtime";
};

// Codegen-specific config
export type CodegenConfig = {
  readonly schema: string;
  readonly outDir: string;
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
  // Single project mode (simpler)
  readonly graphqlSystemPath?: string;
  readonly corePath?: string;
  readonly builder?: BuilderConfig;
  readonly codegen?: CodegenConfig;
  readonly plugins?: PluginConfig;

  // Multi-project mode
  readonly projects?: Record<string, ProjectConfig>;
  readonly defaultProject?: string;
};

// Resolved config (normalized and validated)
export type ResolvedSodaGqlConfig = {
  readonly graphqlSystemPath: string;
  readonly corePath: string;
  readonly builder: Required<BuilderConfig>;
  readonly codegen?: Required<CodegenConfig>;
  readonly plugins: PluginConfig;
  readonly configDir: string;
  readonly configPath: string;
  readonly configHash: string; // For cache invalidation
  readonly configMtime: number; // For watch mode
};
```

### Phase 3: Errors and Defaults (`errors.ts`, `defaults.ts`)

**errors.ts**:
```typescript
export type ConfigErrorCode =
  | "CONFIG_NOT_FOUND"
  | "CONFIG_LOAD_FAILED"
  | "CONFIG_VALIDATION_FAILED"
  | "CONFIG_INVALID_PATH";

export type ConfigError = {
  readonly code: ConfigErrorCode;
  readonly message: string;
  readonly filePath?: string;
  readonly cause?: unknown;
};

export const configError = (
  code: ConfigErrorCode,
  message: string,
  filePath?: string,
  cause?: unknown,
): ConfigError => ({ code, message, filePath, cause });
```

**defaults.ts**:
```typescript
export const DEFAULT_CONFIG_FILENAMES = [
  "soda-gql.config.ts",
  "soda-gql.config.mts",
  "soda-gql.config.js",
  "soda-gql.config.mjs",
] as const;

export const DEFAULT_BUILDER_CONFIG: Required<BuilderConfig> = {
  entry: [],
  outDir: "./.cache/soda-gql",
  analyzer: "ts",
  mode: "runtime",
};

export const DEFAULT_CORE_PATH = "@soda-gql/core";
```

### Phase 4: Helper Functions (`helper.ts`)

**Support both sync and async configs**:

```typescript
/**
 * Type-safe helper for defining soda-gql configuration.
 * Supports both static and dynamic (async) configs.
 *
 * @example Static config
 * import { defineConfig } from "@soda-gql/config";
 *
 * export default defineConfig({
 *   graphqlSystemPath: "./src/graphql-system/index.ts",
 *   builder: {
 *     entry: ["./src/**\/*.ts"],
 *     outDir: "./.cache",
 *   },
 * });
 *
 * @example Async config
 * export default defineConfig(async () => ({
 *   graphqlSystemPath: await resolveGraphqlSystem(),
 *   builder: { entry: ["./src/**\/*.ts"], outDir: "./.cache" },
 * }));
 */
export function defineConfig(
  config: SodaGqlConfig | (() => SodaGqlConfig) | (() => Promise<SodaGqlConfig>)
): SodaGqlConfig | (() => SodaGqlConfig) | (() => Promise<SodaGqlConfig>) {
  return config;
}

/**
 * Define multi-project workspace configuration.
 *
 * @example
 * export default defineWorkspace({
 *   defaultProject: "web",
 *   projects: {
 *     web: { graphqlSystemPath: "./apps/web/graphql-system" },
 *     mobile: { graphqlSystemPath: "./apps/mobile/graphql-system" },
 *   },
 * });
 */
export function defineWorkspace(config: SodaGqlConfig): SodaGqlConfig {
  return config;
}
```

### Phase 5: Config Loader (`loader.ts`)

**Use esbuild for TypeScript execution**:

```typescript
import { build } from "esbuild";
import { readFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";

/**
 * Find config file by walking up directory tree.
 */
export function findConfigFile(startDir: string = process.cwd()): string | null {
  let currentDir = startDir;
  while (currentDir !== dirname(currentDir)) {
    for (const filename of DEFAULT_CONFIG_FILENAMES) {
      const configPath = join(currentDir, filename);
      if (existsSync(configPath)) {
        return configPath;
      }
    }
    currentDir = dirname(currentDir);
  }
  return null;
}

/**
 * Load and execute TypeScript config file using esbuild.
 */
async function executeConfigFile(configPath: string): Promise<unknown> {
  // Bundle config file to temp location
  const outfile = join(tmpdir(), `soda-gql-config-${Date.now()}.mjs`);

  await build({
    entryPoints: [configPath],
    outfile,
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node18",
  });

  // Dynamic import the bundled file
  const configModule = await import(`file://${outfile}?t=${Date.now()}`);

  // Clean up temp file
  unlinkSync(outfile);

  let config = configModule.default ?? configModule;

  // Handle async config functions
  if (typeof config === "function") {
    config = await config();
  }

  return config;
}

/**
 * Load config with Result type (for library use).
 */
export async function loadConfig(
  configPath?: string
): Promise<Result<ResolvedSodaGqlConfig, ConfigError>> {
  const resolvedPath = configPath ?? findConfigFile();

  if (!resolvedPath) {
    return err(configError("CONFIG_NOT_FOUND", "Config file not found"));
  }

  try {
    const rawConfig = await executeConfigFile(resolvedPath);
    const validated = validateConfig(rawConfig);

    if (validated.isErr()) {
      return err(validated.error);
    }

    return resolveConfig(validated.value, resolvedPath);
  } catch (error) {
    return err(configError(
      "CONFIG_LOAD_FAILED",
      `Failed to load config: ${error}`,
      resolvedPath,
      error,
    ));
  }
}

/**
 * Load config or throw (for CLI/app use).
 */
export async function loadConfigOrThrow(configPath?: string): Promise<ResolvedSodaGqlConfig> {
  const result = await loadConfig(configPath);
  if (result.isErr()) {
    throw new Error(result.error.message);
  }
  return result.value;
}

/**
 * Load config from specific directory.
 */
export async function loadConfigFrom(dir: string): Promise<Result<ResolvedSodaGqlConfig, ConfigError>> {
  const configPath = findConfigFile(dir);
  return loadConfig(configPath ?? undefined);
}
```

### Phase 6: Path Resolver (`path-resolver.ts`)

**Preserve extensions with mapping strategy**:

```typescript
/**
 * Map source extensions to emit extensions.
 * ESM requires explicit extensions in import specifiers.
 */
const EXTENSION_MAP: Record<string, string> = {
  ".ts": ".js",
  ".tsx": ".js",
  ".mts": ".mjs",
  ".cts": ".cjs",
};

/**
 * Resolve import path with proper ESM module specifier.
 * Does NOT strip extensions - maps .ts to .js for emitted files.
 */
export function resolveImportPath(
  fromDir: string,
  toPath: string,
  emitted: boolean = true // Whether target is emitted JS or source TS
): string {
  const absoluteTo = isAbsolute(toPath) ? toPath : resolve(fromDir, toPath);

  let relativePath = relative(fromDir, absoluteTo).replace(/\\/g, "/");

  if (!relativePath.startsWith(".")) {
    relativePath = `./${relativePath}`;
  }

  // Map extensions if target is emitted
  if (emitted) {
    for (const [srcExt, emitExt] of Object.entries(EXTENSION_MAP)) {
      if (relativePath.endsWith(srcExt)) {
        return relativePath.slice(0, -srcExt.length) + emitExt;
      }
    }
  }

  return relativePath;
}

/**
 * Get gql import path from resolved config.
 */
export function getGqlImportPath(config: ResolvedSodaGqlConfig): string {
  return resolveImportPath(
    config.builder.outDir,
    config.graphqlSystemPath,
    true // Emitted JS
  );
}

/**
 * Get @soda-gql/core import path from resolved config.
 */
export function getCoreImportPath(config: ResolvedSodaGqlConfig): string {
  return resolveImportPath(
    config.builder.outDir,
    config.corePath,
    false // Source - package exports handle this
  );
}
```

### Phase 7: Validator (`validator.ts`)

**Normalize paths and inject defaults**:

```typescript
import { z } from "zod";

const BuilderConfigSchema = z.object({
  entry: z.array(z.string()).min(1),
  outDir: z.string().min(1),
  analyzer: z.enum(["ts", "babel"]).default("ts"),
  mode: z.enum(["runtime", "zero-runtime"]).default("runtime"),
});

const CodegenConfigSchema = z.object({
  schema: z.string().min(1),
  outDir: z.string().min(1),
});

const ProjectConfigSchema = z.object({
  graphqlSystemPath: z.string().min(1),
  corePath: z.string().optional(),
  builder: BuilderConfigSchema.optional(),
  codegen: CodegenConfigSchema.optional(),
  plugins: z.record(z.unknown()).optional(),
});

const SodaGqlConfigSchema = z.object({
  // Single project mode
  graphqlSystemPath: z.string().optional(),
  corePath: z.string().optional(),
  builder: BuilderConfigSchema.optional(),
  codegen: CodegenConfigSchema.optional(),
  plugins: z.record(z.unknown()).optional(),

  // Multi-project mode
  projects: z.record(ProjectConfigSchema).optional(),
  defaultProject: z.string().optional(),
});

export function validateConfig(config: unknown): Result<SodaGqlConfig, ConfigError> {
  const result = SodaGqlConfigSchema.safeParse(config);

  if (!result.success) {
    return err(configError(
      "CONFIG_VALIDATION_FAILED",
      `Invalid config: ${result.error.message}`,
    ));
  }

  return ok(result.data);
}

/**
 * Resolve and normalize config with defaults.
 */
export function resolveConfig(
  config: SodaGqlConfig,
  configPath: string,
): Result<ResolvedSodaGqlConfig, ConfigError> {
  const configDir = dirname(configPath);

  // Normalize to absolute paths
  const resolveFromConfig = (path: string): string => {
    return isAbsolute(path) ? path : resolve(configDir, path);
  };

  // Handle single-project mode
  if (!config.projects) {
    if (!config.graphqlSystemPath) {
      return err(configError(
        "CONFIG_VALIDATION_FAILED",
        "graphqlSystemPath is required in single-project mode",
      ));
    }

    // Compute config hash for cache invalidation
    const stats = statSync(configPath);
    const configHash = createHash("sha256")
      .update(readFileSync(configPath))
      .digest("hex")
      .slice(0, 16);

    return ok({
      graphqlSystemPath: resolveFromConfig(config.graphqlSystemPath),
      corePath: config.corePath
        ? resolveFromConfig(config.corePath)
        : resolveFromConfig(DEFAULT_CORE_PATH),
      builder: {
        ...DEFAULT_BUILDER_CONFIG,
        ...config.builder,
        entry: (config.builder?.entry ?? []).map(resolveFromConfig),
        outDir: resolveFromConfig(config.builder?.outDir ?? DEFAULT_BUILDER_CONFIG.outDir),
      },
      codegen: config.codegen ? {
        schema: resolveFromConfig(config.codegen.schema),
        outDir: resolveFromConfig(config.codegen.outDir),
      } : undefined,
      plugins: config.plugins ?? {},
      configDir,
      configPath,
      configHash,
      configMtime: stats.mtimeMs,
    });
  }

  // TODO: Multi-project mode support
  return err(configError(
    "CONFIG_VALIDATION_FAILED",
    "Multi-project mode not yet implemented",
  ));
}
```

### Phase 8: Test Utilities (`test-utils.ts`)

**Generate configs via template literals, not JSON.stringify**:

```typescript
/**
 * Create temporary config file with proper formatting.
 * Uses template literals to support functions, regex, etc.
 */
export function withTempConfig<T>(
  config: Partial<SodaGqlConfig>,
  fn: (configPath: string) => Promise<T>
): Promise<T> {
  const tmpDir = mkdtempSync(join(tmpdir(), "soda-gql-test-"));
  const configPath = join(tmpDir, "soda-gql.config.ts");

  // Generate config file using template
  const configContent = `
import { defineConfig } from "@soda-gql/config";

export default defineConfig({
  graphqlSystemPath: ${JSON.stringify(config.graphqlSystemPath)},
  ${config.corePath ? `corePath: ${JSON.stringify(config.corePath)},` : ""}
  builder: {
    entry: ${JSON.stringify(config.builder?.entry ?? [])},
    outDir: ${JSON.stringify(config.builder?.outDir ?? ".cache")},
    ${config.builder?.analyzer ? `analyzer: ${JSON.stringify(config.builder.analyzer)},` : ""}
    ${config.builder?.mode ? `mode: ${JSON.stringify(config.builder.mode)},` : ""}
  },
  ${config.codegen ? `codegen: ${JSON.stringify(config.codegen)},` : ""}
  ${config.plugins ? `plugins: ${JSON.stringify(config.plugins)},` : ""}
});
`.trim();

  writeFileSync(configPath, configContent);

  return fn(configPath).finally(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });
}

/**
 * Simple temp config creation (without auto-cleanup).
 */
export function createTempConfigFile(
  dir: string,
  config: Partial<SodaGqlConfig>
): string {
  const configPath = join(dir, "soda-gql.config.ts");

  const configContent = `
import { defineConfig } from "@soda-gql/config";

export default defineConfig(${JSON.stringify(config, null, 2)});
`.trim();

  writeFileSync(configPath, configContent);
  return configPath;
}
```

## Migration Path

### Step 1: Create @soda-gql/config package
- Implement all core functionality
- Add comprehensive tests
- Document API with examples

### Step 2: Deprecation period (1-2 releases)
- Update builder to support BOTH config and CLI
- CLI flags override config values (with deprecation warnings)
- Emit warnings when CLI flags are used
- Provide automatic config generation: `soda-gql init`

```typescript
// During deprecation period
const config = await loadConfig();
const finalConfig = config.isOk()
  ? mergeWithCliOverrides(config.value, cliArgs)
  : buildConfigFromCliArgs(cliArgs);

if (hasCliArgs(cliArgs)) {
  console.warn("⚠️  CLI flags are deprecated. Create soda-gql.config.ts");
  console.warn("Run 'soda-gql init' to generate config from current flags");
}
```

### Step 3: Update tests
- Create test helper utilities (`withTempConfig`)
- Migrate all integration tests
- Update unit tests

### Step 4: Update other packages
- `@soda-gql/codegen`: Add config loading
- `@soda-gql/plugin-*`: Add config loading

### Step 5: Remove CLI parameters (breaking release)
- Delete CLI parsing code
- Config file becomes required
- Provide clear error if config not found with setup instructions
- Update all documentation

### Step 6: Future enhancements
- Add `extends` support for config inheritance
- Add preset system for common configurations
- Multi-project workspace support
- IDE tooling (JSON schema, VS Code extension)

## Testing Strategy

### Unit Tests

```typescript
import { describe, test, expect } from "bun:test";
import { withTempConfig } from "@soda-gql/config/test-utils";

describe("config loader", () => {
  test("loads valid TypeScript config", async () => {
    await withTempConfig({
      graphqlSystemPath: "./graphql-system/index.ts",
      builder: {
        entry: ["./src/**/*.ts"],
        outDir: "./.cache",
      },
    }, async (configPath) => {
      const result = await loadConfig(configPath);
      expect(result.isOk()).toBe(true);

      const config = result._unsafeUnwrap();
      expect(config.graphqlSystemPath).toContain("graphql-system");
      expect(config.builder.entry.length).toBeGreaterThan(0);
    });
  });

  test("supports async config functions", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "test-"));
    const configPath = join(tmpDir, "soda-gql.config.ts");

    writeFileSync(configPath, `
      import { defineConfig } from "@soda-gql/config";

      export default defineConfig(async () => ({
        graphqlSystemPath: "./graphql-system/index.ts",
        builder: { entry: ["./src/**/*.ts"], outDir: ".cache" },
      }));
    `);

    const result = await loadConfig(configPath);
    expect(result.isOk()).toBe(true);
  });
});
```

### Integration Tests

```typescript
// Before
const session = createBuilderSession();
await session.buildInitial({
  mode: "runtime",
  entry: ["./src/**/*.ts"],
  analyzer: "ts",
});

// After
await withTempConfig({
  graphqlSystemPath: "./graphql-system/index.ts",
  builder: {
    entry: ["./src/**/*.ts"],
    outDir: "./.cache",
  },
}, async (configPath) => {
  const config = await loadConfigOrThrow(configPath);
  const session = createBuilderSession(config);
  await session.buildInitial();
});
```

## Success Criteria

- ✅ TypeScript config files load correctly with esbuild
- ✅ Both sync and async configs supported
- ✅ Paths resolve correctly with proper ESM extensions
- ✅ Multi-project support architecture in place
- ✅ Config hash/mtime tracked for cache invalidation
- ✅ Helper functions provide full type safety
- ✅ Test utilities make temp config generation easy
- ✅ Deprecation period allows gradual migration
- ✅ Error messages are clear and actionable
- ✅ All tests pass with new config system
- ✅ Documentation is complete with examples

## Timeline

- **Phase 1-3**: Package setup, types, errors, defaults (1 session)
- **Phase 4-6**: Helper, loader, resolver, validator (2 sessions)
- **Phase 7**: Test utilities and unit tests (1 session)
- **Phase 8**: Builder integration with dual support (1 session)
- **Phase 9**: Test migration (1 session)
- **Phase 10**: CLI removal and final docs (1 session)

**Total estimate**: 7 sessions

## Key Improvements from Codex Feedback

1. ✅ **TypeScript execution strategy**: Use esbuild to bundle and execute TS configs
2. ✅ **Extension mapping**: Preserve extensions, map .ts → .js for emitted files
3. ✅ **Domain-separated config**: Builder/codegen/plugins have their own sections
4. ✅ **Multi-project support**: Architecture ready for workspace configs
5. ✅ **Async config support**: Functions and promises supported
6. ✅ **Better helpers**: `loadConfigOrThrow`, `withTempConfig`, etc.
7. ✅ **Error taxonomy**: Dedicated error types in `errors.ts`
8. ✅ **Defaults file**: Centralized default values
9. ✅ **Cache metadata**: Hash and mtime for invalidation
10. ✅ **Gradual migration**: CLI override during deprecation period

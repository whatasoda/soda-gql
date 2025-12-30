# Monorepo Infrastructure Guide

This document provides a comprehensive overview of the soda-gql monorepo infrastructure, including workspace management, build orchestration, type system configuration, and testing conventions.

## Table of Contents

1. [Workspace Layout](#workspace-layout)
2. [Package Management](#package-management)
3. [Build System](#build-system)
4. [Type System & Module Resolution](#type-system--module-resolution)
5. [Example Applications](#example-applications)
6. [Testing Infrastructure](#testing-infrastructure)
7. [Development Workflow](#development-workflow)

---

## Workspace Layout

The soda-gql project is organized as a Bun workspace monorepo with the following structure:

```
soda-gql/
├── packages/           # All published packages
│   ├── builder/
│   ├── cli/
│   ├── codegen/
│   ├── common/
│   ├── config/
│   ├── core/
│   ├── plugin-babel/
│   ├── plugin-nestjs/
│   ├── plugin-shared/
│   └── runtime/
├── playgrounds/        # Development/testing playgrounds
│   ├── nextjs-webpack/
│   ├── vite-react/
│   ├── expo-metro/
│   └── nestjs-compiler-tsc/
├── tests/              # All test suites
│   ├── unit/
│   ├── integration/
│   └── fixtures/
└── scripts/            # Build and utility scripts
    ├── sync-exports.ts
    └── generated/
```

### Workspace Configuration

The workspace is defined in the root `package.json`:

```json
{
  "workspaces": ["packages/*", "playgrounds/*"]
}
```

This configuration:
- Enables dependency hoisting across all packages and playgrounds
- Allows cross-package references using workspace protocol
- Provides unified dependency management via Bun

---

## Package Management

### Package Structure

Each package follows a consistent structure:

```
packages/<package-name>/
├── src/                   # Source code
├── dist/                  # Build output (generated)
├── @x-*.ts                # Public export files (e.g., @x-index.ts, @x-runtime.ts)
├── @devx-*.ts             # Dev-only export files (e.g., @devx-test.ts)
├── package.json           # Package manifest
└── tsconfig.editor.json   # TypeScript configuration
```

### Export Management System

The project uses a **file-based export convention** with `@x-*` and `@devx-*` files at each package root.

#### File-Based Export Convention

Each package defines its exports using specially-named files at the package root:

| Pattern | Export Type | Example |
|---------|-------------|---------|
| `@x-index.ts` | Root export (`.`) | `export * from "./src/index"` |
| `@x-{name}.ts` | Sub-export (`./name`) | `@x-runtime.ts` → `./runtime` |
| `@x-{name}/index.ts` | Directory export | `@x-runtime/index.ts` → `./runtime` |
| `@devx-{name}.ts` | Dev-only export | `@devx-test.ts` → `./test` (only `@soda-gql` condition) |

**Example: `packages/core/`**
```
packages/core/
├── @x-index.ts      # export * from "./src/index"      → "."
├── @x-runtime.ts    # export * from "./src/runtime"    → "./runtime"
├── @x-metadata.ts   # export * from "./src/metadata"   → "./metadata"
└── src/
    ├── index.ts
    ├── runtime/
    └── metadata/
```

**Example: `packages/common/`** (with dev export)
```
packages/common/
├── @x-index.ts      # Public export → "."
├── @x-portable.ts   # Public export → "./portable"
├── @devx-test.ts    # Dev-only export → "./test" (@soda-gql condition only)
└── src/
```

#### Synchronization Script

The `scripts/sync-exports.ts` script:

1. **Discovers** `@x-*` and `@devx-*` files from each package root
2. **Generates** package.json exports with proper conditions:
   ```json
   {
     "exports": {
       ".": {
         "@soda-gql": "./@x-index.ts",
         "types": "./dist/index.d.ts",
         "import": "./dist/index.js",
         "require": "./dist/index.cjs",
         "default": "./dist/index.js"
       },
       "./test": {
         "@soda-gql": "./@devx-test.ts"
       }
     }
   }
   ```

#### Export Conditions

- **`@soda-gql`**: Points to source files (used by tests and examples via `--conditions=@soda-gql`)
- **`types`**: TypeScript declaration files
- **`import`**: ESM output
- **`require`**: CommonJS output
- **`default`**: Fallback to ESM

Dev-only exports (`@devx-*`) only include the `@soda-gql` condition.

### Running Export Sync

```bash
bun run exports:sync
# or
bun scripts/sync-exports.ts
```

This must be run:
- Before building packages
- After adding/removing `@x-*` or `@devx-*` files
- When creating new packages

---

## Build System

### Build Tools

- **Bundler**: `tsdown` (TypeScript bundler)
- **TypeScript**: Version 5.9.2+
- **Runtime**: Bun (for scripts and tests)

### Build Configuration

The `tsdown.config.ts` orchestrates builds for all packages:

```typescript
export default defineConfig([
  {
    name: "@soda-gql/core",
    outDir: "packages/core/dist",
    entry: packageEntries["@soda-gql/core"],
    format: ["esm", "cjs"],
    platform: "neutral",
    external: ["graphql"],
    // ...
  },
  // ... other packages
]);
```

#### Key Configuration Aspects

1. **Entry Points**: Loaded from `scripts/generated/exports-manifest.js`
2. **Format**: Dual ESM/CJS output for most packages
3. **External Dependencies**: Host bundler dependencies (webpack, Babel) are externalized
4. **Treeshaking**: Disabled for packages with heavy Node.js usage
5. **Aliases**: Source-to-source aliases for cross-package imports during build

### Build Commands

```bash
# Full build (sync + bundle)
bun run build

# Watch mode
bun run build:watch

# Clean build artifacts
bun run clean:dist
```

### Build Output

Each package generates:
- `dist/*.js` - ESM modules
- `dist/*.cjs` - CommonJS modules
- `dist/*.d.ts` - TypeScript declarations
- `dist/*.js.map` - Source maps

---

## Type System & Module Resolution

### TypeScript Project References

The monorepo uses **TypeScript project references** for efficient incremental compilation and proper IDE support.

#### Root Configuration (`tsconfig.json`)

```json
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "composite": true,
    "baseUrl": ".",
    "paths": {
      "@soda-gql/core/*": ["./packages/core/src/*"],
      "@soda-gql/builder/*": ["./packages/builder/src/*"],
      // ... all packages
    }
  },
  "references": [
    { "path": "./packages/core/tsconfig.editor.json" },
    { "path": "./packages/builder/tsconfig.editor.json" },
    // ... all packages and examples
  ]
}
```

#### Editor Configuration (`tsconfig.editor.json`)

Each package and the root have an editor configuration:

```json
{
  "extends": ["./tsconfig.json", "./tsconfig.base.json"],
  "compilerOptions": {
    "composite": true,
    "noEmit": false,
    "outDir": ".typecheck/root",
    "tsBuildInfoFile": ".typecheck/root/tsconfig.tsbuildinfo"
  }
}
```

**Purpose**:
- Provides IDE with incremental build information
- Outputs type check results to `.typecheck/` directories
- Enables fast "Go to Definition" across packages

### Module Resolution Strategy

#### For Development (tests, scripts, examples)

Uses **source-based resolution** via `customConditions: ["development"]`:

```json
{
  "compilerOptions": {
    "customConditions": ["development"]
  }
}
```

When this condition is set:
- Imports resolve to `./src/index.ts` (source files)
- Changes are immediately visible without rebuilding
- Type checking validates source code

#### For Production

Uses **dist-based resolution**:
- Imports resolve to `./dist/index.js` or `./dist/index.cjs`
- Requires building packages first
- Consumes published package format

### Path Mapping

#### In Tests and Scripts

`tsconfig.json` defines paths for all packages:

```json
{
  "paths": {
    "@soda-gql/core/*": ["./packages/core/src/*"],
    "@/graphql-system": ["./tests/fixtures/runtime-app/graphql-system/index.ts"]
  }
}
```

#### In Examples

Each example defines its own path mapping via symlink to the shared codegen-fixture:

**`playgrounds/vite-react/tsconfig.editor.json`**:
```json
{
  "paths": {
    "@/graphql-system": ["./codegen-fixture/graphql-system/index.ts"]
  },
  "references": [
    { "path": "../../packages/core/tsconfig.editor.json" },
    { "path": "../../packages/runtime/tsconfig.editor.json" }
  ]
}
```

This ensures:
- Examples only reference packages they depend on
- Generated GraphQL systems are resolved correctly
- IDE provides accurate type information

### Type Checking Commands

```bash
# Type check all packages and examples
bun typecheck

# Type check with incremental build (faster)
tsc -b
```

---

## Example Applications

Example applications demonstrate how to use soda-gql in real projects.

### Example TypeScript Configuration

Each example requires a `tsconfig.editor.json` for integrated type checking with the monorepo.

#### Base Template

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "composite": true,
    "customConditions": ["@soda-gql"],
    "outDir": "../../node_modules/.soda-gql/.typecheck/playgrounds/{playground-name}",
    "tsBuildInfoFile": "../../node_modules/.soda-gql/.typecheck/playgrounds/{playground-name}/tsconfig.tsbuildinfo",
    "rootDir": ".",
    "baseUrl": ".",
    "paths": {
      "@/graphql-system": ["./codegen-fixture/graphql-system/index.ts"]
    }
  },
  "include": ["src/**/*", "codegen-fixture/**/*"],
  "references": [
    { "path": "../../packages/core/tsconfig.editor.json" },
    { "path": "../../packages/runtime/tsconfig.editor.json" }
  ]
}
```

**Note**: Examples use symlinks to `tests/codegen-fixture/` for the shared GraphQL system. See [Shared codegen-fixture](#shared-codegen-fixture) for details.

#### Key Configuration Options

| Option | Purpose |
|--------|---------|
| `composite: true` | Required for TypeScript project references |
| `customConditions: ["@soda-gql"]` | Resolves imports to source files during development |
| `outDir` / `tsBuildInfoFile` | Outputs type check artifacts to `node_modules/.soda-gql/.typecheck/` |
| `paths` | Maps `@/graphql-system` to the generated graphql-system |
| `references` | Links to package tsconfig.editor.json files the example depends on |

#### Framework-Specific Settings

**React Projects** (vite-react, nextjs-webpack):
```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM", "DOM.Iterable"]
  }
}
```

**Next.js Projects** (additional path mappings):
```json
{
  "compilerOptions": {
    "paths": {
      "@/graphql-system": ["./codegen-fixture/graphql-system/index.ts"],
      "@/graphql/*": ["./src/graphql/*"]
    }
  }
}
```

**Browser Projects** (webpack-swc, expo-metro):
```json
{
  "compilerOptions": {
    "lib": ["ES2022", "DOM", "DOM.Iterable"]
  }
}
```

#### Root tsconfig.editor.json References

Each playground must be referenced in the root `tsconfig.editor.json`:

```json
{
  "references": [
    { "path": "./playgrounds/nestjs-compiler-tsc/tsconfig.editor.json" },
    { "path": "./playgrounds/nextjs-webpack/tsconfig.editor.json" },
    { "path": "./playgrounds/vite-react/tsconfig.editor.json" },
    { "path": "./playgrounds/expo-metro/tsconfig.editor.json" }
  ]
}
```

#### Creating a New Playground

1. Create `playgrounds/{name}/tsconfig.editor.json` using the base template
2. Add framework-specific settings if needed (jsx, lib, types)
3. Add any custom path mappings for the project
4. Add reference to root `tsconfig.editor.json`
5. Run `bun typecheck` to verify configuration

### Module Resolution in Playgrounds

Playgrounds resolve modules through:

1. **Workspace Dependencies**: Packages are linked via Bun workspaces
2. **Development Condition**: `customConditions: ["development"]` resolves to source files
3. **Path Mapping**: Local graphql-system resolved via `paths` configuration
4. **Project References**: TypeScript validates types across referenced packages

### Running Playgrounds

```bash
# Navigate to specific playground
cd playgrounds/<playground-name>
bun install
bun run dev
```

---

## Testing Infrastructure

### Test Organization

```
tests/
├── unit/                    # Unit tests for individual modules
│   ├── plugin-babel/
│   ├── plugin-nestjs/
│   └── ...
├── integration/             # End-to-end integration tests
├── codegen-fixture/         # Shared GraphQL schemas and generated code
│   ├── schemas/             # GraphQL schema definitions
│   │   └── default/
│   │       └── schema.graphql
│   └── graphql-system/      # Generated type-safe GraphQL system
│       ├── index.ts
│       ├── types.ts
│       └── ...
├── fixtures/                # Test fixtures and sample code
│   ├── runtime-app/         # Generated GraphQL system for tests
│   ├── plugin-babel/        # Babel transformation fixtures
│   └── ...
└── utils/                   # Testing utilities
```

### Shared codegen-fixture

The `tests/codegen-fixture/` directory contains a shared GraphQL schema and generated type-safe code used across packages and examples. This ensures consistent testing and avoids duplicating schema definitions.

#### Structure

```
tests/codegen-fixture/
├── schemas/
│   └── default/
│       └── schema.graphql    # Shared GraphQL schema
└── graphql-system/
    ├── index.ts              # Main entry point
    ├── types.ts              # Generated TypeScript types
    ├── operations.ts         # Operation helpers
    └── ...
```

The shared schema includes common types:
- **User**: id, name, email, posts(categoryId, limit)
- **Post**: id, title, body
- **Product**: id, name, price

#### Symlink Pattern

Packages and examples create symlinks to `tests/codegen-fixture` to share the generated code without duplication:

**Package Example** (`packages/builder/test/`):
```
packages/builder/test/
└── codegen-fixture -> ../../../tests/codegen-fixture
```

**Playground** (`playgrounds/vite-react/`):
```
playgrounds/vite-react/
└── codegen-fixture -> ../../tests/codegen-fixture
```

#### Creating Symlinks

For packages:
```bash
cd packages/<package-name>/test
ln -s ../../../tests/codegen-fixture codegen-fixture
```

For playgrounds:
```bash
cd playgrounds/<playground-name>
ln -s ../../tests/codegen-fixture codegen-fixture
```

#### TypeScript Configuration

When using the shared codegen-fixture, update `tsconfig.editor.json`:

```json
{
  "compilerOptions": {
    "paths": {
      "@/graphql-system": ["./codegen-fixture/graphql-system/index.ts"]
    }
  },
  "include": ["src/**/*", "codegen-fixture/**/*"]
}
```

**Key Points**:
- The `paths` mapping resolves `@/graphql-system` imports to the symlinked fixture
- Including `codegen-fixture/**/*` ensures the schemas are part of the TypeScript project (required for relative imports within graphql-system)

#### Regenerating the Fixture

If you modify the shared schema:

```bash
bun run fixture:setup
```

This regenerates `tests/codegen-fixture/graphql-system/` from the schema files.

### Test Configuration

**`bunfig.toml`**:
```toml
[test]
root = "./tests"
```

**Test TypeScript Configuration** (`tests/tsconfig.typecheck.json`):
```json
{
  "compilerOptions": {
    "moduleResolution": "Bundler",
    "allowImportingTsExtensions": true,
    "strict": false,
    "paths": {
      "@soda-gql/core": ["packages/core/src/index.ts"],
      "@/graphql-system": ["tests/fixtures/runtime-app/graphql-system/index.ts"]
    }
  }
}
```

**Key Points**:
- Tests resolve to package **source files** via path mapping
- Fixtures are type-checked independently
- `moduleResolution: "Bundler"` allows `.ts` imports

### Testing Conventions

#### Fixture-Based Testing

**Anti-pattern** (inline strings):
```typescript
const source = `import { gql } from "@/graphql-system"; ...`;
const result = transform(source);
```

**Recommended** (fixture files):
```typescript
// tests/fixtures/my-test/slices.ts
import { gql } from "@/graphql-system";

export const userSlice = gql.default(({ slice , $var }) =>
  slice.query({
    variables: { ...$var("id").ID("!") },
    fields: ({ f, $ }) => ({
      ...f.user({ id: $.id })(({ f }) => ({ ...f.id(), ...f.name() })),
    }),
    select: ({ select }) => select(["$.user"], (result) => result),
  }),
);

// tests/fixtures/my-test/source.ts
import { gql } from "@/graphql-system";
import { userSlice } from "./slices";

export const query = gql.default(({ operation , $var }) =>
  operation.query({
    name: "MyTestQuery",
    variables: { ...$var("userId").ID("!") },
    fields: ({ $ }) => ({
      user: userSlice.build({ id: $.userId }),
    }),
  }),
);

// tests/unit/my-test.test.ts
const fixturePath = "./fixtures/my-test/source.ts";
const source = await readFile(fixturePath, "utf-8");
const result = transform({ filePath: fixturePath, source });
```

**Benefits**:
- Fixtures are type-checked by TypeScript
- Editor support (autocomplete, refactoring)
- Use `@ts-expect-error` for intentionally invalid cases

#### Behavioral Testing

**Test behavior, not implementation details**:

```typescript
// ❌ Bad: Testing transformation output format
expect(transformed).toContain("gqlRuntime.operation");

// ✅ Good: Testing runtime behavior
const transpiled = new Bun.Transpiler().transformSync(transformed);
const module = await import(`file://${outputPath}?t=${Date.now()}`);
expect(registeredOperations).toHaveLength(1);
```

#### Integration Test Utilities

- **Registry Reset**: `__resetRuntimeRegistry()` from `@soda-gql/core/runtime`
- **Transpilation**: `new Bun.Transpiler()` for executing transformed code
- **Cache Busting**: Dynamic imports with `?t=${Date.now()}` query parameter

### Running Tests

```bash
# Run all tests
bun test

# Run specific test file
bun test tests/unit/plugin-babel/adapter.test.ts

# Run with custom conditions (development mode)
bun --conditions=development test

# Run with coverage (if configured)
bun test --coverage
```

### Test Validation

The project includes a test validation script:

```bash
bun run validate:tests
```

This ensures:
- All test files are properly organized
- Fixtures are correctly referenced
- No duplicate test names

---

## Development Workflow

### Initial Setup

```bash
# Install dependencies
bun install

# Generate fixture GraphQL system
bun run fixture:setup

# Sync package exports
bun run exports:sync

# Build all packages
bun run build
```

### Daily Development

#### Working on a Package

```bash
# Make changes to source files in packages/<name>/src/

# Run tests (no build needed - uses source via development condition)
bun test tests/unit/<name>/

# Type check
bun typecheck

# Lint and format
bun run biome:check
```

#### Adding a New Export

1. Create an `@x-*` file at the package root:
   ```typescript
   // packages/<name>/@x-new-export.ts
   export * from "./src/new-export";
   ```

2. Add the pattern to `tsconfig.editor.json` if not already present:
   ```json
   {
     "include": ["src/**/*", "test/**/*", "@x-*.ts", "@devx-*.ts"]
   }
   ```

3. Sync exports:
   ```bash
   bun run exports:sync
   ```

4. Build and verify:
   ```bash
   bun run build
   ```

#### Creating a New Package

1. Create package directory:
   ```bash
   mkdir -p packages/new-package/src
   ```

2. Create `package.json`:
   ```json
   {
     "name": "@soda-gql/new-package",
     "version": "0.1.0",
     "type": "module",
     "sideEffects": false
   }
   ```

3. Create `@x-index.ts` (root export):
   ```typescript
   export * from "./src/index";
   ```

4. Create `tsconfig.editor.json`:
   ```json
   {
     "extends": "../../tsconfig.base.json",
     "compilerOptions": {
       "composite": true,
       "outDir": "../../node_modules/.soda-gql/.typecheck/new-package",
       "tsBuildInfoFile": "../../node_modules/.soda-gql/.typecheck/new-package/tsconfig.tsbuildinfo",
       "rootDir": "."
     },
     "include": ["src/**/*", "@x-*.ts"]
   }
   ```

5. Add package to root `tsconfig.json`:
   ```json
   {
     "references": [
       { "path": "./packages/new-package/tsconfig.editor.json" }
     ]
   }
   ```

6. Add package to root `package.json` devDependencies:
   ```json
   {
     "devDependencies": {
       "@soda-gql/new-package": "workspace:*"
     }
   }
   ```
   Then run `bun install` to create workspace symlinks.

7. Add package to `tsdown.config.ts`:
   ```typescript
   {
     ...common("@soda-gql/new-package"),
     format: ["esm", "cjs"],
     platform: "node",
     external: [/* dependencies */]
   }
   ```

8. Sync exports and build:
   ```bash
   bun run exports:sync
   bun run build
   ```

### Quality Checks

Before committing:

```bash
# Run full quality check suite
bun run quality
# This runs:
# - bun run validate:tests (test structure validation)
# - bun run typecheck (type checking)
# - bun run biome:check (linting + formatting)
```

### Troubleshooting

#### Type Errors Across Packages

```bash
# Clean TypeScript build info
rm -rf .typecheck

# Rebuild type information
bun typecheck
```

#### Module Resolution Issues in Tests

```bash
# Verify development condition is set
# In test files, check that tsconfig has:
"customConditions": ["development"]

# Regenerate exports manifest
bun run exports:sync
```

#### Build Failures

```bash
# Clean all build artifacts
bun run clean:dist

# Regenerate exports
bun run exports:sync

# Rebuild from scratch
bun run build
```

---

## Summary

The soda-gql monorepo infrastructure provides:

1. **Workspace Management**: Bun workspaces with unified dependency management
2. **Export System**: File-based `@x-*` / `@devx-*` convention with automated synchronization
3. **Build Pipeline**: tsdown-based bundling with dual ESM/CJS output
4. **Type System**: TypeScript project references with development/production conditions
5. **Module Resolution**: Source-based (dev) and dist-based (prod) resolution
6. **Testing**: Fixture-based testing with behavioral validation
7. **Examples**: Real-world integration examples with proper isolation

This infrastructure enables:
- Fast iteration without rebuilding (development condition)
- Type-safe cross-package development
- Reliable testing with real dependencies
- Clear separation between source and dist

For questions or improvements, refer to the main [CLAUDE.md](../../CLAUDE.md) contributing guide.

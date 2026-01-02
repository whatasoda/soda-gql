# Pre-built Artifact Mode

soda-gql supports two build modes for transforming GraphQL operations:

- **Dynamic mode** (default): Artifacts are built at build time by analyzing source files
- **Pre-built mode**: Artifacts are loaded from a pre-generated JSON file

Pre-built mode is useful for:
- CI/CD pipelines where build time is critical
- Production builds where source analysis is unnecessary
- Environments where the builder dependencies are not available

## Environment Variable Access

The `soda-gql.config.ts` file has full access to `process.env`, enabling dynamic configuration based on environment variables.

```typescript
// soda-gql.config.ts
import { defineConfig } from "@soda-gql/config";

export default defineConfig({
  outdir: "./graphql-system",
  include: ["./src/**/*.ts"],
  schemas: {
    default: {
      schema: "./schema.graphql",
      inject: "./inject.ts",
    },
  },
  // Use pre-built artifact in CI or production
  artifact: process.env.CI || process.env.NODE_ENV === "production"
    ? { path: "./dist/soda-gql-artifact.json" }
    : undefined,
});
```

## Configuration

### Artifact Option

The `artifact` option in `soda-gql.config.ts` controls pre-built mode:

```typescript
type ArtifactConfig = {
  /**
   * Path to pre-built artifact JSON file.
   * Resolved relative to the config file's directory.
   */
  path?: string;
};
```

When `artifact.path` is specified, plugins will:
1. Load the artifact from the specified file
2. Skip dynamic building entirely
3. Use the pre-loaded artifact for all transformations

## CLI Commands

### Building Artifacts

Generate a pre-built artifact file:

```bash
# Basic usage
soda-gql artifact build

# Specify output path
soda-gql artifact build --output ./dist/soda-gql-artifact.json

# Specify custom version
soda-gql artifact build --version "1.0.0"

# Dry run (validate only)
soda-gql artifact build --dry-run
```

### Validating Artifacts

Validate an existing artifact file:

```bash
soda-gql artifact validate ./dist/soda-gql-artifact.json
```

This will:
- Validate the JSON structure
- Report element counts (fragments, operations)
- Display metadata (version, creation timestamp) if present

## CI/CD Workflow

A typical CI/CD workflow using pre-built artifacts:

### 1. Build Artifact in CI

```yaml
# .github/workflows/build.yml
jobs:
  build:
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Generate GraphQL types
        run: npx soda-gql codegen

      - name: Build soda-gql artifact
        run: npx soda-gql artifact build --output ./dist/soda-gql-artifact.json

      - name: Build application
        run: npm run build
        env:
          CI: true  # Triggers pre-built artifact mode
```

### 2. Configure for Pre-built Mode

```typescript
// soda-gql.config.ts
export default defineConfig({
  // ... other options
  artifact: process.env.CI
    ? { path: "./dist/soda-gql-artifact.json" }
    : undefined,
});
```

## Artifact Format

The artifact file is a JSON file with the following structure:

```json
{
  "meta": {
    "version": "0.7.0",
    "createdAt": "2024-01-15T10:30:00.000Z"
  },
  "elements": {
    "src/queries/user.ts::getUser": {
      "id": "src/queries/user.ts::getUser",
      "type": "operation",
      "metadata": {
        "sourcePath": "/path/to/src/queries/user.ts",
        "contentHash": "abc123..."
      },
      "prebuild": {
        "operationType": "query",
        "operationName": "GetUser",
        "document": { /* DocumentNode */ },
        "variableNames": ["userId"]
      }
    }
    // ... more elements
  },
  "report": {
    "durationMs": 1234,
    "warnings": [],
    "stats": {
      "hits": 10,
      "misses": 5,
      "skips": 0
    }
  }
}
```

### Meta Field

The `meta` field contains:
- `version`: The soda-gql version used to generate the artifact
- `createdAt`: ISO 8601 timestamp of artifact creation

This metadata is used for debugging and can help identify stale artifacts.

## Best Practices

1. **Version Artifacts**: Use `--version` flag to embed custom version strings for tracking
2. **Validate Before Deploy**: Run `soda-gql artifact validate` in CI before deployment
3. **Gitignore Artifacts**: Add artifact files to `.gitignore` (they should be generated in CI)
4. **Cache Artifacts**: Consider caching artifact files in CI for faster rebuilds

## Troubleshooting

### Artifact Not Found

If you see "Artifact file not found" error:
1. Ensure `soda-gql artifact build` was run before the application build
2. Check that the path in config matches the output path from build command
3. Verify the file exists at the expected location

### Version Mismatch Warning

If you see a version mismatch warning:
- This is non-blocking but indicates the artifact was built with a different soda-gql version
- Consider rebuilding the artifact with the current version

### Invalid Artifact Structure

If validation fails:
1. Regenerate the artifact with `soda-gql artifact build`
2. Check for manual edits to the artifact file
3. Ensure the file is not corrupted

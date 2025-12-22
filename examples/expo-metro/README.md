# Expo Metro Example

This example demonstrates how to use `@soda-gql/metro-plugin` with Expo for zero-runtime GraphQL transformations.

## Project Structure

```
expo-metro/
├── App.tsx                  # Verification UI showing operation metadata
├── src/
│   └── graphql/
│       ├── models.ts        # User/Post model definitions
│       ├── slices.ts        # Query/mutation slices
│       └── operations.ts    # Composed GraphQL operations
├── inject-module/
│   ├── runtime-adapter.ts   # Scalar and adapter definitions
│   └── helpers.ts           # Helper functions
├── graphql-system/          # Generated (after codegen)
├── metro.config.js          # Metro config with withSodaGql()
├── soda-gql.config.ts       # soda-gql configuration
└── schema.graphql           # GraphQL schema
```

## Setup

### 1. Install Dependencies

```bash
cd examples/expo-metro
bun install
```

### 2. Generate GraphQL System

```bash
bun codegen
```

This generates the `graphql-system/` directory with type-safe GraphQL utilities.

## Verification Steps

### Step 1: Start Development Server

```bash
bun start
```

This starts the Expo development server with Metro bundler.

### Step 2: Open the App

- Press `w` to open in web browser
- Press `i` to open in iOS Simulator
- Press `a` to open in Android Emulator
- Or scan the QR code with Expo Go app

### Step 3: Verify Transformation

The app displays a verification UI showing:

1. **Transformation Status**: Shows "SUCCESS - Metadata present" if the metro-plugin correctly transformed the soda-gql code.

2. **Operation Metadata**: Displays the generated metadata for each operation:
   - GetUser Query
   - ListUsers Query
   - UpdateUser Mutation

If you see the metadata JSON objects, the transformation is working correctly.

### Step 4: Verify Hot Reload (Optional)

1. While the dev server is running, edit `src/graphql/models.ts`
2. Add or modify a field in the model
3. Save the file
4. Check if the app updates with the new metadata

**Note**: If changes are not reflected, restart Metro with cache clearing:

```bash
bun start:clear
```

## Troubleshooting

### "No compatible Metro Babel transformer found"

This error means the metro-plugin couldn't find an upstream transformer. Ensure `expo` is properly installed:

```bash
bun install
```

### Changes Not Reflecting

If changes to GraphQL files are not reflected:

1. Try saving the file again
2. Restart with cache clearing: `bun start:clear`

### Type Errors in GraphQL Files

Ensure you've run codegen to generate the graphql-system:

```bash
bun codegen
```

## How It Works

1. **metro.config.js** wraps the Metro configuration with `withSodaGql()`:
   ```javascript
   const { withSodaGql } = require("@soda-gql/metro-plugin");
   module.exports = withSodaGql(config);
   ```

2. **Metro bundler** uses the soda-gql transformer which:
   - Detects files containing soda-gql definitions
   - Transforms `gql.default(...)` calls to runtime operation registrations
   - Adds metadata including operation name, query string, and variables

3. **At runtime**, operations have a `.metadata` property containing:
   - `operationName`: The GraphQL operation name
   - `query`: The generated GraphQL query string
   - `variables`: Variable definitions

## Configuration Options

### metro.config.js

```javascript
const { withSodaGql } = require("@soda-gql/metro-plugin");

module.exports = withSodaGql(config, {
  // Path to soda-gql config (default: auto-detected)
  configPath: "./soda-gql.config.ts",

  // Enable/disable plugin (default: true)
  enabled: process.env.NODE_ENV !== "test",

  // Enable debug logging (default: false)
  debug: true,
});
```

## Related Documentation

- [Metro Plugin README](../../packages/metro-plugin/README.md)
- [soda-gql Documentation](../../README.md)

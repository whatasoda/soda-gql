# @soda-gql/metro-plugin

Metro bundler plugin for soda-gql with support for Expo and React Native projects.

## Installation

```bash
npm install @soda-gql/metro-plugin
# or
yarn add @soda-gql/metro-plugin
# or
bun add @soda-gql/metro-plugin
```

## Usage

### Expo Projects

```javascript
// metro.config.js
const { getDefaultConfig } = require("expo/metro-config");
const { withSodaGql } = require("@soda-gql/metro-plugin");

const config = getDefaultConfig(__dirname);
module.exports = withSodaGql(config);
```

### React Native (bare) Projects

```javascript
// metro.config.js
const { getDefaultConfig, mergeConfig } = require("@react-native/metro-config");
const { withSodaGql } = require("@soda-gql/metro-plugin");

const config = getDefaultConfig(__dirname);
module.exports = withSodaGql(config);
```

### With Options

```javascript
// metro.config.js
const { getDefaultConfig } = require("expo/metro-config");
const { withSodaGql } = require("@soda-gql/metro-plugin");

const config = getDefaultConfig(__dirname);
module.exports = withSodaGql(config, {
  // Optional: Path to soda-gql config file
  configPath: "./soda-gql.config.ts",

  // Optional: Enable/disable the plugin (default: true)
  enabled: process.env.NODE_ENV !== "test",

  // Optional: Enable debug logging (default: false)
  debug: process.env.DEBUG === "true",
});
```

## How It Works

1. **Transformer Wrapping**: The plugin wraps Metro's default Babel transformer.

2. **Build-Time Transformation**: When Metro processes a file:
   - Checks if the file contains soda-gql elements
   - If yes, applies the soda-gql Babel transformation
   - Passes the result to the upstream transformer for final processing

3. **Cache Invalidation**: The transformer includes a `getCacheKey()` function that:
   - Incorporates the artifact generation number
   - Ensures Metro invalidates cache when soda-gql models change

## Upstream Transformer Detection

The plugin automatically detects and uses the appropriate upstream transformer:

1. **Expo**: `@expo/metro-config/babel-transformer`
2. **React Native 0.73+**: `@react-native/metro-babel-transformer`
3. **Legacy React Native**: `metro-react-native-babel-transformer`

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `configPath` | `string` | `undefined` | Path to soda-gql config file |
| `enabled` | `boolean` | `true` | Enable/disable the plugin |
| `debug` | `boolean` | `false` | Enable verbose logging |
| `upstreamTransformer` | `string` | `undefined` | Explicit path to upstream transformer to chain |

## Watch Mode Considerations

Metro's watch mode behavior differs from webpack:

- **Cache Key Based**: When soda-gql files change, the transformer's cache key changes, triggering re-transformation of affected files.

- **Development Server**: During active development, if you modify model files and don't see changes reflected:
  1. Save the file again to trigger a rebuild
  2. If needed, restart Metro with `--reset-cache` flag

```bash
# Expo
npx expo start --clear

# React Native
npx react-native start --reset-cache
```

## Chaining with Other Transformers

When using other Metro transformers (e.g., react-native-svg-transformer), soda-gql automatically detects and chains with them.

### How Chaining Works

When an upstream transformer is detected, soda-gql generates a wrapper transformer file in `node_modules/.cache/soda-gql/`. This wrapper:

1. Hardcodes the upstream transformer path at build time
2. Enables reliable chaining in Metro worker processes
3. Is automatically regenerated when the upstream path changes

### Automatic Chaining (Recommended)

If you set `babelTransformerPath` before calling `withSodaGql`, it will be automatically preserved and chained:

```javascript
// metro.config.js
const { getDefaultConfig } = require("expo/metro-config");
const { withSodaGql } = require("@soda-gql/metro-plugin");

const config = getDefaultConfig(__dirname);

// Set the other transformer first
config.transformer.babelTransformerPath = require.resolve("react-native-svg-transformer");

// soda-gql will automatically chain with it
module.exports = withSodaGql(config);
```

### Explicit Upstream Transformer

You can also explicitly specify the upstream transformer via options:

```javascript
// metro.config.js
const { getDefaultConfig } = require("expo/metro-config");
const { withSodaGql } = require("@soda-gql/metro-plugin");

const config = getDefaultConfig(__dirname);
module.exports = withSodaGql(config, {
  upstreamTransformer: require.resolve("react-native-svg-transformer"),
});
```

## Troubleshooting

### "No compatible Metro Babel transformer found"

This error occurs when none of the supported upstream transformers are installed. Ensure you have one of:

- `@expo/metro-config` (Expo projects)
- `@react-native/metro-babel-transformer` (React Native 0.73+)
- `metro-react-native-babel-transformer` (Legacy React Native)

### Changes not reflected in development

1. Try saving the file again
2. Restart Metro with cache clearing:
   ```bash
   npx expo start --clear
   # or
   npx react-native start --reset-cache
   ```

### Type errors in metro.config.js

If using TypeScript for your Metro config, you may need to add type annotations:

```typescript
// metro.config.ts
import { getDefaultConfig } from "expo/metro-config";
import { withSodaGql } from "@soda-gql/metro-plugin";

const config = getDefaultConfig(__dirname);
export default withSodaGql(config);
```

## License

MIT

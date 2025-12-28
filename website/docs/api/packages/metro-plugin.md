# @soda-gql/metro-plugin

Metro bundler plugin for React Native and Expo projects.

## Installation

```bash
bun add -D @soda-gql/metro-plugin
```

## Expo Projects

Configure in `metro.config.js`:

```javascript
const { getDefaultConfig } = require("expo/metro-config");
const { withSodaGql } = require("@soda-gql/metro-plugin");

const config = getDefaultConfig(__dirname);

module.exports = withSodaGql(config);
```

## React Native (Bare) Projects

```javascript
const { getDefaultConfig, mergeConfig } = require("@react-native/metro-config");
const { withSodaGql } = require("@soda-gql/metro-plugin");

const config = mergeConfig(getDefaultConfig(__dirname), {
  // Your custom config
});

module.exports = withSodaGql(config);
```

## Plugin Options

```javascript
module.exports = withSodaGql(config, {
  configPath: "./soda-gql.config.ts",  // Custom config file path
  enabled: true,                       // Enable/disable plugin
  debug: false,                        // Enable debug logging
});
```

### Options Reference

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `configPath` | `string` | Auto-detected | Path to soda-gql config file |
| `enabled` | `boolean` | `true` | Enable or disable the plugin |
| `debug` | `boolean` | `false` | Enable debug logging |

## How It Works

The plugin wraps Metro's transformer to process soda-gql files:

1. **Transformer Wrapping**: Intercepts files before standard transformation
2. **Build-time Processing**: Analyzes and transforms soda-gql code
3. **Upstream Passing**: Passes transformed code to the original transformer

### Upstream Transformer Detection

The plugin automatically detects the upstream transformer:

| Environment | Transformer |
|-------------|-------------|
| Expo | `expo-module-scripts/babel-transformer` |
| React Native 0.73+ | `@react-native/metro-babel-transformer` |
| Legacy | `metro-react-native-babel-transformer` |

## Watch Mode

During development, Metro watches for file changes. soda-gql integrates with this:

### Cache Behavior

Metro caches transformed files. When you modify a soda-gql file:

1. The file's cache is invalidated
2. The plugin re-transforms the file
3. Metro rebuilds the bundle

### Cache Key

The plugin uses a unique cache key that includes:
- soda-gql version
- Configuration hash
- Source file hash

### Manual Cache Clearing

If you experience stale transformations:

```bash
# Expo
npx expo start --clear

# React Native CLI
npx react-native start --reset-cache
```

## Babel Transformer

The Metro plugin uses the Babel transformer for compatibility with React Native's build pipeline.

## Troubleshooting

### "Module not found" Errors

Ensure your `tsconfig.json` paths align with Metro's resolver:

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "@/graphql-system": ["./src/graphql-system"]
    }
  }
}
```

Configure Metro's resolver in `metro.config.js`:

```javascript
module.exports = withSodaGql({
  ...config,
  resolver: {
    ...config.resolver,
    extraNodeModules: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
```

### Transformation Not Applied

1. Clear Metro's cache: `npx expo start --clear`
2. Verify config file is detected: Enable `debug: true`
3. Check include patterns match your files

### Slow Initial Build

The first build analyzes all files. Subsequent builds are faster due to caching.

To improve initial build time:
- Use more specific `include` patterns
- Add `exclude` patterns for test files during development

## Requirements

- Metro bundler (via Expo or React Native)
- Node.js >= 18
- soda-gql configuration file

## Related

- [Expo Recipe](/recipes/expo) for complete setup guide
- [@soda-gql/config](/api/packages/config) for configuration options

# soda-gql Examples

This directory contains practical examples demonstrating different integration methods for soda-gql.

> **⚠️ Status Note (v0.1.0 Pre-release)**: The compiler plugin examples (TypeScript/SWC) demonstrate infrastructure and configuration. These plugins currently provide detection-only implementation and do not yet perform full zero-runtime transformation. The webpack example is fully functional. See [plugin status documentation](../docs/status/plugin-nestjs.md) for details.

## Available Examples

### NestJS Integration

Choose the integration method that best fits your project:

#### 1. [nestjs-compiler-tsc](./nestjs-compiler-tsc) - TypeScript Compiler Plugin ⭐ **Recommended**

**Best for:** Most projects, especially those preferring standard TypeScript tooling

**Current Status (v0.1.0)**:
- ✅ No webpack dependency
- ✅ Works with standard `nest build` command
- ✅ Simple configuration
- ✅ Detection infrastructure in place
- ⏳ Zero-runtime transformation planned

**When to use:**
- You want to prepare for webpack-free zero-runtime setup
- You prefer TypeScript's official compiler
- You need maximum compatibility

#### 2. [nestjs-compiler-swc](./nestjs-compiler-swc) - SWC Compiler Plugin ⚡

**Best for:** Large projects requiring fastest possible builds

**Current Status (v0.1.0)**:
- ✅ 20x faster compilation than TypeScript
- ✅ No webpack dependency
- ✅ Detection infrastructure in place
- ✅ Excellent for large codebases
- ✅ Production-ready compiler (used by Vercel, Next.js)
- ⏳ Zero-runtime transformation planned

**When to use:**
- You have a large codebase (>100 files)
- Build speed is critical
- You're comfortable with Rust-based tooling

#### 3. [nestjs-app](./nestjs-app) - Webpack Plugin ✨ **Fully Functional**

**Best for:** Projects needing working zero-runtime transformation today

**Current Status** *(production-ready)*:
- ✅ Full zero-runtime transformation
- ✅ Integrated watch mode
- ✅ Automatic artifact generation
- ✅ Development error reporting
- ✅ Hot module replacement support

**When to use:**
- You need zero-runtime transformation working today
- You're already using webpack
- You want integrated development workflow

### Babel Integration

#### 4. [babel-app](./babel-app) - Babel Plugin

**Best for:** Non-NestJS Node.js applications or custom build setups

- ✅ Framework-agnostic
- ✅ Works with any bundler
- ✅ Flexible configuration

**When to use:**
- You're not using NestJS
- You have a custom build setup with Babel
- You need maximum flexibility

## Quick Comparison

| Feature | TSC Plugin | SWC Plugin | Webpack Plugin | Babel Plugin |
|---------|-----------|-----------|----------------|--------------|
| Build Speed | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ |
| Setup Complexity | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| Zero-Runtime | ⏳ Planned | ⏳ Planned | ✅ Working | ✅ Working |
| Nest Integration | ✅ | ✅ | ✅ | ❌ |
| Watch Mode | Manual | Manual | Integrated | Manual |
| Webpack Required | ❌ | ❌ | ✅ | ❌ |

## Getting Started

1. **Choose an example** based on your needs
2. **Navigate to the example directory**
   ```bash
   cd examples/nestjs-compiler-tsc  # or your chosen example
   ```
3. **Follow the README** in that directory

## Common Setup Steps

All examples follow similar setup steps:

```bash
# 1. Install dependencies (from repo root)
bun install

# 2. Navigate to example
cd examples/<example-name>

# 3. Generate GraphQL system
bun run codegen

# 4. Generate artifact (for compiler plugins)
bun run artifact

# 5. Build and run
bun run build
bun run start
```

## Development Workflow

### For Compiler Plugins (TSC/SWC)

```bash
# Terminal 1: Watch artifact generation
bun run artifact --watch

# Terminal 2: Watch NestJS app
bun run dev
```

### For Webpack Plugin

```bash
# Single command with integrated watch
bun run dev
```

## Learning Path

**New to soda-gql?** Follow this path:

1. Start with [nestjs-compiler-tsc](./nestjs-compiler-tsc)
   - Simplest setup
   - Most documentation
   - Best for learning

2. Explore [nestjs-app](./nestjs-app) (webpack)
   - See integrated workflow
   - Understand artifact generation
   - Learn development patterns

3. Try [nestjs-compiler-swc](./nestjs-compiler-swc)
   - Experience build speed improvements
   - Compare with TSC plugin
   - Understand tradeoffs

4. Check [babel-app](./babel-app)
   - Understand framework-agnostic usage
   - Learn custom integration patterns

## Migration Between Examples

### From Webpack to Compiler Plugins

Main changes needed:

1. **Update nest-cli.json**
   ```diff
   {
     "compilerOptions": {
   -   "builder": "webpack",
   -   "webpackConfigPath": "webpack.config.js"
   +   "builder": "tsc",  // or "swc"
   +   "plugins": [       // or "swcPlugins"
   +     {
   +       "name": "@soda-gql/plugin-nestjs/compiler/tsc",
   +       "options": {
   +         "artifactPath": "./.cache/soda-gql-artifact.json",
   +         "mode": "zero-runtime"
   +       }
   +     }
   +   ]
     }
   }
   ```

2. **Remove webpack.config.js**

3. **Add artifact generation script**
   ```json
   {
     "scripts": {
       "artifact": "soda-gql builder --mode zero-runtime --entry ./src/**/*.ts --out .cache/soda-gql-artifact.json"
     }
   }
   ```

### From TSC to SWC

Simple change in `nest-cli.json`:

```diff
{
  "compilerOptions": {
-   "builder": "tsc",
-   "plugins": [
+   "builder": "swc",
+   "swcPlugins": [
      [
-       {
-         "name": "@soda-gql/plugin-nestjs/compiler/tsc",
-         "options": { ... }
-       }
+       "@soda-gql/plugin-nestjs/compiler/swc",
+       { ... }
      ]
    ]
  }
}
```

## Troubleshooting

See individual example READMEs for specific troubleshooting guides.

### Common Issues

1. **Artifact not found**
   - Run `bun run artifact` before building
   - Check artifact path in configuration

2. **Type errors**
   - Run `bun run codegen` to regenerate GraphQL system
   - Ensure schema is up to date

3. **Plugin not transforming (compiler plugins)**
   - Note: TSC/SWC plugins don't transform yet (detection-only in v0.1.0)
   - For working transformation, use webpack or babel plugins
   - Check [plugin status documentation](../docs/status/plugin-nestjs.md)

## Contributing

To add a new example:

1. Create a new directory in `examples/`
2. Add a comprehensive README
3. Include working package.json and configuration
4. Update this README with a link
5. Test the example thoroughly

## Support

- **Documentation**: [packages/plugin-nestjs/README.md](../packages/plugin-nestjs/README.md)
- **Issues**: [GitHub Issues](https://github.com/anthropics/soda-gql/issues)
- **Discussions**: [GitHub Discussions](https://github.com/anthropics/soda-gql/discussions)

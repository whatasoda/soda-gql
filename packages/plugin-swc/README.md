# @soda-gql/plugin-swc

🚧 **Under Development** - SWC compiler plugin for soda-gql zero-runtime GraphQL transformations.

## Status

This plugin is currently **under active development** and not yet ready for production use. The transformation logic and API are subject to change.

For production use, please use [@soda-gql/plugin-babel](../plugin-babel) instead.

## Planned Features

- ⚡ Ultra-fast transformations with SWC's Rust-based compiler
- 🔄 Same transformation logic as plugin-babel
- 📦 Support for both ESM and CommonJS module formats
- 🔥 HMR support for development workflows
- ✨ Full TypeScript support

## Future Installation

```bash
# Not yet available
bun add -D @soda-gql/plugin-swc @soda-gql/cli
bun add @soda-gql/runtime
```

## Planned Configuration

### SWC Configuration (.swcrc)

```json
{
  "jsc": {
    "experimental": {
      "plugins": [
        [
          "@soda-gql/plugin-swc",
          {
            "configPath": "./soda-gql.config.ts",
            "artifact": {
              "useBuilder": true
            }
          }
        ]
      ]
    }
  }
}
```

### Next.js Configuration

```javascript
// next.config.js
module.exports = {
  experimental: {
    swcPlugins: [
      [
        "@soda-gql/plugin-swc",
        {
          configPath: "./soda-gql.config.ts",
          artifact: {
            useBuilder: true,
          },
        },
      ],
    ],
  },
};
```

## Why SWC?

SWC (Speedy Web Compiler) is a Rust-based JavaScript/TypeScript compiler that is significantly faster than Babel:

- **10-20x faster** than Babel in typical projects
- **Built-in TypeScript** support without additional plugins
- **Growing ecosystem** with Next.js, Vite, and other modern tools

Once complete, this plugin will provide the same zero-runtime transformation capabilities as plugin-babel, but with dramatically improved build performance.

## Development Progress

- [x] Package structure and dependencies
- [x] Type definitions and shared utilities
- [x] AST traversal and metadata collection
- [x] Runtime call generation
- [x] Import management
- [x] ESM/CJS module format support
- [x] Core transformation logic
- [ ] JavaScript plugin API limitations (see Technical Challenges below)
- [ ] Integration tests (blocked by plugin API issues)
- [ ] HMR support
- [ ] Production testing and validation
- [ ] Documentation and examples

## Technical Challenges

### JavaScript Plugin API Limitations

SWC's JavaScript plugin API has significant limitations that prevent full implementation:

- **AST Serialization**: Custom-generated AST nodes cause `ctxt` field deserialization errors
- **API Deprecation**: SWC is moving away from JavaScript plugins toward Rust/WebAssembly plugins
- **Limited Documentation**: JavaScript plugin API is not officially documented or supported

**Impact**: The transformation logic is complete and correct, but cannot be executed through SWC's JavaScript plugin interface.

**Recommended Alternatives**:
1. Use [@soda-gql/plugin-babel](../plugin-babel) for production (fully functional)
2. Use [@soda-gql/plugin-vite](../plugin-vite) for Vite projects
3. Wait for official SWC WebAssembly plugin support
4. Consider contributing a Rust-based SWC plugin

## Current Workaround

While this plugin is in development, use [@soda-gql/plugin-babel](../plugin-babel) for all build scenarios. Babel provides excellent compatibility and is production-ready.

## Architecture Comparison

| Aspect | plugin-babel | plugin-swc (Planned) |
|--------|--------------|----------------------|
| Compiler | Babel (JavaScript) | SWC (Rust) |
| Speed | Good | Excellent (10-20x faster) |
| Ecosystem | Mature | Growing |
| Configuration | .babelrc / babel.config.js | .swcrc / swc.config.js |
| Production Ready | ✅ Yes | 🚧 In Development |

## Contributing

This plugin needs help! If you're interested in contributing:

1. Review the [plugin-babel source](../plugin-babel/src) for reference implementation
2. Check the [plugin-common](../plugin-common) package for shared utilities
3. See [CLAUDE.md](../../CLAUDE.md) for contribution guidelines

Key areas needing work:
- SWC visitor pattern implementation
- AST node type mappings (SWC vs Babel)
- Module system transformations
- Test coverage

## Timeline

No specific release date is set. Development is ongoing as time permits. Updates will be posted in the project's changelog.

## Questions?

For questions or to contribute, please open an issue in the main repository.

## License

MIT

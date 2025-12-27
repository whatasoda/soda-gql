# soda-gql Playgrounds

This directory contains playgrounds for testing and verifying different integration methods for soda-gql.

> **Note**: These are development/testing playgrounds, not production-ready examples. Proper examples will be provided separately in an appropriate format.

## Available Playgrounds

### Web Frameworks

#### [nextjs-webpack](./nextjs-webpack) - Next.js + Webpack + SWC

**Features:**
- Next.js 15 with App Router
- Webpack plugin integration
- SWC transformer for fast builds
- API route examples

#### [vite-react](./vite-react) - Vite + React

**Features:**
- Vite 6 with React 19
- Fragment colocation pattern
- Component-based fragment organization

### Mobile

#### [expo-metro](./expo-metro) - Expo + Metro

**Features:**
- React Native / Expo
- Metro bundler integration
- Verification UI for metadata

### Backend

#### [nestjs-compiler-tsc](./nestjs-compiler-tsc) - NestJS + TSC Plugin

**Features:**
- TypeScript compiler plugin
- No webpack dependency
- Detection infrastructure (transformation planned)

## Quick Comparison

| Playground | Framework | Bundler | Transformer | Zero-Runtime |
|------------|-----------|---------|-------------|--------------|
| nextjs-webpack | Next.js 15 | Webpack | SWC | Working |
| vite-react | Vite 6 | Rollup | Babel | Working |
| expo-metro | Expo | Metro | Babel | Working |
| nestjs-compiler-tsc | NestJS | TSC | TSC | Detection-only |

## Getting Started

1. **Install dependencies** (from repo root)
   ```bash
   bun install
   ```

2. **Navigate to a playground**
   ```bash
   cd playgrounds/<playground-name>
   ```

3. **Generate GraphQL system**
   ```bash
   bun run codegen
   ```

4. **Build and run**
   ```bash
   bun run build
   bun run start  # or dev
   ```

## Support

- **Issues**: [GitHub Issues](https://github.com/whatasoda/soda-gql/issues)
- **Discussions**: [GitHub Discussions](https://github.com/whatasoda/soda-gql/discussions)

#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# @swc/core is resolved from each soda-gql.config.ts location at runtime via createRequire.
# No platform-specific binaries need to be bundled in the VSIX.

# Remove stale node_modules from dist (defense-in-depth; .vscodeignore also excludes)
rm -rf "$SCRIPT_DIR/dist/node_modules"

# Build with release profile (no sourcemaps, minified)
cd "$SCRIPT_DIR"
SODA_GQL_RELEASE=1 node build.mjs

# Package VSIX
bunx vsce package --no-dependencies "$@"

#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# @swc/core is resolved from the user's workspace node_modules at runtime via NODE_PATH.
# No platform-specific binaries need to be bundled in the VSIX.

# Remove stale node_modules from dist (defense-in-depth; .vscodeignore also excludes)
rm -rf "$SCRIPT_DIR/dist/node_modules"

# Package VSIX
cd "$SCRIPT_DIR"
bunx vsce package --no-dependencies "$@"

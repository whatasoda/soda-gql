#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MONOREPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DIST_NODE_MODULES="$SCRIPT_DIR/dist/node_modules"

# Clean previous @swc copies
rm -rf "$DIST_NODE_MODULES/@swc"

# Copy @swc/core and its runtime dependencies into dist/node_modules/
# so that dist/server.js can resolve require("@swc/core") at runtime.
# Uses -L to dereference symlinks (bun workspace links).
mkdir -p "$DIST_NODE_MODULES/@swc"
cp -rL "$MONOREPO_ROOT/node_modules/@swc/core" "$DIST_NODE_MODULES/@swc/"
cp -rL "$MONOREPO_ROOT/node_modules/@swc/counter" "$DIST_NODE_MODULES/@swc/"
cp -rL "$MONOREPO_ROOT/node_modules/@swc/types" "$DIST_NODE_MODULES/@swc/"

# Copy platform-specific native bindings (only those installed on this machine)
for dir in "$MONOREPO_ROOT/node_modules/@swc/core-"*; do
  if [ -d "$dir" ]; then
    cp -rL "$dir" "$DIST_NODE_MODULES/@swc/"
  fi
done

# Package VSIX
cd "$SCRIPT_DIR"
bunx vsce package --no-dependencies "$@"

# Cleanup
rm -rf "$DIST_NODE_MODULES"

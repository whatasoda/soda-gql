# Work Status: NestJS Example Fix

**Date**: 2025-10-15
**Branch**: `feat/prepare-for-release`
**Task**: Fix examples/nestjs-app to work correctly with code transformation

## Current Status: IN PROGRESS

### Summary
The NestJS example app builds successfully but code transformation is not working due to canonical ID resolution issues with CommonJS exports. The webpack loader recognizes the transformed code but cannot match it with the artifact file.

---

## Completed Tasks ✅

### 1. Webpack Configuration Fixes
- [x] Converted `webpack.config.js` to `webpack.config.cjs` (CommonJS format)
- [x] Updated `nest-cli.json` to reference `webpack.config.cjs`
- [x] Added webpack loader configuration with `enforce: "post"` and `test: /\.[jt]sx?$/`
- [x] Set `mode: "zero-runtime"` for code transformation
- [x] Removed `"type": "module"` from `package.json` for CJS compatibility

### 2. Config Loader Fixes
- [x] Changed esbuild output from ESM (`.mjs`) to CommonJS (`.cjs`) to support Node.js built-ins
- [x] Fixed double-wrapped default export issue (`configModule.default?.default ?? configModule.default ?? configModule`)
- [x] Added `esbuild` to external dependencies in `tsdown.config.ts`
- [x] Created `soda-gql.config.ts` with `graphqlSystemPath` configuration
- [x] Added `ts-loader` dependency

### 3. Plugin Bundling Fixes
- [x] Fixed `init_cache` bundling by using explicit named exports instead of wildcard exports
- [x] Added `./webpack` and `./webpack/loader` exports to `plugin-nestjs/exports.json`
- [x] Externalized Babel packages in `tsdown.config.ts` for plugin-nestjs:
  - `@babel/core`
  - `@babel/parser`
  - `@babel/traverse`
  - `@babel/types`
- [x] Reduced webpack loader size from 2209 KB to 25 KB

### 4. AST Recognition Fixes
- [x] Updated `isGqlMemberExpression` in `packages/plugin-babel/src/adapter/analysis.ts`
  - Added `isGqlReference()` helper to recursively recognize namespace-qualified references
  - Now recognizes `graphql_system_1.gql.default()` after ts-loader transformation
- [x] Updated `isGqlDefinitionCall` in `packages/plugin-babel/src/adapter/metadata.ts`
  - Uses same `isGqlReference()` helper for metadata collection

### 5. CommonJS Export Support (Partial)
- [x] Added `getCommonJsExportName()` helper to detect `exports.foo` and `module.exports.foo` patterns
- [x] Updated `collectExportBindings()` to recognize CommonJS export assignments
- [x] Updated `resolveTopLevelExport()` to handle both ESM and CommonJS patterns

---

## Current Problem 🔴

### Error
```
[SODA_GQL_ANALYSIS_ARTIFACT_NOT_FOUND] No builder artifact found for canonical ID
/Users/whatasoda/workspace/soda-gql/examples/nestjs-app/src/graphql/operations.ts::
```

### Issue Details
- **Symptom**: Canonical ID ends with `::` (empty binding name)
- **Expected**: `/Users/.../operations.ts::getUserQuery`
- **Actual**: `/Users/.../operations.ts::`

### Root Cause Analysis

1. **Artifact file is correct**:
   ```json
   {
     "/Users/.../operations.ts::getUserQuery": { ... }
   }
   ```

2. **Webpack loader receives CommonJS code**:
   ```javascript
   exports.getUserQuery = graphql_system_1.gql.default(({ operation }, { $ }) => ...);
   ```

3. **Export binding is collected**:
   - `collectExportBindings()` now recognizes `exports.getUserQuery` ✅
   - Export binding map contains `getUserQuery` ✅

4. **But canonical ID is still empty**:
   - The canonical tracker's `registerDefinition()` is called but returns an empty `astPath`
   - This suggests the tracker's scope stack is not being built correctly

### Hypothesis
The `maybeEnterScope()` function in `metadata.ts` only enters scope for:
- Variable declarators (`const foo = ...`)
- Function/class declarations
- Arrow functions
- Object properties

But in CommonJS, there is no variable declarator:
```javascript
// ESM (has variable declarator):
const getUserQuery = gql.default(...);  // ✅ Enters scope with name "getUserQuery"

// CommonJS (no variable declarator):
exports.getUserQuery = gql.default(...);  // ❌ No scope entry
```

The gql call is directly in the assignment expression, not wrapped in a variable declarator, so no scope is entered.

---

## Next Steps 📋

### Option A: Fix Scope Tracking for CommonJS
1. Update `maybeEnterScope()` to handle assignment expressions:
   ```typescript
   if (path.isAssignmentExpression()) {
     const exportName = getCommonJsExportName(path.node.left);
     if (exportName) {
       return tracker.enterScope({
         segment: exportName,
         kind: "variable",
         stableKey: `var:${exportName}`
       });
     }
   }
   ```

2. Ensure the scope is entered BEFORE the gql call is processed

### Option B: Alternative Canonical Tracker Usage
1. Instead of relying on scope tracking, directly use the export binding name
2. Modify `collectGqlDefinitionMetadata()` to build the canonical ID differently for CommonJS

### Option C: Transform Analysis
1. Add debug logging to understand the exact AST structure
2. Check if there are other scope entry points we're missing

### Recommended Approach
Start with **Option A** as it's the most straightforward and aligns with the existing architecture.

---

## Test Plan

Once fixed, verify:
1. [ ] Build completes without errors
2. [ ] dist/main.js contains transformed code:
   - [ ] Import from `@soda-gql/runtime`
   - [ ] `gqlRuntime.operation()` calls instead of `gql.default()`
   - [ ] GraphQL query strings embedded
3. [ ] App starts successfully with `bun run start`
4. [ ] App responds to HTTP requests on http://localhost:3000

---

## Files Modified

### Configuration
- `examples/nestjs-app/webpack.config.cjs` (renamed from .js)
- `examples/nestjs-app/nest-cli.json`
- `examples/nestjs-app/package.json`
- `examples/nestjs-app/soda-gql.config.ts` (new)
- `tsdown.config.ts`

### Core Packages
- `packages/config/src/loader.ts`
- `packages/plugin-shared/src/index.ts`
- `packages/plugin-nestjs/exports.json`

### Babel Adapter
- `packages/plugin-babel/src/adapter/analysis.ts`
- `packages/plugin-babel/src/adapter/metadata.ts`

---

## Commits
1. `47a69ee` - fix(examples/nestjs-app): fix webpack configuration and add code transformation support
2. `3351023` - wip: add CommonJS export support to metadata collection

---

## Reference Commands

```bash
# Build all packages
bun run build

# Generate artifact
cd examples/nestjs-app
mkdir -p .cache
bun run ../../packages/cli/src/index.ts builder --mode runtime --entry './src/**/*.ts' --out ./.cache/soda-gql-artifact.json

# Build NestJS app
bun run build

# Start app
bun run start

# Check for gql.default in output (should be empty after transformation)
grep -n "gql\." dist/main.js | head -5

# Check for gqlRuntime in output (should exist after transformation)
grep -n "gqlRuntime\|@soda-gql/runtime" dist/main.js | head -5
```

---

## Debug Strategy for Next Session

1. **Add logging to metadata collection**:
   ```typescript
   // In collectGqlDefinitionMetadata, after registering definition:
   console.log('Registered definition:', {
     astPath,
     isTopLevel,
     exportInfo,
     parentType: callPath.parentPath?.type,
     parentParentType: callPath.parentPath?.parentPath?.type
   });
   ```

2. **Check AST structure**:
   - Use babel's AST explorer or add logging to see the exact structure of CommonJS exports
   - Verify the parent path chain: CallExpression → AssignmentExpression → ExpressionStatement → Program

3. **Verify scope tracking**:
   - Log when `maybeEnterScope` is called and what it returns
   - Check `tracker.currentDepth()` when `registerDefinition()` is called

4. **Compare ESM vs CommonJS**:
   - Run metadata collection on both TypeScript source (ESM) and webpack output (CommonJS)
   - Compare the resulting metadata maps

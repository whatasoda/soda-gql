# Plugin CJS Support Analysis

Date: 2025-10-22

## Summary

Analysis of CommonJS (CJS) output support in tsc-plugin and babel-plugin, evaluating implementation necessity and differences.

## TSC Plugin Implementation

### Current Implementation

The tsc-plugin implements explicit CJS support with the following components:

1. **CJS Detection** (`transformer.ts:52`)
   ```typescript
   const isCJS = tsInternals.getEmitModuleKind(compilerOptions) === ts.ModuleKind.CommonJS;
   ```

2. **Runtime Import/Require** (`imports.ts`)
   - ESM: `import { gqlRuntime } from "@soda-gql/runtime"`
   - CJS: `const __soda_gql_runtime = require("@soda-gql/runtime")`

3. **Runtime Accessor** (`runtime.ts:11-17`)
   - ESM: `gqlRuntime.model(...)`
   - CJS: `__soda_gql_runtime.gqlRuntime.model(...)`

4. **GraphQL System Import Removal** (`imports.ts:134-188`)
   - Removes both ESM imports and CJS require statements
   - Handles TypeScript interop helpers (`__importDefault`, `__importStar`)

### Why This Implementation Exists

TypeScript's internal transformation pipeline doesn't properly synchronize identifier references when converting ESM to CJS. This necessitates:
- A dedicated namespace identifier (`__soda_gql_runtime`)
- Property access pattern (`__soda_gql_runtime.gqlRuntime`) instead of direct identifier

### Implementation Quality

✅ **Necessary Logic:**
- All implemented logic is required for correct TypeScript CJS output
- Tests confirm the implementation works correctly

⚠️ **Potentially Redundant:**
- `createAfterStubTransformer` might be redundant since "before" transformer already removes graphql-system imports
- Requires verification: Does TypeScript's internal transform regenerate graphql-system references?

❌ **No Missing Logic:**
- Implementation is complete and tests pass

## Babel Plugin Implementation

### Test Results

All CJS tests pass without any additional implementation:
- ✅ Model definitions transform correctly
- ✅ Slice definitions transform correctly
- ✅ Operation definitions transform correctly
- ✅ Runtime imports/requires are added correctly

### How Babel Handles CJS

Babel's `@babel/plugin-transform-modules-commonjs` automatically:

1. Transforms imports:
   ```javascript
   // Input (ESM)
   import { gqlRuntime } from "@soda-gql/runtime";

   // Output (CJS)
   var _runtime = require("@soda-gql/runtime");
   ```

2. Updates identifier references:
   ```javascript
   // Input
   gqlRuntime.model(...)

   // Output
   _runtime.gqlRuntime.model(...)
   ```

### Why No Additional Implementation Needed

Babel's standard transformation pipeline:
- Properly tracks identifier references across transformations
- Automatically synchronizes renamed identifiers
- No manual accessor patterns needed

## Conclusion

### TSC Plugin
- ✅ Current CJS implementation is **necessary and correct**
- ✅ All logic is required for TypeScript's transformation behavior
- ⚠️ After transformer may be optimizable (needs investigation)

### Babel Plugin
- ✅ **No additional CJS logic needed**
- ✅ Standard Babel transformation handles CJS conversion correctly
- ✅ Users simply add `@babel/plugin-transform-modules-commonjs` to their config

## Recommendations

1. **TSC Plugin**: Keep current implementation as-is
2. **Babel Plugin**: No changes needed - current ESM-only implementation is sufficient
3. **Documentation**: Document that Babel users should use `@babel/plugin-transform-modules-commonjs` for CJS output

## Test Coverage

### TSC Plugin
- ✅ ESM tests: All pass
- ✅ CJS tests: All pass (4 dedicated CJS tests)

### Babel Plugin
- ✅ ESM tests: All pass
- ✅ CJS tests: All pass (4 new CJS tests added)

## Architectural Difference

The key difference between plugins:

**TSC Plugin:**
- Operates within TypeScript's compiler API
- Must work around TS internal transformation limitations
- Requires explicit CJS handling

**Babel Plugin:**
- Operates in Babel's standard plugin ecosystem
- Leverages Babel's robust identifier tracking
- No special CJS handling needed

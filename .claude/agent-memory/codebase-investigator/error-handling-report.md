# Error Handling Inconsistency Report

**Date**: 2026-03-08
**Scope**: All packages in the soda-gql monorepo

---

## Summary

- `fromPromise` / `fromSafePromise` / `fromAsyncThrowable`: **None found** anywhere.
- `_unsafeUnwrap()` outside tests: **None found** in production source files.
- Mixed throw/try-catch with neverthrow: **Widespread**, across many packages.
- Missing error handling (functions that fail without returning Result): **Several**.
- Error message inconsistencies: **Several**.

---

## 1. throw / try-catch Outside Composer Layer (Mixed Paradigms)

The project convention allows throw/try-catch only in the Composer layer (`packages/core/src/composer/`). The following production source files mix throw/try-catch with neverthrow or use throw outside the allowed scope.

### CRITICAL

#### C-1: `builder-session.ts` — throws `BuilderError` objects inside a generator that is caught and re-wrapped outside

**Files:**
- `/Users/whatasoda/workspace/soda-gql/packages/builder/src/session/builder-session.ts:496`
- `/Users/whatasoda/workspace/soda-gql/packages/builder/src/session/builder-session.ts:370`
- `/Users/whatasoda/workspace/soda-gql/packages/builder/src/session/builder-session.ts:404`

**Details:**
`buildGen` (a generator function) throws `BuilderError` objects at line 496 (via `throw builderErrors.graphMissingImport(...)`). The caller (`build` and `buildAsync`) wrap the generator call in try-catch at lines 357–371 and 391–405 and re-convert any caught `BuilderError`-shaped object back to `err(...)`. This is a mixed paradigm: the outer function returns `Result<..., BuilderError>` but the generator throws instead of yielding or returning an error result. The catch heuristic (`if (error && typeof error === "object" && "code" in error)`) is fragile — any non-BuilderError with a `code` property would be wrongly treated as a `BuilderError`, and any unrecognized error rethrows from an otherwise Result-returning function.

**Severity: CRITICAL**

---

#### C-2: `intermediate-module/registry.ts` — throws `BuilderError` from within the Intermediate Module Registry

**File:** `/Users/whatasoda/workspace/soda-gql/packages/builder/src/intermediate-module/registry.ts`
- Line 81: `throw builderErrors.runtimeModuleLoadFailed(...)`
- Line 138: `throw builderErrors.internalInvariant(...)`
- Line 144: `throw builderErrors.runtimeModuleLoadFailed(...)`
- Line 159: `throw builderErrors.runtimeModuleLoadFailed(...)`
- Line 213: `throw builderErrors.internalInvariant(...)`
- Line 239: `throw builderErrors.internalInvariant(...)`

**Details:**
The registry's `evaluateModule`, `evaluate`, and `evaluateAsync` methods all throw `BuilderError` objects. The `evaluate` and `evaluateAsync` methods also use a `scheduler.run()` that returns `Result`, but then convert the scheduler error back to a throw. The public-facing API surface of `registry` (as consumed by `evaluation.ts`) catches these throws and re-throws them. This is a mixed pattern: the registry is not a Composer-layer module but uses throw extensively. The caller in `evaluation.ts` must use bare try-catch to recover.

**Severity: CRITICAL**

---

#### C-3: `intermediate-module/evaluation.ts` — throws `BuilderError` from non-Composer code

**File:** `/Users/whatasoda/workspace/soda-gql/packages/builder/src/intermediate-module/evaluation.ts`
- Line 126–127: `throw builderErrors.runtimeModuleLoadFailed(...)` inside `executeGraphqlSystemModule`
- Line 139–143: another `throw builderErrors.runtimeModuleLoadFailed(...)` inside same function
- Line 151–162: third `throw builderErrors.runtimeModuleLoadFailed(...)` in catch block

**Details:**
`executeGraphqlSystemModule` is an internal builder function (not Composer layer) that throws `BuilderError`. The callers `setupIntermediateModulesContext` (line 242) then call `executeGraphqlSystemModule` without any try-catch, relying on the outer generator-caller (`buildGen`) try-catch to catch the thrown error. Meanwhile `transpile` (same file) correctly returns `Result<string, BuilderError>`. This inconsistency within the same file is notable.

**Severity: CRITICAL**

---

### HIGH

#### H-1: `plugin/session.ts` — throws plain `Error` from a plugin initialization function

**File:** `/Users/whatasoda/workspace/soda-gql/packages/builder/src/plugin/session.ts`
- Line 67: `throw new Error(errorMsg)`
- Line 85: `throw new Error(errorMsg)`
- Line 129: `throw new Error(`[${pluginName}] ${buildResult.error.message}`)`
- Line 149: `throw new Error(`[${pluginName}] ${buildResult.error.message}`)`

**Details:**
`createPluginSession` is documented as throwing when `failOnError=true`. The design rationale is that this is the plugin boundary (Vite/Webpack/Metro/SWC plugin hooks), which cannot carry `Result` returns in all cases. However this is not the Composer layer. When `failOnError=false` the function returns `null` (Result-free). Throws and null returns are mixed error paths, and the throw loses the structured `BuilderError` type (the error code and metadata are dropped; only a plain `Error` with a message string is thrown). The caller (`webpack-plugin/src/plugin.ts`, `vite-plugin/src/plugin.ts`) cannot catch-and-inspect the `BuilderError` code after this point.

**Severity: HIGH**

---

#### H-2: `cli/src/commands/codegen/graphql.ts` line 187 — throws inside a neverthrow-based pipeline

**File:** `/Users/whatasoda/workspace/soda-gql/packages/cli/src/commands/codegen/graphql.ts:187`

```
throw new Error(`Internal error: parse cache missing for ${file}`);
```

**Details:**
The enclosing function returns `Result` (uses `err(...)` throughout), but this one path throws a plain `Error` instead of returning `err(...)`. Since the calling code does not wrap the call in try-catch, this throw would propagate uncaught from a function the caller treats as returning `Result`.

**Severity: HIGH**

---

#### H-3: `vm/sandbox.ts` — throws plain `Error` from a require handler inside VM context

**File:** `/Users/whatasoda/workspace/soda-gql/packages/builder/src/vm/sandbox.ts:42`

```
throw new Error(`Unknown module: ${path}`);
```

**Details:**
The sandbox `require()` handler is called from VM-executed code. When an unknown module is required, the throw propagates out of the VM script execution in `evaluation.ts`, where it is caught by the outer try-catch. This is an intentional VM boundary throw, but the error is a plain `Error`, not a `BuilderError`. The catch block in `evaluation.ts` wraps it into a `BuilderError` by re-throwing after wrapping, making the final error type consistent. However, there is no single function that returns a `Result` for this path — it relies on exception chaining across two files.

**Severity: HIGH**

---

### MEDIUM

#### M-1: `builder/src/scheduler/effects.ts` — throws inside Effect classes that are called by the scheduler

**File:** `/Users/whatasoda/workspace/soda-gql/packages/builder/src/scheduler/effects.ts`
- `FileReadEffect._executeSync()` line 31: throws (via `readFileSync`) — no try-catch, raw throw propagates
- `FileStatEffect._executeSync()` line 52: throws (via `statSync`) — same
- `ElementEvaluationEffect._executeSync()` line 179: `throw new Error("Async operation required...")`
- `ElementEvaluationEffect.wrapError()` line 167: `throw builderErrors.elementEvaluationFailed(...)`

**Details:**
Effect classes are the scheduler boundary. `FileReadEffect` and `FileStatEffect` let `readFileSync`/`statSync` exceptions propagate raw from `_executeSync()`. The scheduler (`sync-scheduler.ts`) catches all exceptions and converts them to `Result<T, SchedulerError>`, so the design works end-to-end. However, `FileReadEffect` and `FileStatEffect` propagate raw node errors (with `errno`, `code` like `ENOENT`) that lose structure through the `SchedulerError` wrapping — the error code from the node error is not preserved in the `SchedulerError`. `OptionalFileReadEffect` and `OptionalFileStatEffect` correctly handle `ENOENT` but still re-throw others.

`ElementEvaluationEffect.wrapError()` throws a `BuilderError`. This is caught by the scheduler, but as with the pattern above, the `BuilderError` has its structured fields (code, filePath, etc.) collapsed into the generic `SchedulerError.message` string, losing them. The `convertSchedulerError` in `builder-session.ts` does attempt to recover the `BuilderError` from `SchedulerError.cause`, but this only works because `BuilderError` is detected by duck-typing (`"code" in error.cause`).

**Severity: MEDIUM**

---

#### M-2: `config/src/evaluation.ts` — throws inside a `try` that wraps everything in a single `catch` returning `Result`

**File:** `/Users/whatasoda/workspace/soda-gql/packages/config/src/evaluation.ts`
- Line 74: `throw new Error(`Module not found: ${specifier}`)` — inside a VM-executed `require()` callback
- Line 99: `throw new Error("Invalid config module")` — inside the catch-all try block

**Details:**
The entire `executeConfigFile` body is wrapped in a single try-catch (lines 36–116) that converts all thrown errors to `err(configError(...))`. The two throws at lines 74 and 99 are intentional — they are caught by the outer `catch` and returned as `Result`. The design works, but using throw for control flow through a broad catch means the distinction between "expected errors" and "unexpected errors" is lost. The same `configError("CONFIG_LOAD_FAILED", ...)` wraps both a missing relative module and a bad SWC transform.

**Severity: MEDIUM**

---

#### M-3: `typegen/src/template-to-selections.ts` — try-catch swallowing errors as warnings (no Result)

**File:** `/Users/whatasoda/workspace/soda-gql/packages/typegen/src/template-to-selections.ts`
- Lines 59–76: entire template conversion wrapped in try-catch, errors downgraded to `warnings[]`

**Details:**
`convertTemplatesToSelections` returns `{ selections, warnings }`, not a `Result`. Failures during conversion for individual templates are caught and appended to `warnings` rather than returning an error. This is a deliberate design choice for resilience, but it means errors in template processing are silently demoted to warnings. If a caller needs to distinguish "some templates failed" from "no templates matched", there is no structured way to do so.

**Severity: MEDIUM**

---

#### M-4: `typegen/src/emitter.ts` — try-catch in type calculation (lines 145–171, 173–197)

**File:** `/Users/whatasoda/workspace/soda-gql/packages/typegen/src/emitter.ts`
- Lines 145–171: fragment type calculation wrapped in try-catch, failures are warnings
- Lines 173–197: operation type calculation wrapped in try-catch, failures are warnings

**Details:**
Same pattern as M-3. `calculateFieldsType` (from `@soda-gql/core`) throws on schema errors. Instead of returning a `Result`, the emitter catches exceptions and pushes them to a `warnings[]` array, with the function still returning `ok(...)`. The overall function returns `Result<..., never>` — it can never fail, only warn.

**Severity: MEDIUM**

---

#### M-5: `typegen/src/template-scanner.ts` — try-catch around file reads, downgraded to warnings

**File:** `/Users/whatasoda/workspace/soda-gql/packages/typegen/src/template-scanner.ts:60–71`

**Details:**
`scanSourceFiles` returns `{ templates, warnings }` (not a `Result`). File-read failures are caught and added to `warnings[]`. Same pattern as M-3 and M-4 — resilient but structurally untyped failure signaling.

**Severity: MEDIUM**

---

#### M-6: `lsp/src/handlers/formatting.ts` — try-catch swallowing formatter exceptions silently

**File:** `/Users/whatasoda/workspace/soda-gql/packages/lsp/src/handlers/formatting.ts:34–38`

```ts
try {
  formatted = format(template.content);
} catch {
  continue;
}
```

**Details:**
If the `format` function (external, may throw) fails, the error is swallowed completely with no logging or diagnostics emitted. This makes it hard to detect when the formatter fails in LSP context.

**Severity: MEDIUM**

---

#### M-7: `builder/src/cache/memory-cache.ts` — throws re-thrown from atomic write patterns in PortableFS (via `common/portable/fs.ts`)

**File:** `/Users/whatasoda/workspace/soda-gql/packages/common/src/portable/fs.ts`
- Line 129: `throw error` (in `writeFileAtomic` cleanup block)
- Line 178: `throw error` (in `writeFileSyncAtomic` cleanup block)
- Line 189: `throw error` (in `unlink`)
- Line 201: `throw error` (in `unlinkSync`)

**Details:**
`PortableFS` methods throw plain errors on failure instead of returning `Result`. The consumer in `memory-cache.ts` wraps `fs.writeFileSyncAtomic(...)` in a try-catch (line 266–283) and converts to a console warning, which is appropriate. However `PortableFS` itself is a raw-throw interface at the boundary where neverthrow could be applied.

**Severity: MEDIUM (low-impact because callers wrap correctly)**

---

### LOW

#### L-1: `core/src/types/type-foundation/modified-type-name.ts:20` — throws in non-Composer utility

**File:** `/Users/whatasoda/workspace/soda-gql/packages/core/src/types/type-foundation/modified-type-name.ts:20`

```ts
throw new Error(`Invalid modified type name: ${nameAndModifier}`);
```

**Details:**
`parseModifiedTypeName` is a utility function (not Composer layer) that throws on malformed input. The `typeof` check guards against non-string input, which is only reachable if types are subverted (the generic bounds prevent it at compile time). This is effectively an unreachable guard, but the throw is not labeled as such (unlike `assertUnreachable` helpers elsewhere).

**Severity: LOW**

---

#### L-2: `core/src/graphql/parser.ts:217` and `codegen/src/graphql-compat/parser.ts:270` — duplicate `assertUnreachable` implementations that throw

**Files:**
- `/Users/whatasoda/workspace/soda-gql/packages/core/src/graphql/parser.ts:217`
- `/Users/whatasoda/workspace/soda-gql/packages/codegen/src/graphql-compat/parser.ts:270`

**Details:**
Both files define a local `assertUnreachable` that throws `new Error(`Unexpected value: ${JSON.stringify(value)}`)`. The `builder` package has `assertUnreachable` in `errors.ts` with a different message format: `Unreachable code path...`. These three implementations have different message strings, making log pattern matching inconsistent.

**Severity: LOW**

---

#### L-3: `lsp/src/handlers/definition.ts` — try-catch around external async graphql-language-service call

**File:** `/Users/whatasoda/workspace/soda-gql/packages/lsp/src/handlers/definition.ts:112`

**Details:**
`getDefinitionQueryResultForFragmentSpread` (from an external package) is called inside a try-catch. The error is not caught — it returns an empty array on failure. This is the correct defensive pattern for external library calls, but is noted for completeness.

**Severity: LOW**

---

## 2. Error Message Inconsistencies

### EM-1: `assertUnreachable` message format varies across packages

| Location | Message format |
|---|---|
| `packages/builder/src/errors.ts:404` | `Unreachable code path${context ? ...}: received ${JSON.stringify(value)}` |
| `packages/builder/src/plugin/errors.ts:159` | `[INTERNAL] Unreachable code path${context ? ...}: received ${JSON.stringify(value)}` |
| `packages/core/src/graphql/parser.ts:217` | `Unexpected value: ${JSON.stringify(value)}` |
| `packages/codegen/src/graphql-compat/parser.ts:270` | `Unexpected value: ${JSON.stringify(value)}` |

The `builder` package has TWO `assertUnreachable` implementations (one in `errors.ts`, one in `plugin/errors.ts`) with different prefixes (`[INTERNAL]` in the plugin version). The `core` and `codegen` implementations use a completely different string with no context parameter.

---

### EM-2: `schema-loader.ts` uses `CONFIG_NOT_FOUND` and `CONFIG_INVALID` error codes for file-read and schema-export validation failures

**File:** `/Users/whatasoda/workspace/soda-gql/packages/builder/src/schema-loader.ts`
- Line 52–56: `code: "CONFIG_NOT_FOUND"` for a missing CJS bundle
- Line 90–94: `code: "CONFIG_INVALID"` for invalid schema object
- Line 116–120: `code: "CONFIG_INVALID"` for missing `$schema` property

**Details:**
The schema-loader is loading a generated runtime artifact (not a user config file), but it reuses `CONFIG_NOT_FOUND` and `CONFIG_INVALID` error codes. The `BuilderErrorCode` taxonomy already has `SCHEMA_NOT_FOUND` for schema-related errors. The file-not-found case would be better expressed as `DISCOVERY_IO_ERROR` or a new `ARTIFACT_NOT_FOUND`-like code. Using `CONFIG_*` codes for non-config artifacts makes error triage misleading.

---

### EM-3: `artifact/loader.ts` uses `ARTIFACT_NOT_FOUND` for both "file not found" and "file read failed"

**File:** `/Users/whatasoda/workspace/soda-gql/packages/builder/src/artifact/loader.ts`
- Line 38–43: `code: "ARTIFACT_NOT_FOUND"` — file does not exist (correct use)
- Line 48–53 (async) and 86–91 (sync): `code: "ARTIFACT_NOT_FOUND"` — file exists but `readFile` threw

**Details:**
The error code `ARTIFACT_NOT_FOUND` is used when `readFile` throws even though the file was found by `existsSync` a few lines earlier. A more appropriate code would be something like `ARTIFACT_READ_ERROR` or using the existing `DISCOVERY_IO_ERROR`. This is a local `ArtifactLoadError` type (not `BuilderError`), so the codes do not overlap with `BuilderErrorCode`, but the semantics are misleading.

---

## 3. Missing Error Handling (Functions that fail without Result)

### ME-1: `core/src/graphql/parser.ts` and `core/src/graphql/transformer.ts` use a custom local `Result` type, not neverthrow

**Files:**
- `/Users/whatasoda/workspace/soda-gql/packages/core/src/graphql/result.ts`
- `/Users/whatasoda/workspace/soda-gql/packages/core/src/graphql/parser.ts:22`
- `/Users/whatasoda/workspace/soda-gql/packages/core/src/graphql/transformer.ts:8`

**Details:**
`@soda-gql/core` intentionally avoids taking a `neverthrow` dependency and implements its own minimal `Result` type. The custom type (`{ ok: true; value: T } | { ok: false; error: E }`) is not interchangeable with neverthrow's `Result` (no `.isOk()`, `.isErr()`, `.map()`, etc. methods). Code in other packages that imports `Result` from both `neverthrow` and `@soda-gql/core` must be careful about which API is available. This is noted as an architectural inconsistency rather than a bug, but callers of `@soda-gql/core` graphql utilities may mistakenly apply neverthrow Result methods to these objects.

**Severity: MEDIUM** (no immediate bug, but a maintenance trap)

---

### ME-2: `builder/src/internal/graphql-system.ts` — `toCanonical()` silently falls back on `realpathSync` failure

**File:** `/Users/whatasoda/workspace/soda-gql/packages/builder/src/internal/graphql-system.ts:48–53`

```ts
try {
  return getCanonicalFileName(realpathSync(resolved));
} catch {
  return getCanonicalFileName(resolved);
}
```

**Details:**
When `realpathSync` fails (e.g., path does not exist), the function silently returns the non-realpath version. This could cause false negatives in `isGraphqlSystemFile` checks if symlinks are involved. There is no log or warning on this fallback. Not a crash, but a silent correctness degradation.

**Severity: LOW**

---

### ME-3: `cli/src/commands/format.ts` — `writeFile` call at line 183 is unawaited for errors

**File:** `/Users/whatasoda/workspace/soda-gql/packages/cli/src/commands/format.ts:183`

```ts
await writeFile(filePath, result.value.sourceCode, "utf-8");
```

**Details:**
If `writeFile` throws (disk full, permissions), the exception propagates out of the async `for` loop and is not caught. The function is `async` so the thrown error becomes a rejected `Promise`, but the caller (`formatCommand`) does not wrap in try-catch. This means a single file write failure will abort the entire format run and the returned `Promise<FormatCommandResult>` will reject rather than returning `err(...)`.

**Severity: HIGH**

---

## 4. Summary Table

| ID | File (package-relative) | Line(s) | Pattern | Severity |
|----|-------------------------|---------|---------|----------|
| C-1 | `builder/src/session/builder-session.ts` | 370, 404, 496 | Generator throws BuilderError, caller catches and re-wraps | CRITICAL |
| C-2 | `builder/src/intermediate-module/registry.ts` | 81, 138, 144, 159, 213, 239 | Throws BuilderError from internal evaluation functions | CRITICAL |
| C-3 | `builder/src/intermediate-module/evaluation.ts` | 126, 139, 156 | Throws BuilderError from non-Composer helper | CRITICAL |
| H-1 | `builder/src/plugin/session.ts` | 67, 85, 129, 149 | Throws plain Error at plugin boundary, loses BuilderError structure | HIGH |
| H-2 | `cli/src/commands/codegen/graphql.ts` | 187 | Throws inside a Result-returning function | HIGH |
| H-3 | `builder/src/vm/sandbox.ts` | 42 | Throws plain Error from VM require handler | HIGH |
| ME-3 | `cli/src/commands/format.ts` | 183 | Unawaited async write failure propagates as rejection instead of err() | HIGH |
| M-1 | `builder/src/scheduler/effects.ts` | 31, 52, 167, 179 | Effect classes throw; SchedulerError loses BuilderError structure | MEDIUM |
| M-2 | `config/src/evaluation.ts` | 74, 99 | Throws inside broad try-catch for control flow | MEDIUM |
| M-3 | `typegen/src/template-to-selections.ts` | 59–76 | try-catch downgrades errors to warnings, no Result | MEDIUM |
| M-4 | `typegen/src/emitter.ts` | 145–171, 173–197 | try-catch downgrades type calculation errors to warnings | MEDIUM |
| M-5 | `typegen/src/template-scanner.ts` | 60–71 | try-catch downgrades file read errors to warnings | MEDIUM |
| M-6 | `lsp/src/handlers/formatting.ts` | 34–38 | Swallows formatter exception silently | MEDIUM |
| ME-1 | `core/src/graphql/result.ts` | — | Custom Result type incompatible with neverthrow Result API | MEDIUM |
| M-7 | `common/src/portable/fs.ts` | 129, 178, 189, 201 | PortableFS throws on failure (callers catch correctly) | MEDIUM |
| L-1 | `core/src/types/type-foundation/modified-type-name.ts` | 20 | Throws in non-Composer utility without `assertUnreachable` label | LOW |
| L-2 | `core/src/graphql/parser.ts`, `codegen/src/graphql-compat/parser.ts` | 217, 270 | Duplicate assertUnreachable with different message format | LOW |
| EM-1 | Multiple | — | `assertUnreachable` message format inconsistent across 4 implementations | LOW |
| EM-2 | `builder/src/schema-loader.ts` | 52, 90, 116 | CONFIG_* error codes used for non-config runtime artifacts | LOW |
| EM-3 | `builder/src/artifact/loader.ts` | 48–53, 86–91 | ARTIFACT_NOT_FOUND used for read errors (file exists but can't read) | LOW |
| ME-2 | `builder/src/internal/graphql-system.ts` | 48–53 | Silent fallback on realpathSync failure, no warning | LOW |
| L-3 | `lsp/src/handlers/definition.ts` | 112 | try-catch around external library, empty result on failure | LOW |

# Code Quality Improvement Plan
## Packages: builder, cli, codegen, plugin-babel, tool-utils

## 🔍 Current Issues Analysis

### 1. Code Organization Problems
- **Monolithic Files**: `intermediate-module.ts` and `plugin.ts` combine multiple responsibilities in single files
- **Mixed Concerns**: Graph traversal, AST rewriting, and file I/O are tightly coupled
- **CLI Duplication**: Manual argument parsing repeated across commands despite existing parser utility

### 2. Type Safety Issues
- **Unvalidated JSON**: Direct `JSON.parse()` without zod validation in cache and artifact handling
- **Unknown Types**: Several modules use `unknown` placeholders instead of proper types
- **Inconsistent Returns**: Mix of null returns, throws, and Result types across modules

### 3. Error Handling Gaps
- **Raw Throws**: Direct `Error` throws instead of neverthrow Result types
- **Lost Context**: Error details not properly threaded through BuilderError variants
- **Inconsistent Formatting**: Hard-coded JSON output on parse failures

### 4. Testing Deficiencies
- **No Test Coverage**: Zero tests in builder, codegen, CLI, plugin-babel, tool-utils
- **TDD Violation**: No RED → GREEN → REFACTOR flow implementation
- **Missing Contract Tests**: No validation of critical utilities like unwrap-nullish

### 5. Dependency Issues
- **Unused Dependencies**: commander in CLI, @soda-gql/core and @soda-gql/runtime in builder
- **Unclear Boundaries**: Cross-package usage patterns not documented

### 6. Pattern Inconsistencies
- **Mixed Error Patterns**: Some modules use neverthrow, others throw or return null
- **Divergent Diagnostics**: Different formatting between commands
- **Duplicated Logic**: Query detection regex repeated across packages

## 📋 Improvement Plan

### Phase 1: Foundation (Week 1)
#### 1.1 Dependency Cleanup
- [ ] Remove `commander` from `packages/cli/package.json`
- [ ] Remove unused `@soda-gql/core` and `@soda-gql/runtime` from `packages/builder/package.json`
- [ ] Add explicit peerDependencies documentation
- [ ] Move development tools to devDependencies

#### 1.2 File System Standardization
- [ ] Standardize Node.js fs/promises usage across packages
- [ ] Create consistent file operation utilities
- [ ] Create adapter interfaces for easier testing

### Phase 2: Type Safety & Validation (Week 1-2)
#### 2.1 Schema Definitions
- [ ] Create zod schemas for:
  - Builder cache entries (`packages/builder/src/schemas/cache.ts`)
  - Artifact manifests (`packages/plugin-babel/src/schemas/artifact.ts`)
  - CLI arguments (`packages/cli/src/schemas/args.ts`)
  - Plugin options (`packages/plugin-babel/src/schemas/options.ts`)

#### 2.2 Validation Implementation
- [ ] Wrap all JSON.parse calls with zod validation
- [ ] Replace `unknown` types with discriminated unions
- [ ] Implement typed accessors for BuilderArtifact metadata

#### 2.3 CLI Argument Standardization
- [ ] Refactor to use existing `parse-args.ts` utility
- [ ] Apply zod schemas to command arguments
- [ ] Remove manual parsing loops

### Phase 3: Error Handling (Week 2)
#### 3.1 Result Type Migration
- [ ] Convert throws to neverthrow Results in:
  - `packages/plugin-babel/src/options.ts`
  - `packages/plugin-babel/src/artifact.ts`
  - `packages/builder/src/registry.ts`
- [ ] Thread error context through BuilderError variants
- [ ] Add structured error serializers

#### 3.2 CLI Error Formatting
- [ ] Create shared error formatter respecting output format
- [ ] Normalize diagnostic payloads (code, message, context)
- [ ] Remove hard-coded JSON formatting

### Phase 4: Code Organization (Week 2-3)
#### 4.1 Module Decomposition
- [ ] Split `intermediate-module.ts` into:
  - `ast-sanitization.ts`
  - `graph-traversal.ts`
  - `file-emission.ts`
- [ ] Refactor `plugin.ts` into:
  - `option-normalizer.ts`
  - `artifact-loader.ts`
  - `source-cache.ts`
  - `transform-visitors.ts`

#### 4.2 CLI Command Harness
- [ ] Create shared command harness for:
  - Argument parsing
  - Validation
  - Output formatting
- [ ] Refactor commands to use harness

#### 4.3 Shared Utilities
- [ ] Centralize query detection logic
- [ ] Extract common regex patterns
- [ ] Create diagnostic utilities

### Phase 5: Testing Infrastructure (Week 3-4)
#### 5.1 Test Setup
- [ ] Create test directories for each package
- [ ] Configure Bun test runners
- [ ] Set up fixture projects

#### 5.2 Test Implementation
- [ ] **CLI Tests**: Spawn API smoke tests
- [ ] **Builder Tests**: Pipeline tests with fixtures
- [ ] **Codegen Tests**: Golden-file tests
- [ ] **Plugin Tests**: AST snapshot tests
- [ ] **Tool-utils Tests**: Contract validation

#### 5.3 TDD Adoption
- [ ] Document TDD workflow in CONTRIBUTING.md
- [ ] Create failure-first tests for new features
- [ ] Add pre-commit hooks for test runs

### Phase 6: Documentation & Consistency (Week 4)
#### 6.1 Documentation
- [ ] Document package boundaries
- [ ] Add API documentation
- [ ] Create usage examples
- [ ] Update ADRs for architecture changes

#### 6.2 Pattern Enforcement
- [ ] Add linting rules for patterns
- [ ] Create code review checklist
- [ ] Document conventions in CLAUDE.md

## 📊 Success Metrics

### Immediate Goals
- ✅ Consistent Node.js fs/promises API usage
- ✅ All JSON parsing validated with zod
- ✅ No raw throws (100% Result types)
- ✅ Test coverage > 80% per package

### Long-term Goals
- ✅ Module files < 200 lines
- ✅ Zero duplicate code blocks
- ✅ Consistent error handling patterns
- ✅ Full TDD adoption

## 🚀 Implementation Priority

1. **Critical** (Do First):
   - Dependency cleanup
   - Zod validation for external data
   - Result type migration

2. **Important** (Do Second):
   - Module decomposition
   - Test infrastructure
   - File system standardization

3. **Nice to Have** (Do Last):
   - Documentation updates
   - Pattern enforcement
   - Performance optimizations

## 📝 Notes

- Each phase should be completed with tests before moving to the next
- Run `bun quality` after each change
- Create ADRs for significant architecture changes
- Keep commits small and focused on single issues
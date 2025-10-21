# Testing Conventions

## TDD Methodology
- TDD mandatory (t_wada: RED → GREEN → REFACTOR)
- No mocks - use real dependencies
- Use `import`, never `require`

## Fixture-Based Testing
- Store test code as `.ts` fixture files, not inline strings
- Place fixtures in `tests/fixtures/` with descriptive subdirectories
- Fixture files are type-checked by `tests/tsconfig.json`
- Use `@ts-expect-error` for intentionally invalid test cases
- Benefits: Type safety, editor support, refactoring tools work

## Behavioral Testing
- Test **behavior** (execution results), not **implementation details** (output format)
- For transform tests: Execute transformed code and verify runtime behavior
- Don't assert on exact transformation output (brittle to formatting changes)

## Integration Test Utilities
- Use `__resetRuntimeRegistry()` from `@soda-gql/core/runtime` to clear operation registry between tests
- Use spies/wrappers to track registrations without mocking
- Transpile TypeScript test output with `new Bun.Transpiler()` before execution
- Dynamic imports with cache-busting: `import(\`file://\${path}?t=\${Date.now()}\`)`

## Test Organization
- Unit tests: `tests/unit/**/*.test.ts`
- Integration tests: `tests/integration/**/*.test.ts`
- Fixtures: `tests/fixtures/**/*.ts`
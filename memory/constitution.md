# soda-gql Project Constitution

## Core Principles

### I. Library-First Architecture
Every feature starts as a standalone library with clear boundaries:
- Libraries must be self-contained and independently testable
- Each library has a single, well-defined purpose
- No organizational-only libraries - must provide concrete functionality
- Dependencies between libraries must be explicit and unidirectional

### II. CLI Interface
Every library exposes functionality via CLI for accessibility:
- Text in/out protocol: stdin/args → stdout, errors → stderr
- Support both JSON and human-readable output formats
- All commands must provide --help, --version, --format flags
- CLI serves as both user interface and integration point

### III. Test-First Development (NON-NEGOTIABLE)
TDD with t_wada methodology is mandatory:
- Tests written first → Tests fail (RED) → Implementation → Tests pass (GREEN) → Refactor
- Git commits must show tests before implementation
- Test order: Contract → Integration → E2E → Unit
- Use real dependencies, no mocks (real DBs, file systems, schemas)
- FORBIDDEN: Implementation before tests, skipping RED phase

### IV. Type Safety & Error Handling
Maintain strict type safety throughout the codebase:
- NO standalone any/unknown types (only within Generic constraints)
- All external data validated with zod v4
- Error handling with neverthrow Result types (no exceptions)
- Type inference over type annotation where possible

### V. Code Quality Standards
Enforce high code quality and maintainability:
- Pure functions extracted for testability
- No classes for state management (only DTOs, errors, utilities)
- Minimize dependencies at file and function level
- Side effects only at boundaries
- Explicit dependency injection over implicit coupling

## Technical Constraints

### Technology Stack
- **Runtime**: Bun (not Node.js)
- **Language**: TypeScript 5.x with strict mode
- **Testing**: bun:test (not Jest/Vitest)
- **Error Handling**: neverthrow (not try-catch)
- **Validation**: zod v4 (not io-ts/yup)
- **Build**: Bun's native capabilities preferred

### Performance Standards
- Build time: < 100ms per file transformation
- Zero runtime overhead for generated code
- Type checking: < 500ms incremental
- Memory usage: < 50MB during analysis phase

### Code Conventions
- ES modules only (import, not require)
- Async/await over callbacks or raw promises
- Functional patterns over OOP where appropriate
- Immutability by default (const, readonly, Object.freeze)

## Development Workflow

### Git Workflow
1. Feature branches from main (format: ###-feature-name)
2. Commits show TDD cycle (test commits before implementation)
3. PRs require passing tests and code review
4. Squash merge to main with conventional commit message

### Quality Gates
- All tests must pass (unit, integration, E2E)
- Type checking must pass (bun typecheck)
- Linting must pass (biome or configured linter)
- Code coverage maintained above 80%
- Performance benchmarks must not regress

### Review Process
- Code review required for all changes
- Architecture changes require team discussion
- Breaking changes require migration plan
- Documentation updates required for API changes

## Governance

### Authority
- Constitution supersedes all other practices and conventions
- Code conventions in `/memory/code-conventions.md` provide detailed implementation guidance
- CLAUDE.md contains project-specific instructions for AI assistants

### Amendment Process
1. Propose change with justification and impact analysis
2. Team review and discussion period (minimum 2 days)
3. Document migration plan for existing code
4. Update version and amendment date upon approval

### Compliance
- All PRs must verify constitutional compliance
- Violations require documented justification
- Complexity must be justified in Complexity Tracking
- Regular audits to ensure ongoing compliance

**Version**: 1.0.0 | **Ratified**: 2025-09-07 | **Last Amended**: 2025-09-07
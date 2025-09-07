# Universal Code Conventions

**Version**: 1.0.0 | **Created**: 2025-09-07 | **Status**: Active

These conventions apply to ALL code in this project, regardless of feature or implementation phase.

## Type Safety (MANDATORY)

### Prohibition of any/unknown

**Rule**: Never use `any` or `unknown` as standalone types.

**Allowed Exception**: Within Generic type parameters with proper constraints.

```typescript
// ❌ FORBIDDEN
function process(data: any) { ... }
function handle(value: unknown) { ... }

// ✅ CORRECT
function process<T extends BaseType>(data: T) { ... }
function handle<T>(value: T): Result<T, Error> { ... }
```

**Rationale**: Type safety is the foundation of maintainable code. Loss of type information cascades through the codebase, making refactoring dangerous and bugs harder to catch.

### External Data Validation

**Rule**: All data from outside the process boundary MUST be validated with zod v4.

**Applies To**:
- JSON file contents
- API responses  
- User input
- Environment variables
- Database query results

```typescript
// ❌ FORBIDDEN
const config = JSON.parse(fileContent) as Config;

// ✅ CORRECT
const ConfigSchema = z.object({
  port: z.number(),
  host: z.string()
});
const config = ConfigSchema.parse(JSON.parse(fileContent));
```

**Rationale**: External data is inherently untrustworthy. Runtime validation prevents type mismatches from propagating into the application.

## Error Handling (MANDATORY)

### neverthrow for Type-Safe Errors

**Rule**: Use neverthrow's Result type for all fallible operations.

**Constraints**:
- Use only `ok()` and `err()` constructors
- NEVER use `fromPromise()` (loses error type information)
- Define discriminated unions for complex error cases

```typescript
// ❌ FORBIDDEN
try {
  const data = await fetchData();
  return data;
} catch (error) {
  throw new Error('Failed');
}

// ❌ ALSO FORBIDDEN (fromPromise loses types)
const result = await Result.fromPromise(
  fetchData(),
  (error) => new Error('Failed')
);

// ✅ CORRECT
function fetchData(): Result<Data, FetchError | ParseError> {
  const response = fetchRaw();
  if (!response.ok) {
    return err({ type: 'fetch_error', status: response.status });
  }
  
  const parsed = parseResponse(response);
  if (!parsed.ok) {
    return err({ type: 'parse_error', message: parsed.error });
  }
  
  return ok(parsed.value);
}
```

**Rationale**: Exceptions break type flow and make error handling implicit. Result types make all failure modes explicit and type-safe.

## Code Organization (MANDATORY)

### Class Usage Restrictions

**Rule**: Classes are FORBIDDEN for state management.

**Allowed Uses**:
- Data Transfer Objects (DTOs)
- Error classes extending Error
- Pure utility method collections (static methods only)

```typescript
// ❌ FORBIDDEN - Stateful class
class UserService {
  private users: User[] = [];
  
  addUser(user: User) {
    this.users.push(user);
  }
}

// ✅ CORRECT - DTO
class UserDTO {
  constructor(
    public readonly id: string,
    public readonly name: string
  ) {}
}

// ✅ CORRECT - Error class
class ValidationError extends Error {
  constructor(public readonly field: string, message: string) {
    super(message);
  }
}

// ✅ CORRECT - Dependency injection
function createUserService(repository: UserRepository) {
  return {
    addUser: (user: User) => repository.save(user)
  };
}
```

**Rationale**: Stateful classes create hidden dependencies and make testing difficult. Explicit dependency injection makes data flow clear and enables better testing.

### Dependency Graph Optimization

**Rule**: Minimize dependencies at both file and function level.

**Principles**:
- No circular dependencies
- Explicit imports only
- Pure functions where possible
- Side effects only at boundaries

```typescript
// ❌ FORBIDDEN - Circular dependency
// file: a.ts
import { b } from './b';
export const a = () => b();

// file: b.ts  
import { a } from './a';
export const b = () => a();

// ✅ CORRECT - Unidirectional flow
// file: core.ts
export const core = () => 'core';

// file: feature.ts
import { core } from './core';
export const feature = () => core();
```

**Rationale**: Complex dependency graphs make code hard to understand, test, and refactor. Clear, unidirectional dependencies enable confident changes.

## Testing (NON-NEGOTIABLE)

### Test-Driven Development

**Rule**: Follow t_wada's TDD methodology strictly.

**Process**:
1. **RED**: Write failing test first
2. **GREEN**: Write minimum code to pass
3. **REFACTOR**: Improve code while keeping tests green

**Git Commits**: Tests MUST be committed before implementation.

```bash
# Correct commit sequence
git add test/feature.test.ts
git commit -m "test: add test for feature X"
git add src/feature.ts
git commit -m "feat: implement feature X"
```

### No Mocks Policy

**Rule**: Use real dependencies instead of mocks.

**Examples**:
- Real database connections (SQLite for tests)
- Actual file system operations
- Real GraphQL schemas
- Actual HTTP servers (using test server)

```typescript
// ❌ FORBIDDEN - Mock
const mockDb = {
  query: jest.fn().mockResolvedValue([{ id: 1 }])
};

// ✅ CORRECT - Real database
import { Database } from 'bun:sqlite';
const testDb = new Database(':memory:');
testDb.exec('CREATE TABLE users (id INTEGER)');
```

**Rationale**: Mocks hide integration issues. Real dependencies catch actual problems early.

### Import-Only Testing

**Rule**: Use ES modules (`import`), never CommonJS (`require`).

```typescript
// ❌ FORBIDDEN
const { test } = require('bun:test');
const module = require('../src/module');

// ✅ CORRECT
import { test, expect } from 'bun:test';
import { module } from '../src/module';
```

**Rationale**: ES modules preserve type information and enable better tree-shaking.

## Implementation Patterns

### Pure Functions First

**Rule**: Extract pure, testable logic from side-effect code.

```typescript
// ❌ FORBIDDEN - Mixed concerns
async function processUser(id: string) {
  const user = await db.getUser(id);
  user.name = user.name.toUpperCase();
  user.age = user.age + 1;
  await db.saveUser(user);
}

// ✅ CORRECT - Separated concerns
const transformUser = (user: User): User => ({
  ...user,
  name: user.name.toUpperCase(),
  age: user.age + 1
});

async function processUser(id: string, db: Database) {
  const user = await db.getUser(id);
  const transformed = transformUser(user);
  await db.saveUser(transformed);
}
```

### Scope Minimization

**Rule**: Use closures to limit variable scope, especially for `let`.

```typescript
// ❌ FORBIDDEN - Wide scope
let counter = 0;
function increment() { counter++; }
function getCount() { return counter; }

// ✅ CORRECT - Minimal scope
function createCounter() {
  let counter = 0;
  return {
    increment: () => counter++,
    getCount: () => counter
  };
}
```

## Enforcement

These conventions are:
1. **Checked in code review** - All PRs must comply
2. **Tested via linting** - Where tooling permits
3. **Documented in onboarding** - New developers learn these first
4. **Applied retroactively** - Refactor non-compliant code when touched

## Exceptions

Exceptions to these rules require:
1. Documented justification in code comments
2. Team review and approval
3. Plan for eventual compliance

---

*These conventions are derived from industry best practices and hard-learned lessons. They prioritize maintainability, testability, and type safety above all else.*
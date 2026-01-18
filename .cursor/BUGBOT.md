# BugBot Configuration for @soda-gql

## Project Context

This is **@soda-gql**, a zero-runtime GraphQL query generation library (similar to PandaCSS approach).

- **Status**: Pre-release v0.2.0 - breaking changes are acceptable
- **Runtime**: Bun (TypeScript 5.x)
- **Error Handling**: neverthrow
- **Validation**: Zod v4
- **Testing**: bun:test with TDD methodology

For detailed conventions, see:
- `CLAUDE.md` - Project instructions
- `memory/code-conventions.md` - Detailed coding standards
- `memory/constitution.md` - Core principles

---

## Type Safety

### NO standalone `any` or `unknown`

Flag any usage of `any` or `unknown` types that are not within generic constraints.

```typescript
// BAD - Flag these
const data: any = fetchData();
function process(input: unknown) { ... }

// OK - Generic constraints are allowed
function parse<T extends unknown>(input: T): T { ... }
type Handler<T = unknown> = (value: T) => void;
```

### External Data Validation Required

All data from outside the process boundary MUST use Zod v4 validation. Flag type casting without validation.

```typescript
// BAD - Flag these
const config = JSON.parse(content) as Config;
const response = await fetch(url).then(r => r.json()) as ApiResponse;

// GOOD
const config = ConfigSchema.parse(JSON.parse(content));
const response = ApiResponseSchema.parse(await fetch(url).then(r => r.json()));
```

---

## Error Handling

### Use neverthrow Result Types

All fallible operations must use neverthrow `Result` types. Only `ok()` and `err()` constructors are allowed.

```typescript
// BAD - Flag these
fromPromise(asyncOperation()); // FORBIDDEN - loses error type information
try { ... } catch (e) { ... } // FORBIDDEN - no exceptions

// GOOD
return ok(value);
return err(new SomeError());
```

### No try-catch Exceptions

Flag any usage of try-catch blocks for error handling.

---

## Code Organization

### No Stateful Classes

Classes are only allowed for:
- DTOs (Data Transfer Objects)
- Error classes
- Pure utility collections (all static methods)

Flag classes that maintain mutable state.

```typescript
// BAD - Flag these
class UserService {
  private users: User[] = []; // Mutable state
  addUser(user: User) { this.users.push(user); }
}

// GOOD
class UserNotFoundError extends Error { ... }
class DateUtils {
  static format(date: Date): string { ... }
}
```

### No Imports from `/specs/` Directory

The `/specs/` directory contains documentation only. Flag any imports from spec files.

```typescript
// BAD - Flag these
import { SomeType } from '../specs/feature-spec';
import { Schema } from '@soda-gql/core/specs/schema-spec';
```

### No Circular Dependencies

Flag any circular import patterns.

---

## Testing Requirements

### TDD is Mandatory

- New implementations should have corresponding test files
- Test files should be colocated: `src/**/*.test.ts`
- Integration tests: `test/integration/*.test.ts`

### No Mocks

Flag usage of mocking libraries or mock objects. Use real dependencies instead.

```typescript
// BAD - Flag these
jest.mock('./database');
const mockFn = vi.fn();
sinon.stub(service, 'method');

// GOOD - Use real dependencies
const db = createTestDatabase();
```

### ES Modules Only

Flag any CommonJS `require` usage.

```typescript
// BAD - Flag these
const fs = require('fs');
const { readFile } = require('fs/promises');

// GOOD
import fs from 'fs';
import { readFile } from 'fs/promises';
```

---

## Package Management

### Bun Commands Only

Flag usage of npm, yarn, or pnpm in scripts, documentation, or commit messages.

```bash
# BAD - Flag these
npm install
yarn add package
pnpm run test

# GOOD
bun install
bun add package
bun run test
```

---

## Documentation Standards

### English Only, American Spelling

All code comments, documentation, and commit messages must be in English with American spelling.

```typescript
// BAD - Flag these
// 色を設定する
const colour = 'blue'; // British spelling

// GOOD
// Set the color
const color = 'blue';
```

---

## Quality Gates

Before approving a PR, verify:

1. All tests pass (`bun run test`)
2. Type checking passes (`bun typecheck`)
3. Linting passes (`bun quality`)
4. No regression in performance benchmarks
5. README updated if public APIs changed

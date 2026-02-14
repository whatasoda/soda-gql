# Autonomous Agent: Tagged Template Unification — Phase 4

You are an autonomous implementation agent for the soda-gql project. Your mission is to complete **Phase 4** (Tests, Fixtures, Documentation) of the tagged-template-unification feature.

## Session Workflow

Every session, follow this workflow:

1. Read `agent/agent-progress.md` to understand current state
2. Find the first session (4.1–4.5) with `STATUS: not_started` or `STATUS: in_progress`
3. Work ONLY on that session's tasks — do NOT touch files outside the session scope
4. For each task:
   a. Read the files listed in the session scope
   b. Convert callback builder syntax to tagged template syntax (see Conversion Patterns below)
   c. Run tests: `bun run test > /tmp/test-output.txt 2>&1 && echo "PASS" || (tail -30 /tmp/test-output.txt && echo "FAIL")`
   d. If PASS: stage specific files with `git add <paths>`, commit, mark task `[x]` in progress file
   e. If FAIL: fix the issue and retry from (c)
5. Track your commit count. When you reach the session's MAX_COMMITS: stop, update progress, exit
6. If you finish all tasks before MAX_COMMITS: that's fine — update progress and exit
7. Follow the Exit Protocol below

**IMPORTANT**: Always update `agent/agent-progress.md` before the session ends.

## Session Length Control

Each session has a `MAX_COMMITS` limit defined in `agent/agent-progress.md`.
Track your commit count during the session. When you reach MAX_COMMITS:

1. Update `agent/agent-progress.md` with completed tasks
2. Commit the progress update (this commit does NOT count toward the limit)
3. Output `SESSION_COMPLETE` and stop working

If you finish all session tasks before reaching MAX_COMMITS, that is fine — commit progress and exit.

## Exit Protocol

When your session is complete (all tasks done OR MAX_COMMITS reached):

1. Run `bun run test` to verify no regressions
2. Update `agent/agent-progress.md`:
   - Mark completed tasks with `[x]`
   - Update session `STATUS:` to `complete` (if all tasks done) or `in_progress` (if partially done)
   - Add entry to Session Log
3. Commit: `docs(agent): update progress - Session X.Y [partial|complete]`
4. Output the final line: `SESSION_COMPLETE: Session X.Y [status]`

## Quality Gates

```bash
# Before each commit (redirect output to avoid context pollution)
bun run test > /tmp/test-output.txt 2>&1 && echo "PASS" || (tail -30 /tmp/test-output.txt && echo "FAIL")

# Session gate (final task of each session)
bun run test && bun quality
```

If quality gates fail, fix the issue before proceeding. Do not skip gates.

## Commit Convention

```
<type>(<scope>): <description>

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

Types: `feat`, `test`, `fix`, `refactor`, `docs`
Scope: package name (e.g., `core`, `fixtures`, `docs`)

One commit per task. Use `git add` with specific file paths (not `git add .`).

## Conversion Patterns

### Fragment: Callback → Tagged Template

```typescript
// BEFORE (callback builder):
const UserFields = fragment.User({
  fields: ({ f }) => ({
    ...f.id(),
    ...f.name(),
    ...f.email(),
  }),
});

// AFTER (tagged template):
const UserFields = fragment.User`
  id
  name
  email
`;
```

### Fragment with nested fields:

```typescript
// BEFORE:
const UserWithPosts = fragment.User({
  fields: ({ f }) => ({
    ...f.id(),
    ...f.posts()(({ f }) => ({
      ...f.title(),
      ...f.body(),
    })),
  }),
});

// AFTER:
const UserWithPosts = fragment.User`
  id
  posts {
    title
    body
  }
`;
```

### Fragment with arguments:

```typescript
// BEFORE:
const UserPosts = fragment.User({
  fields: ({ f, $ }) => ({
    ...f.posts({ first: $.count })(({ f }) => ({
      ...f.title(),
    })),
  }),
});

// AFTER:
const UserPosts = fragment.User`
  posts(first: $count) {
    title
  }
`;
```

### Fragment with key:

```typescript
// BEFORE:
const UserFields = fragment.User({
  key: "UserFields",
  fields: ({ f }) => ({ ...f.id(), ...f.name() }),
});

// AFTER:
const UserFields = fragment.User("UserFields")`
  id
  name
`;
```

### Fragment with spread:

```typescript
// BEFORE:
const Extended = fragment.User({
  fields: ({ f }) => ({
    ...f.id(),
    ...BaseFragment.spread(),
  }),
});

// AFTER:
const Extended = fragment.User`
  id
  ${BaseFragment}
`;
```

### Operation: Callback → Tagged Template

```typescript
// BEFORE:
const getUser = query.operation({
  name: "GetUser",
  variables: {
    ...$var("id").ID("!"),
  },
  fields: ({ f, $ }) => ({
    ...f.user({ id: $.id })(({ f }) => ({
      ...f.id(),
      ...f.name(),
    })),
  }),
});

// AFTER:
const getUser = query`
  query GetUser($id: ID!) {
    user(id: $id) {
      id
      name
    }
  }
`;
```

### Operation with fragment spread:

```typescript
// BEFORE:
const getUser = query.operation({
  name: "GetUser",
  fields: ({ f }) => ({
    ...f.user()(({ f }) => ({
      ...UserFields.spread(),
    })),
  }),
});

// AFTER:
const getUser = query`
  query GetUser {
    user {
      ${UserFields}
    }
  }
`;
```

### Mutation:

```typescript
// BEFORE:
const createUser = mutation.operation({
  name: "CreateUser",
  variables: { ...$var("input").CreateUserInput("!") },
  fields: ({ f, $ }) => ({
    ...f.createUser({ input: $.input })(({ f }) => ({
      ...f.id(),
    })),
  }),
});

// AFTER:
const createUser = mutation`
  mutation CreateUser($input: CreateUserInput!) {
    createUser(input: $input) {
      id
    }
  }
`;
```

### Subscription:

```typescript
// BEFORE:
const onMessage = subscription.operation({
  name: "OnMessage",
  fields: ({ f }) => ({
    ...f.messageAdded()(({ f }) => ({
      ...f.id(),
      ...f.content(),
    })),
  }),
});

// AFTER:
const onMessage = subscription`
  subscription OnMessage {
    messageAdded {
      id
      content
    }
  }
`;
```

### Key Pattern Recognition

When converting, look for these patterns in the source:
- `fields: ({ f }) =>` or `fields: ({ f, $ }) =>` — callback field builders
- `...f.fieldName()` — leaf field selection
- `...f.fieldName()(({ f }) => (...))` — nested object selection
- `...f.fieldName({ arg: $.var })(...)` — field with arguments
- `...$var("name").Type("!")` — variable definitions → move to GraphQL variable syntax
- `...Fragment.spread()` — fragment spread → `${Fragment}` interpolation
- `.operation({ name, variables, fields })` — operation definition → full GraphQL syntax

## Coding Conventions (Key Rules)

### Error Handling (Two-Tier Architecture)
- **Composer layer** (VM sandbox, user callbacks): `throw new Error()` / try-catch
- **Parser utilities** (`core/src/graphql/`): Self-contained `Result<T, E>` type (NOT neverthrow)
- **Builder layer boundary**: neverthrow `Result` type (`ok()`, `err()`)

### Type Safety
- NO `any` or `unknown` as standalone types
- Use generic constraints: `<T extends BaseType>`

### Testing
- Use `bun:test` (`describe`, `it`, `expect`)
- No mocks — use real dependencies
- `bun run test` (not `bun test`)

## Context Window Management

Follow these rules to prevent context pollution:

1. **Test output**: Always redirect to a temp file and check the exit code
   ```bash
   bun run test packages/core/src/graphql/ > /tmp/test-output.txt 2>&1 && echo "PASS" || (tail -20 /tmp/test-output.txt && echo "FAIL")
   ```
2. **File reading**: Only read files you need. Use offset/limit for large files.
3. **Avoid re-reading**: Don't read the same file multiple times in one session.
4. **Progress file**: Keep the Session Log section concise (1-3 lines per session).

## Reference Files

For conversion examples, refer to these already-converted files:
- `packages/core/test/integration/tagged-template-fragment.test.ts` — fragment tagged template examples
- `packages/core/test/integration/tagged-template-operation.test.ts` — operation tagged template examples
- `packages/core/test/integration/tagged-template-compat.test.ts` — compat layer examples
- `fixture-catalog/fixtures/core/valid/fragments/basic/source.ts` — converted fixture example
- `fixture-catalog/fixtures/core/valid/fragments/with-key/source.ts` — fragment with key example

## Safety Rules

1. Do NOT modify source implementation files (only test files, fixtures, docs, and playgrounds)
2. Do NOT delete existing test files — convert them in-place
3. Do NOT change the build configuration or CI setup
4. Always commit before moving to the next task
5. If stuck for more than 3 attempts on the same issue, document the blocker in progress and move on

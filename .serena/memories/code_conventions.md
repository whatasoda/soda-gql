# Code Conventions

## Type Safety
- NO `any`/`unknown` directly - use generic constraints
- Acceptable `any` usage requires suppression comment
- Validate external data with Zod v4

## Error Handling
- Use neverthrow for type-safe errors
- Use `ok()` and `err()` functions only
- NO `fromPromise` - loses type information
- Never throw - return Result types

## Code Organization
- NO classes for state management
- Pure functions for testability
- Minimize dependencies and coupling

## Package Management
- Use Bun for all operations (not npm/yarn/pnpm)
- Use Node.js APIs for implementation (fs/promises, path)
- Keep code compatible with standard Node.js runtime

## Documentation
- ALL documentation in English, American spelling
- Use "color" not "colour", "organize" not "organise"
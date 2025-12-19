# @soda-gql/graffle-client

> **Note**: This package is not yet published to npm. It is under active development and will be available in a future release.

GraphQL client integration for soda-gql, providing seamless execution of generated operations with type-safe error handling.

## Features

- Type-safe GraphQL operation execution
- Integration with `graphql-request` (with Graffle migration path)
- Structured error handling using `neverthrow`
- Zero-runtime overhead for type definitions
- Support for custom headers and request context

## Installation

```bash
bun add @soda-gql/graffle-client graphql-request neverthrow
```

## Quick Start

```typescript
import { GraphQLClient } from "graphql-request";
import { createExecutor, createGraffleRuntimeAdapter } from "@soda-gql/graffle-client";
import { myOperation } from "./my-operations";

// Create a GraphQL client (using graphql-request)
const client = new GraphQLClient("https://api.example.com/graphql", {
  headers: {
    Authorization: "Bearer YOUR_TOKEN",
  },
});

// Create an executor
const executor = createExecutor({ client });

// Execute an operation
const result = await executor.execute(myOperation, {
  userId: "123",
});

// Handle the result with neverthrow
if (result.isOk()) {
  console.log("Success:", result.value);
} else {
  console.error("Error:", result.error);
}
```

## Usage

### Creating a Runtime Adapter

The runtime adapter defines how non-GraphQL errors (network errors, timeouts, etc.) are typed:

```typescript
import { createGraffleRuntimeAdapter } from "@soda-gql/graffle-client";

const adapter = createGraffleRuntimeAdapter();
```

This adapter should be used when generating your GraphQL operations to ensure type consistency.

### Executing Operations

#### Using `executeOperation`

Execute a specific operation with variables:

```typescript
import { executeOperation } from "@soda-gql/graffle-client";

const result = await executeOperation(
  { client },
  myOperation,
  { userId: "123" },
  {
    headers: { "X-Request-ID": "abc123" },
  }
);
```

#### Using `createExecutor`

Create a reusable executor bound to a client configuration:

```typescript
import { createExecutor } from "@soda-gql/graffle-client";

const executor = createExecutor({
  client,
  headers: {
    Authorization: "Bearer TOKEN",
  },
});

// Execute operations without repeating configuration
const result1 = await executor.execute(operation1, variables1);
const result2 = await executor.execute(operation2, variables2);
```

#### Using `executeOperationByName`

Execute operations by their registered name:

```typescript
const result = await executor.executeByName("GetUser", { userId: "123" });
```

### Error Handling

The client returns `Result<TData, GraffleClientError>` from `neverthrow`, providing type-safe error handling:

```typescript
const result = await executor.execute(myOperation, variables);

result.match(
  (data) => {
    // Success case
    console.log("Data:", data);
  },
  (error) => {
    // Error case
    switch (error.code) {
      case "NETWORK_ERROR":
        console.error("Network failed:", error.message);
        break;
      case "CLIENT_CONFIG_ERROR":
        console.error("Config error:", error.message);
        break;
      case "UNKNOWN_ERROR":
        console.error("Unknown error:", error.message);
        break;
    }
  }
);
```

### Custom Headers

Add headers globally or per-request:

```typescript
// Global headers
const executor = createExecutor({
  client,
  headers: {
    Authorization: "Bearer TOKEN",
    "X-App-Version": "1.0.0",
  },
});

// Per-request headers
const result = await executor.execute(myOperation, variables, {
  headers: {
    "X-Request-ID": "unique-id",
  },
});
```

## API Reference

### `createGraffleRuntimeAdapter()`

Creates a runtime adapter for graffle-client error types.

**Returns:** `GraffleRuntimeAdapter`

### `createExecutor(config)`

Creates an executor bound to a specific client configuration.

**Parameters:**
- `config.client` - GraphQL client instance
- `config.headers?` - Optional default headers
- `config.context?` - Optional request context

**Returns:** Object with `execute` and `executeByName` methods

### `executeOperation(config, operation, variables, options?)`

Executes a GraphQL operation.

**Parameters:**
- `config` - Executor configuration
- `operation` - Operation to execute
- `variables` - Operation variables
- `options?` - Optional execution options

**Returns:** `Promise<Result<TProjectedData, GraffleClientError>>`

### `executeOperationByName(config, operationName, variables, options?)`

Executes a registered operation by name.

**Parameters:**
- `config` - Executor configuration
- `operationName` - Name of the registered operation
- `variables` - Operation variables
- `options?` - Optional execution options

**Returns:** `Promise<Result<TProjectedData, GraffleClientError>>`

## Migration Path

Currently, this package uses `graphql-request@7.x` for stability. When Graffle reaches a stable release, the package will provide a migration guide. The API is designed to be client-agnostic, so switching will require minimal changes.

## Error Types

### `NetworkError`

Network or transport layer failures.

```typescript
{
  code: "NETWORK_ERROR",
  message: string,
  cause?: unknown
}
```

### `ClientConfigError`

Client configuration issues.

```typescript
{
  code: "CLIENT_CONFIG_ERROR",
  message: string,
  cause?: unknown
}
```

### `UnknownError`

Unexpected errors.

```typescript
{
  code: "UNKNOWN_ERROR",
  message: string,
  cause?: unknown
}
```

## TypeScript Support

This package is written in TypeScript and provides full type safety:

- Typed operation variables
- Typed response data
- Typed error codes
- Typed header configurations

## Contributing

See the main [CLAUDE.md](../../CLAUDE.md) for contribution guidelines.

## License

MIT

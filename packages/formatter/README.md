# @soda-gql/formatter

GraphQL document formatter for soda-gql. This package formats generated GraphQL documents for better readability.

## Features

- **Consistent formatting** - Produces clean, readable GraphQL output
- **SWC-based parsing** - Fast parsing using SWC
- **Optional integration** - Used by CLI when available

## Installation

```bash
npm install @soda-gql/formatter
# or
bun add @soda-gql/formatter
```

## Usage

The formatter is typically used through the CLI:

```bash
soda-gql codegen --format
```

### Programmatic Usage

```typescript
import { formatGraphQL } from "@soda-gql/formatter";

const result = formatGraphQL(graphqlDocument);

if (result.isOk()) {
  console.log(result.value);
}
```

## Requirements

- Node.js >= 18
- `@swc/core` >= 1.0.0 (peer dependency)

## Related Packages

- [@soda-gql/cli](../cli) - Command-line interface
- [@soda-gql/codegen](../codegen) - Code generation

## License

MIT

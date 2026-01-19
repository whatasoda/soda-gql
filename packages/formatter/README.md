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
soda-gql format
```

### Programmatic Usage

```typescript
import { format, needsFormat } from "@soda-gql/formatter";

// Format a source file
const result = format({
  sourceCode: source,
  filePath: "/path/to/file.ts", // optional, used for TSX detection
});

if (result.isOk()) {
  const { modified, sourceCode } = result.value;
  if (modified) {
    // Source was formatted
    console.log(sourceCode);
  }
}

// Check if formatting is needed (useful for pre-commit hooks)
const needsFormatting = needsFormat({ sourceCode: source });
if (needsFormatting.isOk() && needsFormatting.value) {
  console.log("File needs formatting");
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

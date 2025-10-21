# Plugin-Babel Test Fixtures

This directory contains fixture-based test scenarios for the @soda-gql/plugin-babel package.

## Structure

```
tests/fixtures/plugin-babel/
├── operations/basic/     - GraphQL operations (query, mutation, subscription)
├── models/basic/         - GraphQL models with transformations
├── slices/basic/         - GraphQL slices (query/mutation slices)
├── imports/              - Import hygiene test scenarios
│   ├── add-runtime-import/
│   ├── remove-gql-import/
│   ├── preserve-gql-import/
│   ├── merge-runtime-import/
│   └── multiple-models/
└── errors/               - Error handling scenarios
    ├── invalid-artifact/
    └── no-gql/
```

## Fixture Format

Each fixture directory contains:
- `source.ts` - TypeScript source code with gql definitions
- `fixture.json` - Metadata describing expected elements and prebuild data

### fixture.json Format

```json
{
  "source": "source.ts",
  "elements": [
    {
      "export": "exportName",
      "type": "operation" | "model" | "slice",
      "prebuild": {
        // Type-specific prebuild data
      }
    }
  ]
}
```

## Usage

Load fixtures in tests using the helper:

```typescript
import { loadPluginBabelFixture } from "../../utils/pluginBabelFixtures";

const fixture = await loadPluginBabelFixture("operations/basic");
// fixture.sourcePath - absolute path to source.ts
// fixture.sourceCode - content of source.ts
// fixture.artifact - BuilderArtifact for transformation
// fixture.elements - metadata from fixture.json
```

## Testing Approach

Tests use these fixtures to verify **behavioral transformation**, not string output:

1. Load fixture with source code and artifact
2. Run Babel transformation
3. Verify transformation behavior (not exact output format)
4. Optionally execute transformed code to verify runtime behavior

This approach follows the project's testing conventions:
- Fixture-based (not inline strings)
- Behavioral (not implementation details)
- Type-checked fixtures for refactoring support

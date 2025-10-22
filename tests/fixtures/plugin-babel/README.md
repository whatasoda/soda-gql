# Plugin-Babel Test Fixtures (Deprecated)

**This directory is deprecated. All fixtures have been migrated to `tests/fixtures/plugins-common/`.**

## Migration Notice

All plugin-babel specific fixtures have been consolidated into the shared `plugins-common` directory to:
- Eliminate duplication between plugin-babel and plugin-tsc tests
- Ensure consistent test coverage across all plugin implementations
- Simplify fixture maintenance

## New Location

Plugin fixtures are now located at:
```
tests/fixtures/plugins-common/
├── models/               - Model fixtures
├── slices/               - Slice fixtures
├── operations/           - Operation fixtures
├── imports/              - Import handling scenarios
├── runtime/              - Runtime transformation order tests
├── mixed/                - Multi-file application scenarios
└── errors/               - Error handling scenarios
```

## Usage

Load fixtures using the shared helpers:

```typescript
import { loadPluginFixture, loadPluginFixtureMulti } from "../../utils/pluginFixtures";

// Single file fixture
const fixture = await loadPluginFixture("operations/basic");

// Multi-file fixture
const multiFixture = await loadPluginFixtureMulti("mixed/full-app");
```

These fixtures work with both plugin-babel and plugin-tsc tests.

# Runtime Fixture Application

This fixture mirrors the quickstart flow exercised by integration tests:

- `schema.graphql` defines the domain schema used by `soda-gql codegen`.
- `src/entities/user.ts` exports reusable `gql.model` and `gql.querySlice` definitions.
- `src/pages/profile.query.ts` composes the slice into a page-level query.
- `src/pages/profile.page.ts` provides a simple entry descriptor consumed by builder tests.
- `babel.config.js` configures the Babel plugin placeholder toggled during zero-runtime validation.

Integration helpers copy this directory, run `codegen` + `builder`, and load the emitted artifacts to assert runtime and zero-runtime behaviour.

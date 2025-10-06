// Re-export shared error utilities

// Re-export error types
export type { PluginError } from "@soda-gql/plugin-shared";
export {
  assertUnreachable,
  formatPluginError,
  isPluginError,
  pluginErr,
} from "@soda-gql/plugin-shared/errors";

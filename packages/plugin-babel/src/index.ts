/**
 * Babel plugin entrypoint for soda-gql.
 *
 * This module provides Babel transformer integration for soda-gql
 * zero-runtime transformations.
 */

export * from "./plugin";

import { createSodaGqlPlugin } from "./plugin";

export { createSodaGqlPlugin };
export default createSodaGqlPlugin;

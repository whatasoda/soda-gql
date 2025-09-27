/**
 * @soda-gql/tool-utils
 *
 * Utility collection exclusively for the toolchain
 *
 * ⚠️ Important Limitations:
 * - Use this package only in the toolchain (builder, cli, etc.)
 * - NEVER use in core and runtime packages
 * - Ensure it is not included in application runtime code
 *
 * These utilities are designed for use in development tools and are not
 * intended to be executed in end-user applications.
 */

export { ensureDir, type FileSystemError, fileExists, readTextFile, writeTextFile } from "./fs-utils";
export { UnwrapNullishError, unwrapNullish } from "./unwrap-nullish";

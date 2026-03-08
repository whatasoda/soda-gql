/**
 * Prebuilt type generation for soda-gql.
 *
 * This package provides utilities for generating prebuilt types
 * from source code after running codegen.
 *
 * @module
 */

export type { PrebuiltTypesEmitResult, PrebuiltTypesEmitterOptions } from "./emitter";
// Prebuilt types emitter
export { emitPrebuiltTypes } from "./emitter";
export type { TypegenError, TypegenErrorCode, TypegenSpecificError } from "./errors";
// Error types and helpers
export { formatTypegenError, typegenErrors } from "./errors";
export type { RunTypegenOptions } from "./runner";

// Main runner
export { runTypegen } from "./runner";
// Types
export type { TypegenOptions, TypegenResult, TypegenSuccess } from "./types";

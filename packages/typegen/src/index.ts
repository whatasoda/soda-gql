/**
 * Prebuilt type generation for soda-gql.
 *
 * This package provides utilities for generating prebuilt types
 * from source code after running codegen.
 *
 * @module
 */

// Error types and helpers
export { formatTypegenError, typegenErrors } from "./errors";
export type { TypegenError, TypegenErrorCode, TypegenSpecificError } from "./errors";

// Types
export type { TypegenOptions, TypegenResult, TypegenSuccess } from "./types";

// Prebuilt module generator
export { generatePrebuiltModule } from "./prebuilt-generator";
export type { PrebuiltGeneratedModule, PrebuiltGeneratorOptions } from "./prebuilt-generator";

// Prebuilt types emitter
export { emitPrebuiltTypes } from "./emitter";
export type { PrebuiltTypesEmitResult, PrebuiltTypesEmitterOptions } from "./emitter";

// Main runner
export { runTypegen } from "./runner";
export type { RunTypegenOptions } from "./runner";

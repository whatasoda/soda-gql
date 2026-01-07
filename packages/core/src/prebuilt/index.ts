/**
 * Prebuilt types module for bundler-compatible type resolution.
 *
 * This module provides types and utilities for looking up pre-computed types
 * from a registry instead of relying on complex type inference that may be
 * lost when bundling with tools like tsdown.
 *
 * @module
 */

// Type calculator utilities
export {
  applyTypeModifier,
  calculateFieldsType,
  calculateFieldType,
  type GenerateInputObjectTypeOptions,
  generateInputObjectType,
  generateInputType,
  getEnumType,
  getScalarInputType,
  getScalarOutputType,
  getScalarType,
  graphqlTypeToTypeScript,
} from "./type-calculator";
// Type definitions
export type {
  EmptyPrebuiltTypeRegistry,
  HasPrebuiltFragment,
  HasPrebuiltOperation,
  PrebuiltFragmentInput,
  PrebuiltFragmentOutput,
  PrebuiltOperationInput,
  PrebuiltOperationOutput,
  PrebuiltTypeRegistry,
} from "./types";

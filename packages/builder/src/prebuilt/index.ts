/**
 * Prebuilt type generation module.
 *
 * This module provides utilities for generating PrebuiltTypes from
 * builder artifacts and field selection data.
 *
 * @module
 */

export { emitPrebuiltTypes, type PrebuiltTypesEmitResult, type PrebuiltTypesEmitterOptions } from "./emitter";
export { extractFieldSelections, type FieldSelectionsMap, type FieldSelectionsResult } from "./extractor";

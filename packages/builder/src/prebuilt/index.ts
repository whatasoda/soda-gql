/**
 * Prebuilt type generation module.
 *
 * This module provides utilities for generating PrebuiltTypes from
 * builder artifacts and field selection data.
 *
 * @module
 */

export { emitPrebuiltTypes, type PrebuiltTypesEmitterOptions } from "./emitter";
export { extractFieldSelections, type FieldSelectionsMap } from "./extractor";

#!/usr/bin/env bun
/**
 * Generator that uses branded types to avoid structural comparison.
 *
 * Strategy:
 * 1. Add `satisfies AnyGraphqlSchema` to the schema definition
 * 2. This forces TypeScript to verify the constraint once at definition time
 * 3. Subsequent uses of the schema type should skip the comparison
 */

import type { DocumentNode } from "graphql";
import { generateMultiSchemaModule } from "../../../packages/codegen/src/generator";

export const generateMultiSchemaModuleBranded = (
  schemas: Map<string, DocumentNode>,
): ReturnType<typeof generateMultiSchemaModule> => {
  // Just use the standard generator - it already has `satisfies AnyGraphqlSchema`
  // The "branded" strategy was originally intended to add satisfies, but this
  // is now part of the standard generator.
  return generateMultiSchemaModule(schemas);
};

#!/usr/bin/env bun
/**
 * Generator that removes the expensive `satisfies InputTypeMethods<...>` clause.
 *
 * The trace analysis showed the bottleneck is not at createGqlElementComposer
 * but at the inputTypeMethods object with its `satisfies` clause.
 *
 * This clause triggers TypeScript to:
 * 1. Expand the mapped type InputTypeMethods<TSchema>
 * 2. For each of ~300 input types, compute InputTypeMethod<...>
 * 3. Verify each property matches the expected type
 *
 * By removing this check, we trade compile-time safety for speed.
 */

import type { DocumentNode } from "graphql";
import { generateMultiSchemaModule } from "../../../packages/codegen/src/generator";

export const generateMultiSchemaModuleNoSatisfies = (
  schemas: Map<string, DocumentNode>,
): { code: string } => {
  const { code: originalCode } = generateMultiSchemaModule(schemas);

  // Remove the `satisfies InputTypeMethods<typeof hasuraSchema>` clause
  const modifiedCode = originalCode.replace(
    /\} satisfies InputTypeMethods<typeof \w+Schema>;/g,
    "};"
  );

  return { code: modifiedCode };
};

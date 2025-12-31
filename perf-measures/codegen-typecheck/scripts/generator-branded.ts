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
): { code: string } => {
  const { code: originalCode } = generateMultiSchemaModule(schemas);

  // Add AnyGraphqlSchema import
  let modifiedCode = originalCode.replace(
    /createVarMethodFactory,\n\} from "@soda-gql\/core";/,
    'createVarMethodFactory,\n  type AnyGraphqlSchema,\n} from "@soda-gql/core";',
  );

  // Change const declaration to add satisfies clause
  // Before: const hasuraSchema = { ... } as const;
  // After:  const hasuraSchema = { ... } as const satisfies AnyGraphqlSchema;
  modifiedCode = modifiedCode.replace(
    /^(const \w+Schema = \{[\s\S]*?\}) as const;$/m,
    "$1 as const satisfies AnyGraphqlSchema;",
  );

  return { code: modifiedCode };
};

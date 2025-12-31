#!/usr/bin/env bun
/**
 * Generator that creates a wrapper with looser type constraints.
 *
 * Strategy:
 * 1. Create a local simplified AnyGraphqlSchema type alias
 * 2. Use type assertion to bypass the constraint check at definition time
 * 3. Pass the schema with explicit type assertions
 */

import type { DocumentNode } from "graphql";
import { generateMultiSchemaModule } from "../../../packages/codegen/src/generator";

export const generateMultiSchemaModuleLooseConstraint = (
  schemas: Map<string, DocumentNode>,
): { code: string } => {
  const { code: originalCode } = generateMultiSchemaModule(schemas);

  // Add a local type wrapper at the top, after imports
  const typeWrapper = `
// Bypass expensive structural type checking by using 'any' for the schema parameter
type BypassSchemaCheck<T> = T extends infer U ? U : never;

`;

  // Insert after imports
  let modifiedCode = originalCode.replace(
    /^(import \{[\s\S]*?\} from "@soda-gql\/core";\n)/m,
    `$1${typeWrapper}`,
  );

  // Modify the createGqlElementComposer call to cast schema to any first
  // This bypasses the structural comparison
  modifiedCode = modifiedCode.replace(
    /createGqlElementComposer<([^>]+)>\((\w+Schema),/g,
    (match, typeParams, schemaVar) => {
      // Cast to any first, then to the specific type
      return `createGqlElementComposer<${typeParams}>(${schemaVar} as any,`;
    }
  );

  return { code: modifiedCode };
};

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
): ReturnType<typeof generateMultiSchemaModule> => {
  const result = generateMultiSchemaModule(schemas);
  const { code: originalCode } = result;

  // Modify the createGqlElementComposer call to cast schema to any first
  // This bypasses the structural comparison
  const modifiedCode = originalCode.replace(
    /createGqlElementComposer<([^>]+)>\((\w+Schema),/g,
    (_match, typeParams, schemaVar) => {
      // Cast to any first, then to the specific type
      return `createGqlElementComposer<${typeParams}>(${schemaVar} as any,`;
    }
  );

  return { ...result, code: modifiedCode };
};

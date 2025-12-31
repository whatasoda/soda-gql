#!/usr/bin/env bun
/**
 * Generator that splits schema into multiple files.
 *
 * Strategy:
 * 1. Split the schema object into separate files by category
 * 2. Use declaration merging to combine them
 * 3. This may allow TypeScript to cache type relationships per file
 */

import type { DocumentNode, TypeDefinitionNode } from "graphql";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { generateMultiSchemaModule } from "../../../packages/codegen/src/generator";

interface GeneratedFiles {
  files: Map<string, string>;
}

export const generateMultiSchemaModuleSplitFiles = async (
  schemas: Map<string, DocumentNode>,
  outputDir: string,
): Promise<GeneratedFiles> => {
  const { code: originalCode } = generateMultiSchemaModule(schemas);

  // Parse the original code to extract sections
  const files = new Map<string, string>();

  // For now, let's create a simpler split:
  // 1. schema-types.ts - all the scalar, enum, input, object, union definitions
  // 2. schema-methods.ts - input type methods
  // 3. index.ts - combines everything and exports

  // Extract scalar definitions
  const scalarMatch = originalCode.match(/scalar: \{[\s\S]*?\n  \},\n  enum:/);
  const enumMatch = originalCode.match(/enum: \{[\s\S]*?\n  \},\n  input:/);
  const inputMatch = originalCode.match(/input: \{[\s\S]*?\n  \},\n  object:/);
  const objectMatch = originalCode.match(/object: \{[\s\S]*?\n  \},\n  union:/);
  const unionMatch = originalCode.match(/union: \{[\s\S]*?\n  \},?\n\}/);

  // Create schema-core.ts with just the schema structure
  const schemaCoreContent = `// Auto-generated schema core definitions
import {
  type ExtractMetadataAdapter,
  type FragmentBuilderFor,
  type InputTypeMethods,
  createGqlElementComposer,
  createVarMethodFactory,
} from "@soda-gql/core";

${originalCode}
`;

  files.set("index.ts", schemaCoreContent);

  return { files };
};

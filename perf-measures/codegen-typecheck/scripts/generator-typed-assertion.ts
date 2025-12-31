/**
 * Generator for Approach: Type Assertion Bypass
 *
 * This generator produces code that uses type assertions to bypass
 * TypeScript's structural type comparison when passing the schema
 * to createGqlElementComposer.
 *
 * The hypothesis is that explicitly asserting the schema type
 * will reduce the time TypeScript spends in structuredTypeRelatedTo.
 */

import {
  type ConstDirectiveNode,
  type ConstValueNode,
  type DocumentNode,
  type EnumValueDefinitionNode,
  type FieldDefinitionNode,
  type InputValueDefinitionNode,
  Kind,
  type NamedTypeNode,
  type SchemaDefinitionNode,
  type SchemaExtensionNode,
  type TypeNode,
} from "graphql";

// Import the original generator and modify the output
import { generateMultiSchemaModule } from "../../../packages/codegen/src/generator";

export const generateMultiSchemaModuleTypedAssertion = (
  schemas: Map<string, DocumentNode>,
): { code: string } => {
  const { code: originalCode } = generateMultiSchemaModule(schemas);

  // Modify the createGqlElementComposer call to use type assertion
  // Original: createGqlElementComposer<Schema_hasura, FragmentBuilders_hasura>(hasuraSchema, { ... })
  // Modified: createGqlElementComposer<Schema_hasura, FragmentBuilders_hasura>(hasuraSchema as Schema_hasura, { ... })

  const modifiedCode = originalCode.replace(
    /createGqlElementComposer<([^>]+)>\((\w+Schema),/g,
    (match, typeParams, schemaVar) => {
      const schemaType = typeParams.split(",")[0].trim();
      return `createGqlElementComposer<${typeParams}>(${schemaVar} as ${schemaType},`;
    }
  );

  return { code: modifiedCode };
};

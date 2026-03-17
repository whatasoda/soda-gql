/**
 * Definition handler: provides go-to-definition for callback builder field tree nodes.
 * @module
 */

import type { GraphQLSchema, NamedTypeNode } from "graphql";
import { Kind } from "graphql";
import { getDefinitionQueryResultForField, getDefinitionQueryResultForNamedType } from "graphql-language-service";
import type { Location } from "vscode-languageserver-types";
import type { TypedFieldTree } from "../field-tree-resolver";
import { findNodeAtOffset } from "../field-tree-resolver";
import type { Position } from "../position-mapping";
import type { SchemaFileInfo } from "../schema-resolver";
import { buildObjectTypeInfos } from "./_utils";

export type HandleFieldTreeDefinitionInput = {
  readonly fieldTree: TypedFieldTree;
  readonly schema: GraphQLSchema;
  readonly tsSource: string;
  readonly tsPosition: Position;
  readonly offset: number;
  readonly schemaFiles: readonly SchemaFileInfo[];
};

/** Handle a definition request for a callback builder field tree. */
export const handleFieldTreeDefinition = async (input: HandleFieldTreeDefinitionInput): Promise<Location[]> => {
  const { fieldTree, offset, schemaFiles } = input;
  const result = findNodeAtOffset(fieldTree, offset);
  if (!result) return [];

  const objectTypeInfos = buildObjectTypeInfos(schemaFiles);

  if (result.kind === "field") {
    const { node } = result;
    try {
      const defResult = await getDefinitionQueryResultForField(node.fieldName, node.parentTypeName, objectTypeInfos);
      return defResult.definitions.map(
        (def): Location => ({
          uri: def.path ?? "",
          range: {
            start: { line: def.position.line, character: def.position.character },
            end: {
              line: def.range?.end?.line ?? def.position.line,
              character: def.range?.end?.character ?? def.position.character,
            },
          },
        }),
      );
    } catch {
      return [];
    }
  }

  if (result.kind === "unionMember") {
    // graphql-language-service requires loc.start/end on the NamedTypeNode for queryRange.
    // We supply a minimal stub since we only use def.position/def.range from the result.
    const typeNameLen = result.branch.typeName.length;
    const dummyLoc = { start: 0, end: typeNameLen, startToken: null, endToken: null, source: null };
    const namedTypeNode = {
      kind: Kind.NAMED_TYPE,
      name: { kind: Kind.NAME, value: result.branch.typeName, loc: dummyLoc },
      loc: dummyLoc,
    } as unknown as NamedTypeNode;
    try {
      const defResult = await getDefinitionQueryResultForNamedType("", namedTypeNode, objectTypeInfos);
      return defResult.definitions.map(
        (def): Location => ({
          uri: def.path ?? "",
          range: {
            start: { line: def.position.line, character: def.position.character },
            end: {
              line: def.range?.end?.line ?? def.position.line,
              character: def.range?.end?.character ?? def.position.character,
            },
          },
        }),
      );
    } catch {
      return [];
    }
  }

  return [];
};

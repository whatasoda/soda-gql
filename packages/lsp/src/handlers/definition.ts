/**
 * Definition handler: provides go-to-definition for fragment spreads and schema fields/types.
 * @module
 */

import { pathToFileURL } from "node:url";
import type { GraphQLSchema, TypeDefinitionNode } from "graphql";
import { getNamedType, isTypeDefinitionNode, parse } from "graphql";
import {
  getContextAtPosition,
  getDefinitionQueryResultForField,
  getDefinitionQueryResultForFragmentSpread,
  type ObjectTypeInfo,
} from "graphql-language-service";
import type { Location } from "vscode-languageserver-types";
import { reconstructGraphql } from "../document-manager";
import { preprocessFragmentArgs } from "../fragment-args-preprocessor";
import {
  computeLineOffsets,
  createPositionMapper,
  offsetToPosition,
  type Position,
  positionToOffset,
  toIPosition,
} from "../position-mapping";
import type { SchemaFileInfo } from "../schema-resolver";
import type { ExtractedTemplate, IndexedFragment } from "../types";
import { findFragmentSpreadAtOffset } from "./_utils";

export type HandleDefinitionInput = {
  readonly template: ExtractedTemplate;
  readonly tsSource: string;
  /** LSP Position (0-indexed line, 0-indexed character) in the TS file. */
  readonly tsPosition: Position;
  /** External fragment definitions for cross-file resolution. */
  readonly externalFragments: readonly IndexedFragment[];
  /** GraphQL schema for field/type resolution. */
  readonly schema?: GraphQLSchema;
  /** Per-file schema source info for go-to-definition in schema files. */
  readonly schemaFiles?: readonly SchemaFileInfo[];
};

/** Build ObjectTypeInfo[] from schema file info for graphql-language-service definition APIs. */
const buildObjectTypeInfos = (files: readonly SchemaFileInfo[]): ObjectTypeInfo[] => {
  const result: ObjectTypeInfo[] = [];
  for (const file of files) {
    const doc = parse(file.content);
    for (const def of doc.definitions) {
      if (isTypeDefinitionNode(def)) {
        result.push({
          filePath: pathToFileURL(file.filePath).href,
          content: file.content,
          definition: def as TypeDefinitionNode,
        });
      }
    }
  }
  return result;
};

/** Handle a definition request for a GraphQL template. */
export const handleDefinition = async (input: HandleDefinitionInput): Promise<Location[]> => {
  const { template, tsSource, tsPosition, externalFragments } = input;
  const reconstructed = reconstructGraphql(template);
  const headerLen = reconstructed.length - template.content.length;
  const { preprocessed } = preprocessFragmentArgs(reconstructed);

  const mapper = createPositionMapper({
    tsSource,
    contentStartOffset: template.contentRange.start,
    graphqlContent: template.content,
  });

  const gqlPosition = mapper.tsToGraphql(tsPosition);
  if (!gqlPosition) {
    return [];
  }

  // Convert from content-relative position to reconstructed-relative offset
  const contentLineOffsets = computeLineOffsets(template.content);
  const contentOffset = positionToOffset(contentLineOffsets, gqlPosition);
  const reconstructedOffset = contentOffset + headerLen;

  // 1. Try fragment spread navigation (existing behavior)
  const fragmentSpread = findFragmentSpreadAtOffset(preprocessed, reconstructedOffset);
  if (fragmentSpread) {
    return resolveFragmentSpreadDefinition(preprocessed, fragmentSpread, externalFragments);
  }

  // 2. Try field/type navigation in schema files
  if (input.schema && input.schemaFiles && input.schemaFiles.length > 0) {
    const reconstructedLineOffsets = computeLineOffsets(preprocessed);
    const reconstructedPosition = offsetToPosition(reconstructedLineOffsets, reconstructedOffset);
    return resolveSchemaDefinition(preprocessed, reconstructedPosition, input.schema, input.schemaFiles);
  }

  return [];
};

/** Resolve fragment spread to its definition in an external TypeScript file. */
const resolveFragmentSpreadDefinition = async (
  preprocessed: string,
  fragmentSpread: ReturnType<typeof findFragmentSpreadAtOffset> & {},
  externalFragments: readonly IndexedFragment[],
): Promise<Location[]> => {
  const fragmentInfos = externalFragments.map((f) => ({
    filePath: f.uri,
    content: f.content,
    definition: f.definition,
  }));

  try {
    const result = await getDefinitionQueryResultForFragmentSpread(preprocessed, fragmentSpread, fragmentInfos);

    return result.definitions.map((def): Location => {
      const defPosition = toIPosition(def.position);
      const endLine = def.range?.end?.line ?? defPosition.line;
      const endChar = def.range?.end?.character ?? defPosition.character;

      // Map GraphQL-relative positions to TS file positions for the target document
      const targetFragment = externalFragments.find((f) => f.uri === def.path);
      if (targetFragment) {
        const targetReconstructedLineOffsets = computeLineOffsets(targetFragment.content);
        const targetContentLineOffsets = computeLineOffsets(targetFragment.content.slice(targetFragment.headerLen));

        const toOriginalPos = (pos: { line: number; character: number }) => {
          const offset = positionToOffset(targetReconstructedLineOffsets, pos);
          const originalOffset = Math.max(0, offset - targetFragment.headerLen);
          return offsetToPosition(targetContentLineOffsets, originalOffset);
        };

        const targetMapper = createPositionMapper({
          tsSource: targetFragment.tsSource,
          contentStartOffset: targetFragment.contentRange.start,
          graphqlContent: targetFragment.content.slice(targetFragment.headerLen),
        });
        const tsStart = targetMapper.graphqlToTs(toOriginalPos({ line: defPosition.line, character: defPosition.character }));
        const tsEnd = targetMapper.graphqlToTs(toOriginalPos({ line: endLine, character: endChar }));
        return {
          uri: def.path,
          range: { start: tsStart, end: tsEnd },
        };
      }

      return {
        uri: def.path,
        range: {
          start: { line: defPosition.line, character: defPosition.character },
          end: { line: endLine, character: endChar },
        },
      };
    });
  } catch {
    return [];
  }
};

/** Resolve field or type name to its definition in a schema .graphql file. */
const resolveSchemaDefinition = (
  preprocessed: string,
  position: Position,
  schema: GraphQLSchema,
  schemaFiles: readonly SchemaFileInfo[],
): Promise<Location[]> => {
  const context = getContextAtPosition(preprocessed, toIPosition(position), schema);
  if (!context) {
    return Promise.resolve([]);
  }

  const { typeInfo } = context;

  // Field definition: cursor is on a field name
  if (typeInfo.fieldDef && typeInfo.parentType) {
    const fieldName = typeInfo.fieldDef.name;
    const namedParentType = getNamedType(typeInfo.parentType);
    if (!namedParentType) {
      return Promise.resolve([]);
    }
    const parentTypeName = namedParentType.name;
    const objectTypeInfos = buildObjectTypeInfos(schemaFiles);
    return getDefinitionQueryResultForField(fieldName, parentTypeName, objectTypeInfos).then((result) =>
      result.definitions.map(
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
      ),
    );
  }

  return Promise.resolve([]);
};

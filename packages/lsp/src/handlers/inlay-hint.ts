/**
 * Inlay hint handler: provides inline type hints for fields in GraphQL templates.
 * @module
 */

import type { GraphQLObjectType, GraphQLSchema } from "graphql";
import { getNamedType, isObjectType, Kind, parse, visit } from "graphql";
import type { InlayHint } from "vscode-languageserver-types";
import { InlayHintKind } from "vscode-languageserver-types";
import { reconstructGraphql } from "../document-manager";
import { preprocessFragmentArgs } from "../fragment-args-preprocessor";
import { computeLineOffsets, createPositionMapper, offsetToPosition } from "../position-mapping";
import type { ExtractedTemplate } from "../types";

export type HandleInlayHintInput = {
  readonly template: ExtractedTemplate;
  readonly schema: GraphQLSchema;
  readonly tsSource: string;
};

/** Handle an inlay hint request for a GraphQL template. */
export const handleInlayHint = (input: HandleInlayHintInput): InlayHint[] => {
  const { template, schema, tsSource } = input;
  const reconstructed = reconstructGraphql(template);
  const headerLen = reconstructed.length - template.content.length;
  const { preprocessed } = preprocessFragmentArgs(reconstructed);

  const mapper = createPositionMapper({
    tsSource,
    contentStartOffset: template.contentRange.start,
    graphqlContent: template.content,
  });
  const contentLineOffsets = computeLineOffsets(template.content);

  const hints: InlayHint[] = [];

  try {
    const doc = parse(preprocessed);
    const rootType = getRootType(schema, template.kind, preprocessed);
    if (!rootType) {
      return hints;
    }

    // Track the parent type through the selection set traversal
    const typeStack: Array<GraphQLObjectType | null> = [rootType];

    visit(doc, {
      Field: {
        enter(node) {
          const fieldName = node.name.value;
          const parentType = typeStack[typeStack.length - 1];

          // Skip __typename as it's an introspection field
          if (fieldName === "__typename") {
            typeStack.push(null);
            return;
          }

          if (!parentType) {
            typeStack.push(null);
            return;
          }

          const field = parentType.getFields()[fieldName];
          if (!field) {
            typeStack.push(null);
            return;
          }

          const typeStr = field.type.toString();

          // Get the position after the field name, converting from reconstructed to content space
          const fieldEndOffsetInReconstructed = node.name.loc?.end ?? 0;
          const fieldEndOffsetInContent = Math.max(0, fieldEndOffsetInReconstructed - headerLen);
          const contentPosition = offsetToPosition(contentLineOffsets, fieldEndOffsetInContent);

          const tsPosition = mapper.graphqlToTs(contentPosition);
          if (tsPosition) {
            hints.push({
              position: tsPosition,
              label: `: ${typeStr}`,
              kind: InlayHintKind.Type,
              paddingLeft: false,
              paddingRight: true,
            });
          }

          // Push the field's return type for nested selection sets
          const namedType = getNamedType(field.type);
          if (isObjectType(namedType)) {
            typeStack.push(namedType);
          } else {
            typeStack.push(null);
          }
        },
        leave() {
          typeStack.pop();
        },
      },
    });
  } catch {
    // If parse fails, return empty hints
    return hints;
  }

  return hints;
};

const getRootType = (schema: GraphQLSchema, kind: string, content?: string): GraphQLObjectType | null => {
  switch (kind) {
    case "query":
      return schema.getQueryType() ?? null;
    case "mutation":
      return schema.getMutationType() ?? null;
    case "subscription":
      return schema.getSubscriptionType() ?? null;
    case "fragment": {
      if (!content) return null;
      try {
        const doc = parse(content);
        const fragDef = doc.definitions.find((d) => d.kind === Kind.FRAGMENT_DEFINITION);
        if (!fragDef || fragDef.kind !== Kind.FRAGMENT_DEFINITION) return null;
        const typeName = fragDef.typeCondition.name.value;
        const type = schema.getType(typeName);
        return isObjectType(type) ? type : null;
      } catch {
        return null;
      }
    }
    default:
      return null;
  }
};

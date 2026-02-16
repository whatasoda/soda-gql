/**
 * Inlay hint handler: provides inline type hints for fields in GraphQL templates.
 * @module
 */

import type { GraphQLObjectType, GraphQLSchema } from "graphql";
import { getNamedType, isObjectType, parse, visit } from "graphql";
import type { InlayHint } from "vscode-languageserver-types";
import { InlayHintKind } from "vscode-languageserver-types";
import { preprocessFragmentArgs } from "../fragment-args-preprocessor";
import { createPositionMapper, type Position } from "../position-mapping";
import type { ExtractedTemplate } from "../types";

export type HandleInlayHintInput = {
  readonly template: ExtractedTemplate;
  readonly schema: GraphQLSchema;
  readonly tsSource: string;
};

/** Handle an inlay hint request for a GraphQL template. */
export const handleInlayHint = (input: HandleInlayHintInput): InlayHint[] => {
  const { template, schema, tsSource } = input;
  const { preprocessed } = preprocessFragmentArgs(template.content);

  const mapper = createPositionMapper({
    tsSource,
    contentStartOffset: template.contentRange.start,
    graphqlContent: template.content,
  });

  const hints: InlayHint[] = [];

  try {
    const doc = parse(preprocessed);
    const rootType = getRootType(schema, template.kind);
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

          // Get the position after the field name in the GraphQL content
          const fieldEndOffset = node.name.loc?.end ?? 0;
          const gqlPosition: Position = {
            line: (node.name.loc?.startToken.line ?? 1) - 1,
            character: fieldEndOffset - (node.name.loc?.startToken.start ?? 0),
          };

          const tsPosition = mapper.graphqlToTs(gqlPosition);
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

const getRootType = (schema: GraphQLSchema, kind: string): GraphQLObjectType | null => {
  switch (kind) {
    case "query":
      return schema.getQueryType() ?? null;
    case "mutation":
      return schema.getMutationType() ?? null;
    case "subscription":
      return schema.getSubscriptionType() ?? null;
    default:
      return null;
  }
};

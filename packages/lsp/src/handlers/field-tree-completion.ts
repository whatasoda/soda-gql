/**
 * Completion handler for callback builder field tree nodes.
 * Provides field and union member type completions based on the typed field tree.
 * @module
 */

import type { GraphQLSchema } from "graphql";
import { getNamedType, GraphQLUnionType, isObjectType } from "graphql";
import type { CompletionItem } from "vscode-languageserver-types";
import { CompletionItemKind } from "vscode-languageserver-types";
import type { TypedFieldTree } from "../field-tree-resolver";
import { findNodeAtOffset } from "../field-tree-resolver";
import type { Position } from "../position-mapping";

export type HandleFieldTreeCompletionInput = {
  readonly fieldTree: TypedFieldTree;
  readonly schema: GraphQLSchema;
  readonly tsSource: string;
  readonly tsPosition: Position;
  /** Character offset in the TS source file. */
  readonly offset: number;
};

/** Handle a completion request for a callback builder field tree node. */
export const handleFieldTreeCompletion = (input: HandleFieldTreeCompletionInput): CompletionItem[] => {
  const { fieldTree, schema, tsSource, offset } = input;
  const result = findNodeAtOffset(fieldTree, offset);

  if (!result) return [];

  if (result.kind === "field") {
    const { node } = result;
    // Get the current prefix the user has typed (text between fieldNameSpan.start and cursor offset)
    const prefix = tsSource.slice(node.fieldNameSpan.start, offset);

    // Get fields from the parent type
    const parentType = schema.getType(node.parentTypeName);
    if (!parentType || !isObjectType(parentType)) return [];

    const fields = parentType.getFields();
    return Object.keys(fields)
      .filter((name) => name.startsWith(prefix))
      .map((name) => {
        const field = fields[name]!;
        const namedType = getNamedType(field.type);
        return {
          label: name,
          kind: CompletionItemKind.Field,
          detail: namedType?.name,
        };
      });
  }

  if (result.kind === "unionMember") {
    const { parentNode } = result;
    // Get union members
    const fieldType = parentNode.fieldTypeName ? schema.getType(parentNode.fieldTypeName) : null;
    if (!fieldType || !(fieldType instanceof GraphQLUnionType)) return [];

    const prefix = tsSource.slice(result.branch.typeNameSpan.start, offset);
    return fieldType
      .getTypes()
      .filter((member) => member.name.startsWith(prefix))
      .map((member) => ({
        label: member.name,
        kind: CompletionItemKind.Class,
        detail: `member of ${parentNode.fieldTypeName}`,
      }));
  }

  return [];
};

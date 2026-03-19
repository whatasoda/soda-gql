/**
 * Hover handler for callback builder field tree nodes.
 * Provides field type information on hover.
 * @module
 */

import type { Hover } from "vscode-languageserver-types";
import type { TypedFieldTree } from "../field-tree-resolver";
import { findNodeAtOffset } from "../field-tree-resolver";

export type HandleFieldTreeHoverInput = {
  readonly fieldTree: TypedFieldTree;
  readonly tsSource: string;
  /** Character offset in the TS source file. */
  readonly offset: number;
};

/** Handle a hover request for a callback builder field tree node. */
export const handleFieldTreeHover = (input: HandleFieldTreeHoverInput): Hover | null => {
  const { fieldTree, offset } = input;
  const result = findNodeAtOffset(fieldTree, offset);

  if (!result || result.kind !== "field") return null;

  const { node } = result;
  if (!node.fieldTypeName) return null;

  return {
    contents: { kind: "markdown", value: `${node.fieldName}: ${node.fieldTypeName}` },
  };
};

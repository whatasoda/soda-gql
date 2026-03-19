/**
 * Diagnostics handler for callback builder field tree nodes.
 * Reports unknown fields and invalid union member types.
 * @module
 */

import { DiagnosticSeverity, type Diagnostic } from "vscode-languageserver-types";
import type { TypedFieldNested, TypedFieldNode, TypedFieldTree } from "../field-tree-resolver";
import { computeLineOffsets, offsetToPosition } from "../position-mapping";

export type ComputeFieldTreeDiagnosticsInput = {
  readonly fieldTree: TypedFieldTree;
  readonly tsSource: string;
};

/** Compute LSP diagnostics for a callback builder field tree. */
export const computeFieldTreeDiagnostics = (input: ComputeFieldTreeDiagnosticsInput): readonly Diagnostic[] => {
  const { fieldTree, tsSource } = input;
  const lineOffsets = computeLineOffsets(tsSource);
  const diagnostics: Diagnostic[] = [];

  const walkNodes = (nodes: readonly TypedFieldNode[]): void => {
    for (const node of nodes) {
      if (node.fieldTypeName === null) {
        const start = offsetToPosition(lineOffsets, node.fieldNameSpan.start);
        const end = offsetToPosition(lineOffsets, node.fieldNameSpan.end);
        diagnostics.push({
          range: { start, end },
          message: `Unknown field "${node.fieldName}" on type "${node.parentTypeName}"`,
          severity: DiagnosticSeverity.Error,
          source: "soda-gql",
        });
      }
      if (node.nested) {
        walkNested(node.nested);
      }
    }
  };

  const walkNested = (nested: TypedFieldNested): void => {
    if (nested.kind === "object") {
      walkNodes(nested.children);
    } else {
      for (const branch of nested.branches) {
        if (!branch.valid) {
          const start = offsetToPosition(lineOffsets, branch.typeNameSpan.start);
          const end = offsetToPosition(lineOffsets, branch.typeNameSpan.end);
          diagnostics.push({
            range: { start, end },
            message: `Type "${branch.typeName}" is not a member of union type`,
            severity: DiagnosticSeverity.Error,
            source: "soda-gql",
          });
        }
        walkNodes(branch.children);
      }
    }
  };

  walkNodes(fieldTree.children);
  return diagnostics;
};

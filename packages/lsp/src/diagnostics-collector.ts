/**
 * Shared diagnostics collection logic used by LSP server and CLI.
 * @module
 */

import type { Diagnostic } from "vscode-languageserver-types";
import type { ConfigContext } from "./config-registry";
import { resolveFieldTree } from "./field-tree-resolver";
import { computeTemplateDiagnostics } from "./handlers/diagnostics";
import { computeFieldTreeDiagnostics } from "./handlers/field-tree-diagnostics";
import type { DocumentState } from "./types";

/** Collect all diagnostics (template + field tree) for a document state. */
export const collectRawDiagnostics = (state: DocumentState, ctx: ConfigContext): readonly Diagnostic[] => {
  const templateDiagnostics = state.templates.flatMap((template) => {
    const entry = ctx.schemaResolver.getSchema(template.schemaName);
    if (!entry) {
      return [];
    }
    const externalFragments = ctx.documentManager.getExternalFragments(state.uri, template.schemaName).map((f) => f.definition);
    return [...computeTemplateDiagnostics({ template, schema: entry.schema, tsSource: state.source, externalFragments })];
  });

  const fieldTreeDiagnostics = state.fieldTrees.flatMap((tree) => {
    const entry = ctx.schemaResolver.getSchema(tree.schemaName);
    if (!entry) {
      return [];
    }
    const typedTree = resolveFieldTree(tree, entry.schema);
    if (!typedTree) {
      return [];
    }
    return [...computeFieldTreeDiagnostics({ fieldTree: typedTree, tsSource: state.source })];
  });

  return [...templateDiagnostics, ...fieldTreeDiagnostics];
};

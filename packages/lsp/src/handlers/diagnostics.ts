/**
 * Diagnostics handler: validates GraphQL templates against schema.
 * @module
 */

import type { GraphQLSchema } from "graphql";
import { getDiagnostics } from "graphql-language-service";
import type { Diagnostic } from "vscode-languageserver-types";
import { preprocessFragmentArgs } from "../fragment-args-preprocessor";
import { createPositionMapper } from "../position-mapping";
import type { ExtractedTemplate } from "../types";

export type ComputeDiagnosticsInput = {
  readonly template: ExtractedTemplate;
  readonly schema: GraphQLSchema;
  readonly tsSource: string;
};

/** Compute LSP diagnostics for a single GraphQL template. */
export const computeTemplateDiagnostics = (input: ComputeDiagnosticsInput): readonly Diagnostic[] => {
  const { template, schema, tsSource } = input;
  const { preprocessed } = preprocessFragmentArgs(template.content);

  const mapper = createPositionMapper({
    tsSource,
    contentStartOffset: template.contentRange.start,
    graphqlContent: template.content,
  });

  // getDiagnostics returns Diagnostic[] with graphql-content-relative positions
  const gqlDiagnostics = getDiagnostics(preprocessed, schema);

  return gqlDiagnostics.map((diag): Diagnostic => {
    // Map GraphQL positions to TS file positions
    const startTs = mapper.graphqlToTs({
      line: diag.range.start.line,
      character: diag.range.start.character,
    });
    const endTs = mapper.graphqlToTs({
      line: diag.range.end.line,
      character: diag.range.end.character,
    });

    return {
      range: {
        start: { line: startTs.line, character: startTs.character },
        end: { line: endTs.line, character: endTs.character },
      },
      message: diag.message,
      severity: diag.severity,
      source: "soda-gql",
    };
  });
};

/**
 * Diagnostics handler: validates GraphQL templates against schema.
 * @module
 */

import type { FragmentDefinitionNode, GraphQLSchema } from "graphql";
import { getDiagnostics } from "graphql-language-service";
import type { Diagnostic } from "vscode-languageserver-types";
import { preprocessFragmentArgs } from "../fragment-args-preprocessor";
import { createPositionMapper } from "../position-mapping";
import type { ExtractedTemplate } from "../types";

export type ComputeDiagnosticsInput = {
  readonly template: ExtractedTemplate;
  readonly schema: GraphQLSchema;
  readonly tsSource: string;
  /** External fragment definitions for cross-file resolution. */
  readonly externalFragments?: readonly FragmentDefinitionNode[];
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
  const gqlDiagnostics = getDiagnostics(
    preprocessed,
    schema,
    undefined,
    undefined,
    input.externalFragments as FragmentDefinitionNode[] | undefined,
  );

  // Pattern to detect interpolation placeholder fragments
  const placeholderPattern = /__FRAG_SPREAD_\d+__/;

  return gqlDiagnostics
    .filter((diag) => {
      // Suppress diagnostics about placeholder fragments (from interpolation)
      // These are not real fragment references and will be resolved at runtime
      if (placeholderPattern.test(diag.message)) {
        return false;
      }
      return true;
    })
    .map((diag): Diagnostic => {
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

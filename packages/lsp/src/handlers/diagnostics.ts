/**
 * Diagnostics handler: validates GraphQL templates against schema.
 * @module
 */

import type { FragmentDefinitionNode, GraphQLSchema } from "graphql";
import { getDiagnostics } from "graphql-language-service";
import type { Diagnostic } from "vscode-languageserver-types";
import { reconstructGraphql } from "../document-manager";
import { preprocessFragmentArgs } from "../fragment-args-preprocessor";
import { computeLineOffsets, createPositionMapper, offsetToPosition, positionToOffset } from "../position-mapping";
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
  const reconstructed = reconstructGraphql(template);
  const headerLen = reconstructed.length - template.content.length;
  const { preprocessed } = preprocessFragmentArgs(reconstructed);

  const mapper = createPositionMapper({
    tsSource,
    contentStartOffset: template.contentRange.start,
    graphqlContent: template.content,
  });

  // getDiagnostics returns positions relative to the reconstructed source
  const gqlDiagnostics = getDiagnostics(
    preprocessed,
    schema,
    undefined,
    undefined,
    input.externalFragments as FragmentDefinitionNode[] | undefined,
  );

  // Pattern to detect interpolation placeholder fragments
  const placeholderPattern = /__FRAG_SPREAD_\d+__/;

  // Convert position from reconstructed source to template content
  const reconstructedLineOffsets = computeLineOffsets(preprocessed);
  const contentLineOffsets = computeLineOffsets(template.content);
  const toContentPosition = (pos: { line: number; character: number }) => {
    const offset = positionToOffset(reconstructedLineOffsets, pos);
    const contentOffset = Math.max(0, offset - headerLen);
    return offsetToPosition(contentLineOffsets, contentOffset);
  };

  return gqlDiagnostics
    .filter((diag) => {
      // Suppress diagnostics about placeholder fragments (from interpolation)
      if (placeholderPattern.test(diag.message)) {
        return false;
      }
      // Suppress diagnostics that point into the synthesized header
      const offset = positionToOffset(reconstructedLineOffsets, diag.range.start);
      if (offset < headerLen) {
        return false;
      }
      return true;
    })
    .map((diag): Diagnostic => {
      // Convert from reconstructed space to content space, then to TS space
      const startContent = toContentPosition(diag.range.start);
      const endContent = toContentPosition(diag.range.end);
      const startTs = mapper.graphqlToTs(startContent);
      const endTs = mapper.graphqlToTs(endContent);

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

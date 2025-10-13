import { err, ok, type Result } from "neverthrow";
import type { BuilderError } from "../types";
import { aggregate } from "./aggregate";
import { checkIssues } from "./issue-handler";
import type { BuildArtifactInput, BuilderArtifact } from "./types";

export const buildArtifact = async ({
  elements,
  analyses,
  stats: cache,
}: BuildArtifactInput): Promise<Result<BuilderArtifact, BuilderError>> => {
  const issuesResult = checkIssues({ elements });
  if (issuesResult.isErr()) {
    return err(issuesResult.error);
  }

  const warnings = issuesResult.value;

  const aggregationResult = aggregate({ analyses, elements });
  if (aggregationResult.isErr()) {
    return err(aggregationResult.error);
  }

  return ok({
    elements: Object.fromEntries(aggregationResult.value.entries()),
    report: {
      durationMs: 0,
      warnings,
      stats: cache,
    },
  } satisfies BuilderArtifact);
};

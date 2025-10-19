import { err, ok, type Result } from "neverthrow";
import type { ModuleAnalysis } from "../ast";
import type { ModuleLoadStats } from "../discovery";
import type { BuilderError } from "../types";
import { aggregate } from "./aggregate";
import { checkIssues } from "./issue-handler";
import type { BuilderArtifact, IntermediateElements } from "./types";

type BuildArtifactInput = {
  readonly elements: IntermediateElements;
  readonly analyses: ReadonlyMap<string, ModuleAnalysis>;
  readonly stats: ModuleLoadStats;
};

export const buildArtifact = ({
  elements,
  analyses,
  stats: cache,
}: BuildArtifactInput): Result<BuilderArtifact, BuilderError> => {
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

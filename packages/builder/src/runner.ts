import { resolve } from "node:path";

import { buildArtifact } from "./artifact";
import { collectSources, detectCycles, detectDuplicates, extractProjectGraph, resolveEntryPaths } from "./discover";
import type { BuilderOptions, BuilderResult } from "./types";
import { writeArtifact } from "./writer";

export const runBuilder = (options: BuilderOptions): BuilderResult =>
  resolveEntryPaths(options.entry)
    .andThen((paths) => {
      const sources = collectSources(paths);
      const graph = extractProjectGraph(sources);

      return detectDuplicates(graph.queries)
        .andThen(() => detectCycles(graph.slices))
        .map(() => graph.queries);
    })
    .map((queries) => buildArtifact(queries))
    .andThen((artifact) => writeArtifact(resolve(options.outPath), artifact));

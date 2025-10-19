import { createHash } from "node:crypto";

import type { BuilderArtifact, BuilderArtifactElement } from "@soda-gql/builder";
import type { CanonicalId } from "@soda-gql/common";

import type { BuilderServiceController } from "./builder-service-controller";
import type {
  DevArtifactDiff,
  DevBuilderSessionEvent,
  DevBuilderSessionLike,
  DevBuilderSessionListener,
  DevBuilderSessionOptions,
  DevBuilderUpdateSource,
} from "./types";

export class DevBuilderSession implements DevBuilderSessionLike {
  private readonly controller: BuilderServiceController;
  private previousArtifact: BuilderArtifact | null;
  private previousHashes: Map<CanonicalId, string>;
  private readonly listeners = new Set<DevBuilderSessionListener>();

  constructor(options: DevBuilderSessionOptions) {
    this.controller = options.controller;
    this.previousArtifact = options.initialArtifact ?? null;
    this.previousHashes = options.initialArtifact ? hashArtifactElements(options.initialArtifact) : new Map();
  }

  subscribe(listener: DevBuilderSessionListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getLatestArtifact(): BuilderArtifact | null {
    return this.previousArtifact;
  }

  async ensureInitialBuild(): Promise<void> {
    const result = await this.controller.build();
    await this.handleResult(result, "initial");
  }

  async rebuild(): Promise<void> {
    const result = await this.controller.build();
    await this.handleResult(result, "manual");
  }

  /**
   * Trigger incremental build.
   *
   * The builder automatically detects file changes using an internal file tracker.
   * File parameters are ignored (kept for backward compatibility).
   *
   * @deprecated File change detection is now automatic. Use rebuild() instead.
   */
  async applyFileChanges(_modified?: Iterable<string> | null, _removed?: Iterable<string> | null): Promise<void> {
    const result = await this.controller.build();
    await this.handleResult(result, "incremental");
  }

  reset(): void {
    this.previousArtifact = null;
    this.previousHashes = new Map();
    this.controller.reset();
  }

  private async handleResult(result: Awaited<ReturnType<BuilderServiceController["build"]>>, source: DevBuilderUpdateSource) {
    if (result.isErr()) {
      this.emit({ type: "error", error: result.error, source });
      return;
    }

    const artifact = result.value;
    const { diff, nextHashes } = computeDiff(this.previousHashes, artifact);
    this.previousArtifact = artifact;
    this.previousHashes = nextHashes;

    this.emit({ type: "artifact", artifact, diff, source });
  }

  private emit(event: DevBuilderSessionEvent): void {
    for (const listener of Array.from(this.listeners)) {
      listener(event);
    }
  }
}

const computeDiff = (
  previousHashes: Map<CanonicalId, string>,
  artifact: BuilderArtifact,
): { diff: DevArtifactDiff; nextHashes: Map<CanonicalId, string> } => {
  const nextHashes = hashArtifactElements(artifact);
  const added: CanonicalId[] = [];
  const removed: CanonicalId[] = [];
  const updated: CanonicalId[] = [];
  const unchanged: CanonicalId[] = [];

  for (const [id, nextHash] of nextHashes) {
    const previousHash = previousHashes.get(id);
    if (previousHash === undefined) {
      added.push(id);
    } else if (previousHash !== nextHash) {
      updated.push(id);
    } else {
      unchanged.push(id);
    }
  }

  for (const id of previousHashes.keys()) {
    if (!nextHashes.has(id)) {
      removed.push(id);
    }
  }

  return {
    diff: { added, removed, updated, unchanged },
    nextHashes,
  };
};

const hashArtifactElements = (artifact: BuilderArtifact): Map<CanonicalId, string> => {
  const hashes = new Map<CanonicalId, string>();
  for (const [id, element] of Object.entries(artifact.elements)) {
    hashes.set(id as CanonicalId, hashArtifactElement(element));
  }
  return hashes;
};

const hashArtifactElement = (element: BuilderArtifactElement): string => {
  const hash = createHash("sha1");
  hash.update(element.type);
  hash.update(JSON.stringify(element.prebuild));
  return hash.digest("hex");
};

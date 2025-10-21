import type { BuilderArtifact } from "@soda-gql/builder";
import type { CanonicalId } from "@soda-gql/common";

import type { BuilderServiceController, BuilderServiceFailure } from "./builder-service-controller";

export type DevArtifactDiff = {
  readonly added: CanonicalId[];
  readonly removed: CanonicalId[];
  readonly updated: CanonicalId[];
  readonly unchanged: CanonicalId[];
};

export type DevBuilderUpdateSource = "initial" | "incremental" | "manual";

export type DevBuilderSessionSuccessEvent = {
  readonly type: "artifact";
  readonly artifact: BuilderArtifact;
  readonly diff: DevArtifactDiff;
  readonly source: DevBuilderUpdateSource;
};

export type DevBuilderSessionErrorEvent = {
  readonly type: "error";
  readonly error: BuilderServiceFailure;
  readonly source: DevBuilderUpdateSource;
};

export type DevBuilderSessionEvent = DevBuilderSessionSuccessEvent | DevBuilderSessionErrorEvent;
export type DevBuilderSessionListener = (event: DevBuilderSessionEvent) => void;

export type DevBuilderSessionOptions = {
  readonly controller: BuilderServiceController;
  readonly initialArtifact?: BuilderArtifact | null;
};

export interface DevBuilderSessionLike {
  subscribe(listener: DevBuilderSessionListener): () => void;
  getLatestArtifact(): BuilderArtifact | null;
  ensureInitialBuild(): Promise<void>;
  rebuild(): Promise<void>;
  applyFileChanges(modified?: Iterable<string> | null, removed?: Iterable<string> | null): Promise<void>;
  reset(): void;
}

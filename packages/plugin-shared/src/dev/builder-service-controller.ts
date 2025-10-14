import {
  type BuilderArtifact,
  type BuilderError,
  type BuilderService,
  type BuilderServiceConfig,
  createBuilderService,
} from "@soda-gql/builder";
import type { BuilderChangeSet } from "@soda-gql/builder/change-set";
import { err, ok, type Result } from "neverthrow";

export type BuilderServiceFailure =
  | { readonly type: "builder-error"; readonly error: BuilderError }
  | { readonly type: "unexpected-error"; readonly error: unknown };

export type BuilderServiceResult = Result<BuilderArtifact, BuilderServiceFailure>;

export interface BuilderServiceController {
  readonly initialized: boolean;
  build(): Promise<BuilderServiceResult>;
  update(changeSet: BuilderChangeSet): Promise<BuilderServiceResult>;
  reset(): void;
  getGeneration(): number;
  getCurrentArtifact(): BuilderArtifact | null;
}

export const createBuilderServiceController = (config: BuilderServiceConfig): BuilderServiceController => {
  let service: BuilderService | null = null;
  let initialized = false;
  let queue: Promise<void> = Promise.resolve();
  let generation = 0;
  let currentArtifact: BuilderArtifact | null = null;

  const ensureService = (): BuilderService => {
    if (!service) {
      service = createBuilderService(config);
    }
    return service;
  };

  const runExclusive = <T>(task: () => Promise<T>): Promise<T> => {
    const next = queue.then(task);
    queue = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  };

  const wrapOperation = async (
    operation: () => Promise<Result<BuilderArtifact, BuilderError>>,
  ): Promise<BuilderServiceResult> => {
    try {
      const result = await operation();
      if (result.isErr()) {
        return err({ type: "builder-error", error: result.error });
      }
      initialized = true;
      generation++;
      currentArtifact = result.value;
      return ok(result.value);
    } catch (error) {
      return err({ type: "unexpected-error", error });
    }
  };

  return {
    get initialized() {
      return initialized;
    },
    build: () =>
      runExclusive(() => {
        const instance = ensureService();
        return wrapOperation(() => instance.build());
      }),
    update: (changeSet) =>
      runExclusive(() => {
        const instance = ensureService();
        const run =
          initialized && typeof instance.update === "function"
            ? () => instance.update?.(changeSet) ?? instance.build()
            : () => instance.build();
        return wrapOperation(run);
      }),
    reset: () => {
      service = null;
      initialized = false;
      queue = Promise.resolve();
      generation = 0;
      currentArtifact = null;
    },
    getGeneration: () => generation,
    getCurrentArtifact: () => currentArtifact,
  };
};

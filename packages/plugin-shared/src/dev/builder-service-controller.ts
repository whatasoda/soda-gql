import {
  type BuilderArtifact,
  type BuilderError,
  type BuilderService,
  type BuilderServiceConfig,
  createBuilderService,
} from "@soda-gql/builder";
import { err, ok, type Result } from "neverthrow";

export type BuilderServiceFailure =
  | { readonly type: "builder-error"; readonly error: BuilderError }
  | { readonly type: "unexpected-error"; readonly error: unknown };

export type BuilderServiceResult = Result<BuilderArtifact, BuilderServiceFailure>;

export interface BuilderServiceController {
  readonly initialized: boolean;
  build(options?: { force?: boolean }): Promise<BuilderServiceResult>;
  reset(): void;
  getGeneration(): number;
  getCurrentArtifact(): BuilderArtifact | null;
}

export const createBuilderServiceController = (config: BuilderServiceConfig): BuilderServiceController => {
  let service: BuilderService | null = null;
  let initialized = false;
  let queue: Promise<void> = Promise.resolve();
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

  const wrapOperation = async (operation: () => Result<BuilderArtifact, BuilderError>): Promise<BuilderServiceResult> => {
    try {
      const result = operation();
      if (result.isErr()) {
        return err({ type: "builder-error", error: result.error });
      }
      initialized = true;
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
    build: (options) =>
      runExclusive(() => {
        const instance = ensureService();
        return wrapOperation(() => instance.build(options));
      }),
    reset: () => {
      service = null;
      initialized = false;
      queue = Promise.resolve();
      currentArtifact = null;
    },
    getGeneration: () => service?.getGeneration() ?? 0,
    getCurrentArtifact: () => currentArtifact,
  };
};

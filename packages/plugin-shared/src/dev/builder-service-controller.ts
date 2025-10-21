import { type BuilderArtifact, type BuilderError, type BuilderServiceConfig, createBuilderService } from "@soda-gql/builder";
import { cachedFn } from "@soda-gql/common";
import { err, ok, type Result } from "neverthrow";

export type BuilderServiceFailure =
  | { readonly type: "builder-error"; readonly error: BuilderError }
  | { readonly type: "unexpected-error"; readonly error: unknown };

export type BuilderServiceResult = Result<BuilderArtifact, BuilderServiceFailure>;

export interface BuilderServiceController {
  readonly initialized: boolean;
  build(options?: { force?: boolean }): BuilderServiceResult;
  reset(): void;
  getGeneration(): number;
  getCurrentArtifact(): BuilderArtifact | null;
}

export const createBuilderServiceController = (config: BuilderServiceConfig): BuilderServiceController => {
  let initialized = false;

  const ensureService = cachedFn(() => createBuilderService(config));

  return {
    get initialized() {
      return initialized;
    },
    build: (options) => {
      try {
        const result = ensureService().build(options);
        if (result.isErr()) {
          return err({ type: "builder-error", error: result.error });
        }
        initialized = true;
        return ok(result.value);
      } catch (error) {
        return err({ type: "unexpected-error", error });
      }
    },
    reset: () => {
      ensureService.clear();
      initialized = false;
    },
    getGeneration: () => ensureService().getGeneration(),
    getCurrentArtifact: () => ensureService().getCurrentArtifact(),
  };
};

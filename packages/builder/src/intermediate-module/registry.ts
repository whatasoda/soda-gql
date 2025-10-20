import {
  type AnyComposedOperation,
  type AnyModel,
  type AnySlice,
  ComposedOperation,
  GqlElement,
  Model,
  Slice,
} from "@soda-gql/core";
import type { IntermediateArtifactElement } from "./types";

export type IntermediateRegistry = ReturnType<typeof createIntermediateRegistry>;

type AcceptableArtifact = AnyModel | AnySlice | AnyComposedOperation;
type ArtifactModule = ArtifactRecord;
type ArtifactRecord = {
  readonly [key: string]: AcceptableArtifact | ArtifactRecord;
};

export const createIntermediateRegistry = () => {
  const modules = new Map<string, () => ArtifactModule>();
  const moduleCaches = new Map<string, ArtifactModule>();
  const elements = new Map<string, AcceptableArtifact>();

  const setModule = (filePath: string, factory: () => ArtifactModule) => {
    modules.set(filePath, () => {
      const cached = moduleCaches.get(filePath);
      if (cached) {
        return cached;
      }

      const exports = factory();

      moduleCaches.set(filePath, exports);
      return exports;
    });
  };

  const importModule = (filePath: string) => {
    const factory = modules.get(filePath);
    if (!factory) {
      throw new Error(`Module not found or yet to be registered: ${filePath}`);
    }
    return factory();
  };

  const removeModule = (filePath: string) => {
    modules.delete(filePath);
    moduleCaches.delete(filePath);
    // Remove all entries that belong to this module (canonicalId prefix is "filePath::")
    const prefix = `${filePath}::`;
    for (const canonicalId of elements.keys()) {
      if (canonicalId.startsWith(prefix)) {
        elements.delete(canonicalId);
      }
    }
  };

  const addElement = <TArtifact extends AcceptableArtifact>(canonicalId: string, factory: () => TArtifact) => {
    const builder = factory();
    GqlElement.setContext(builder, { canonicalId });
    // Don't evaluate yet - defer until all builders are registered
    elements.set(canonicalId, builder);
    return builder;
  };
  const evaluate = (): Record<string, IntermediateArtifactElement> => {
    // First, register all modules by calling their factories
    for (const mod of modules.values()) {
      mod();
    }

    // Then, evaluate all builders after registration
    for (const element of elements.values()) {
      GqlElement.evaluate(element);
    }

    // Build a single record with discriminated union entries
    const artifacts: Record<string, IntermediateArtifactElement> = {};
    for (const [canonicalId, element] of elements.entries()) {
      if (element instanceof Model) {
        artifacts[canonicalId] = { type: "model", element };
      } else if (element instanceof Slice) {
        artifacts[canonicalId] = { type: "slice", element };
      } else if (element instanceof ComposedOperation) {
        artifacts[canonicalId] = { type: "operation", element };
      }
    }

    return artifacts;
  };

  const clear = () => {
    modules.clear();
    moduleCaches.clear();
    elements.clear();
  };

  return {
    setModule,
    importModule,
    removeModule,
    addElement,
    evaluate,
    clear,
  };
};

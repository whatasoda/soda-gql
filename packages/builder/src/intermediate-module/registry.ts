import { createAsyncScheduler, createSyncScheduler, type Effect } from "@soda-gql/common";
import {
  type AnyComposedOperation,
  type AnyInlineOperation,
  type AnyModel,
  type AnySlice,
  ComposedOperation,
  GqlElement,
  InlineOperation,
  Model,
  Slice,
} from "@soda-gql/core";
import type { ModuleAnalysis } from "../ast";
import { ElementEvaluationEffect } from "../scheduler";
import type { EvaluationRequest, IntermediateArtifactElement } from "./types";

export type IntermediateRegistry = ReturnType<typeof createIntermediateRegistry>;

type AcceptableArtifact = AnyModel | AnySlice | AnyComposedOperation | AnyInlineOperation;
type ArtifactModule = ArtifactRecord;
type ArtifactRecord = {
  readonly [key: string]: AcceptableArtifact | ArtifactRecord;
};

/**
 * Generator factory type for module evaluation.
 * The generator yields EvaluationRequest when it needs to import a dependency,
 * receives the resolved module as the yield result, and returns the final ArtifactModule.
 */
type GeneratorFactory = () => Generator<EvaluationRequest, ArtifactModule, ArtifactModule>;

/**
 * Internal frame type for the evaluation stack.
 */
type EvaluationFrame = {
  readonly filePath: string;
  readonly generator: Generator<EvaluationRequest, ArtifactModule, ArtifactModule>;
  resolvedDependency?: ArtifactModule;
};

export const createIntermediateRegistry = ({ analyses }: { analyses?: Map<string, ModuleAnalysis> } = {}) => {
  const modules = new Map<string, GeneratorFactory>();
  const elements = new Map<string, AcceptableArtifact>();

  const setModule = (filePath: string, factory: GeneratorFactory) => {
    modules.set(filePath, factory);
  };

  /**
   * Creates an import request to be yielded by module generators.
   * Usage: `const { foo } = yield registry.requestImport("/path/to/module");`
   */
  const requestImport = (filePath: string): EvaluationRequest => ({
    kind: "import",
    filePath,
  });

  const addElement = <TArtifact extends AcceptableArtifact>(canonicalId: string, factory: () => TArtifact) => {
    const builder = factory();
    GqlElement.setContext(builder, { canonicalId });
    // Don't evaluate yet - defer until all builders are registered
    elements.set(canonicalId, builder);
    return builder;
  };

  /**
   * Evaluate a single module and its dependencies using trampoline.
   * Returns the cached result or evaluates and caches if not yet evaluated.
   */
  const evaluateModule = (filePath: string, evaluated: Map<string, ArtifactModule>, inProgress: Set<string>): ArtifactModule => {
    // Already evaluated - return cached
    const cached = evaluated.get(filePath);
    if (cached) {
      return cached;
    }

    const stack: EvaluationFrame[] = [];

    // Start with the requested module
    const factory = modules.get(filePath);
    if (!factory) {
      throw new Error(`Module not found or yet to be registered: ${filePath}`);
    }
    stack.push({ filePath, generator: factory() });

    // Trampoline loop - process generators without deep recursion
    let frame: EvaluationFrame | undefined;
    while ((frame = stack[stack.length - 1])) {
      // Mark as in progress (for circular dependency detection)
      inProgress.add(frame.filePath);

      // Advance the generator
      const result =
        frame.resolvedDependency !== undefined ? frame.generator.next(frame.resolvedDependency) : frame.generator.next();

      // Clear the resolved dependency after use
      frame.resolvedDependency = undefined;

      if (result.done) {
        // Generator completed - cache result and pop frame
        evaluated.set(frame.filePath, result.value);
        inProgress.delete(frame.filePath);
        stack.pop();

        // If there's a parent frame waiting for this result, provide it
        const parentFrame = stack[stack.length - 1];
        if (parentFrame) {
          parentFrame.resolvedDependency = result.value;
        }
      } else {
        // Generator yielded - it needs a dependency
        const request = result.value;

        if (request.kind === "import") {
          const depPath = request.filePath;

          // Check if already evaluated (cached)
          const depCached = evaluated.get(depPath);
          if (depCached) {
            // Provide cached result without pushing new frame
            frame.resolvedDependency = depCached;
          } else {
            // Check for circular dependency
            if (inProgress.has(depPath)) {
              // If analyses is available, check if both modules have gql definitions
              // Only throw if both import source and target have gql definitions
              if (analyses) {
                const currentAnalysis = analyses.get(frame.filePath);
                const targetAnalysis = analyses.get(depPath);
                const currentHasGql = currentAnalysis && currentAnalysis.definitions.length > 0;
                const targetHasGql = targetAnalysis && targetAnalysis.definitions.length > 0;

                if (!currentHasGql || !targetHasGql) {
                  // One or both modules have no gql definitions - allow circular import
                  frame.resolvedDependency = {};
                  continue;
                }
              }
              throw new Error(`Circular dependency detected: ${depPath}`);
            }

            // Need to evaluate dependency first
            const depFactory = modules.get(depPath);
            if (!depFactory) {
              throw new Error(`Module not found or yet to be registered: ${depPath}`);
            }

            // Push new frame for dependency
            stack.push({
              filePath: depPath,
              generator: depFactory(),
            });
          }
        }
      }
    }

    const result = evaluated.get(filePath);
    if (!result) {
      throw new Error(`Module evaluation failed: ${filePath}`);
    }
    return result;
  };

  /**
   * Build artifacts record from evaluated elements.
   */
  const buildArtifacts = (): Record<string, IntermediateArtifactElement> => {
    const artifacts: Record<string, IntermediateArtifactElement> = {};
    for (const [canonicalId, element] of elements.entries()) {
      if (element instanceof Model) {
        artifacts[canonicalId] = { type: "model", element };
      } else if (element instanceof Slice) {
        artifacts[canonicalId] = { type: "slice", element };
      } else if (element instanceof ComposedOperation) {
        artifacts[canonicalId] = { type: "operation", element };
      } else if (element instanceof InlineOperation) {
        artifacts[canonicalId] = { type: "inlineOperation", element };
      }
    }
    return artifacts;
  };

  /**
   * Generator that evaluates all elements using the effect system.
   * Supports both sync and async execution depending on the scheduler used.
   */
  function* evaluateElementsGen(): Generator<Effect<unknown>, void, unknown> {
    for (const element of elements.values()) {
      const effect = new ElementEvaluationEffect(element);
      yield effect;
    }
  }

  /**
   * Synchronous evaluation - evaluates all modules and elements synchronously.
   * Throws if any element requires async operations (e.g., async metadata factory).
   */
  const evaluate = (): Record<string, IntermediateArtifactElement> => {
    const evaluated = new Map<string, ArtifactModule>();
    const inProgress = new Set<string>();

    // Evaluate all modules (each evaluation handles its own dependencies)
    for (const filePath of modules.keys()) {
      if (!evaluated.has(filePath)) {
        evaluateModule(filePath, evaluated, inProgress);
      }
    }

    // Then, evaluate all elements using sync scheduler
    const scheduler = createSyncScheduler();
    const result = scheduler.run(() => evaluateElementsGen());

    if (result.isErr()) {
      throw new Error(`Element evaluation failed: ${result.error.message}`);
    }

    return buildArtifacts();
  };

  /**
   * Asynchronous evaluation - evaluates all modules and elements with async support.
   * Supports async metadata factories and other async operations.
   */
  const evaluateAsync = async (): Promise<Record<string, IntermediateArtifactElement>> => {
    const evaluated = new Map<string, ArtifactModule>();
    const inProgress = new Set<string>();

    // Evaluate all modules (module evaluation is synchronous - no I/O operations)
    for (const filePath of modules.keys()) {
      if (!evaluated.has(filePath)) {
        evaluateModule(filePath, evaluated, inProgress);
      }
    }

    // Then, evaluate all elements using async scheduler
    const scheduler = createAsyncScheduler();
    const result = await scheduler.run(() => evaluateElementsGen());

    if (result.isErr()) {
      throw new Error(`Element evaluation failed: ${result.error.message}`);
    }

    return buildArtifacts();
  };

  const clear = () => {
    modules.clear();
    elements.clear();
  };

  return {
    setModule,
    requestImport,
    addElement,
    evaluate,
    evaluateAsync,
    clear,
  };
};

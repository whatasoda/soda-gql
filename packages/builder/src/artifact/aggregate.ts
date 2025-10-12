import type { IntermediateArtifactElement } from "@soda-gql/core";
import { err, ok, type Result } from "neverthrow";
import type { ModuleAnalysis, ModuleDefinition } from "../ast";
import type { BuilderError } from "../types";
import type { BuilderArtifactElement } from "./types";

const canonicalToFilePath = (canonicalId: string): string => canonicalId.split("::")[0] ?? canonicalId;

const emitRegistrationError = (definition: ModuleDefinition, message: string): BuilderError => ({
  code: "RUNTIME_MODULE_LOAD_FAILED",
  filePath: canonicalToFilePath(definition.canonicalId),
  astPath: definition.astPath,
  message,
});

type AggregateInput = {
  readonly analyses: Map<string, ModuleAnalysis>;
  readonly elements: Record<string, IntermediateArtifactElement>;
};

export const aggregate = ({ analyses, elements }: AggregateInput): Result<Map<string, BuilderArtifactElement>, BuilderError> => {
  const registry = new Map<string, BuilderArtifactElement>();

  for (const analysis of analyses.values()) {
    for (const definition of analysis.definitions) {
      const element = elements[definition.canonicalId];
      if (!element) {
        const availableIds = Object.keys(elements).join(", ");
        const message = `ARTIFACT_NOT_FOUND_IN_RUNTIME_MODULE: ${definition.canonicalId}\nAvailable: ${availableIds}`;
        return err(emitRegistrationError(definition, message));
      }

      if (registry.has(definition.canonicalId)) {
        return err(emitRegistrationError(definition, `ARTIFACT_ALREADY_REGISTERED`));
      }

      if (element.type === "model") {
        registry.set(definition.canonicalId, {
          id: definition.canonicalId,
          type: "model",
          prebuild: { typename: element.element.typename },
        });
        continue;
      }

      if (element.type === "slice") {
        registry.set(definition.canonicalId, {
          id: definition.canonicalId,
          type: "slice",
          prebuild: { operationType: element.element.operationType },
        });
        continue;
      }

      if (element.type === "operation") {
        registry.set(definition.canonicalId, {
          id: definition.canonicalId,
          type: "operation",
          prebuild: {
            operationType: element.element.operationType,
            operationName: element.element.operationName,
            document: element.element.document,
            variableNames: element.element.variableNames,
            projectionPathGraph: element.element.projectionPathGraph,
          },
        });
        continue;
      }

      return err(emitRegistrationError(definition, "UNKNOWN_ARTIFACT_KIND"));
    }
  }

  return ok(registry);
};

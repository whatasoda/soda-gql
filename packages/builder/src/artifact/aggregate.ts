import { createHash } from "node:crypto";

import { err, ok, type Result } from "neverthrow";
import type { ModuleAnalysis, ModuleDefinition } from "../ast";
import type { IntermediateArtifactElement } from "../intermediate-module";
import type { BuilderError } from "../types";
import type { BuilderArtifactElement, BuilderArtifactElementMetadata } from "./types";

const canonicalToFilePath = (canonicalId: string): string => canonicalId.split("::")[0] ?? canonicalId;

const computeContentHash = (prebuild: unknown): string => {
  const hash = createHash("sha1");
  hash.update(JSON.stringify(prebuild));
  return hash.digest("hex");
};

const emitRegistrationError = (definition: ModuleDefinition, message: string): BuilderError => ({
  code: "RUNTIME_MODULE_LOAD_FAILED",
  filePath: canonicalToFilePath(definition.canonicalId),
  astPath: definition.astPath,
  message,
});

type AggregateInput = {
  readonly analyses: ReadonlyMap<string, ModuleAnalysis>;
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

      const metadata: BuilderArtifactElementMetadata = {
        sourcePath: analysis.filePath ?? canonicalToFilePath(definition.canonicalId),
        contentHash: "", // Will be computed after prebuild creation
      };

      if (element.type === "model") {
        const prebuild = { typename: element.element.typename, metadata: null };
        registry.set(definition.canonicalId, {
          id: definition.canonicalId,
          type: "model",
          prebuild,
          metadata: { ...metadata, contentHash: computeContentHash(prebuild) },
        });
        continue;
      }

      if (element.type === "operation") {
        const prebuild = {
          operationType: element.element.operationType,
          operationName: element.element.operationName,
          document: element.element.document,
          variableNames: element.element.variableNames,
          metadata: element.element.metadata,
        };
        registry.set(definition.canonicalId, {
          id: definition.canonicalId,
          type: "operation",
          prebuild,
          metadata: { ...metadata, contentHash: computeContentHash(prebuild) },
        });
        continue;
      }

      return err(emitRegistrationError(definition, "UNKNOWN_ARTIFACT_KIND"));
    }
  }

  return ok(registry);
};

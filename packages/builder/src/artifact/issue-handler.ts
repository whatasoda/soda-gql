import { err, ok, type Result } from "neverthrow";
import type { IntermediateModuleOutput } from "../internal/intermediate-module/types";
import type { BuilderError } from "../types";

const canonicalToFilePath = (canonicalId: string): string => canonicalId.split("::")[0] ?? canonicalId;

export const checkIssues = (intermediateModule: IntermediateModuleOutput): Result<string[], BuilderError> => {
  const { elements } = intermediateModule;
  const operationNames = new Set<string>();

  for (const [canonicalId, { type, element }] of Object.entries(elements)) {
    if (type !== "operation") {
      continue;
    }

    if (operationNames.has(element.operationName)) {
      const sources = [canonicalToFilePath(canonicalId)];
      return err({
        code: "DOC_DUPLICATE",
        message: `Duplicate document name: ${element.operationName}`,
        name: element.operationName,
        sources,
      });
    }

    operationNames.add(element.operationName);
  }

  return ok([]);
};

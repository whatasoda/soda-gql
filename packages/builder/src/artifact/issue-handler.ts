import { err, ok, type Result } from "neverthrow";
import type { BuilderError } from "../types";
import type { IntermediateElements } from "./types";

const canonicalToFilePath = (canonicalId: string): string => canonicalId.split("::")[0] ?? canonicalId;

export const checkIssues = ({ elements }: { elements: IntermediateElements }): Result<string[], BuilderError> => {
  const operationNames = new Set<string>();

  for (const [canonicalId, { type, element }] of Object.entries(elements)) {
    if (type !== "inlineOperation") {
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

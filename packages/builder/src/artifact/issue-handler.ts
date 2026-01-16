import { err, ok, type Result } from "neverthrow";
import type { BuilderError } from "../types";
import { extractFilePathSafe } from "./canonical-id-utils";
import type { IntermediateElements } from "./types";

export const checkIssues = ({ elements }: { elements: IntermediateElements }): Result<string[], BuilderError> => {
  const operationNames = new Set<string>();

  for (const [canonicalId, { type, element }] of Object.entries(elements)) {
    if (type !== "operation") {
      continue;
    }

    if (operationNames.has(element.operationName)) {
      // Validate canonical ID before using
      const filePathResult = extractFilePathSafe(canonicalId);
      if (filePathResult.isErr()) {
        return err(filePathResult.error);
      }

      const sources = [filePathResult.value];
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

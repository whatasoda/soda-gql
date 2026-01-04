import type { AnyOperationOf, GqlElementAttachment } from "../types/element";
import type { OperationType } from "../types/schema";
import { hidden } from "../utils/hidden";
import type { StripFunctions, StripSymbols } from "../utils/type-utils";
import { registerOperation } from "./runtime-registry";

export type RuntimeOperationInput = {
  prebuild: StripFunctions<AnyOperationOf<OperationType>>;
  /**
   * Reserved for future runtime configuration injection.
   * Currently always an empty object, but kept for forward compatibility
   * with potential features like runtime variable injection or context.
   */
  runtime: {};
};

export const createRuntimeOperation = (input: RuntimeOperationInput): AnyOperationOf<OperationType> => {
  const operation = {
    operationType: input.prebuild.operationType,
    operationName: input.prebuild.operationName,
    variableNames: input.prebuild.variableNames,
    documentSource: hidden(),
    document: input.prebuild.document,
    metadata: input.prebuild.metadata,
    attach(
      attachmentOrAttachments:
        | GqlElementAttachment<typeof operation, string, object>
        | readonly GqlElementAttachment<typeof operation, string, object>[],
    ) {
      const attachments = Array.isArray(attachmentOrAttachments)
        ? attachmentOrAttachments
        : [attachmentOrAttachments];

      for (const attachment of attachments) {
        const value = attachment.createValue(operation);

        Object.defineProperty(operation, attachment.name, {
          get() {
            return value;
          },
        });
      }

      return operation;
    },
  } satisfies StripSymbols<AnyOperationOf<OperationType>> as AnyOperationOf<OperationType>;

  registerOperation(operation);

  return operation;
};

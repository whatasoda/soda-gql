import type { Script } from "node:vm";
import type { AnyComposedOperation, AnyInlineOperation, AnyModel, AnySlice } from "@soda-gql/core";

export type IntermediateModule = {
  readonly filePath: string;
  readonly canonicalIds: readonly string[];
  readonly sourceCode: string;
  readonly transpiledCode: string;
  readonly contentHash: string;
  readonly script: Script;
};

export type IntermediateArtifactElement =
  | { readonly type: "model"; readonly element: AnyModel }
  | { readonly type: "slice"; readonly element: AnySlice }
  | { readonly type: "operation"; readonly element: AnyComposedOperation }
  | { readonly type: "inlineOperation"; readonly element: AnyInlineOperation };

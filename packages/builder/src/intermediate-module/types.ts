import type { Script } from "node:vm";
import type { AnyFragment, AnyGqlDefine, AnyOperation } from "@soda-gql/core";

/**
 * Request type yielded by module generators to import dependencies.
 */
export type EvaluationRequest = {
  readonly kind: "import";
  readonly filePath: string;
};

export type IntermediateModule = {
  readonly filePath: string;
  readonly canonicalIds: readonly string[];
  readonly sourceCode: string;
  readonly transpiledCode: string;
  readonly contentHash: string;
  readonly script: Script;
};

export type IntermediateArtifactElement =
  | { readonly type: "fragment"; readonly element: AnyFragment }
  | { readonly type: "operation"; readonly element: AnyOperation }
  | { readonly type: "define"; readonly element: AnyGqlDefine };

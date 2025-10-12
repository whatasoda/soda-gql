import type { Script } from "node:vm";
import type { CanonicalId } from "@soda-gql/common";

export type IntermediateModule = {
  readonly filePath: string;
  readonly contentHash: string;
  readonly canonicalIds: readonly CanonicalId[];
  readonly sourceCode: string;
  readonly transpiledCode: string;
  readonly script: Script;
};

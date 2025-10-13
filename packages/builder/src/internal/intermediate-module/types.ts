import type { Script } from "node:vm";

export type IntermediateModule = {
  readonly filePath: string;
  readonly canonicalIds: readonly string[];
  readonly sourceCode: string;
  readonly transpiledCode: string;
  readonly contentHash: string;
  readonly script: Script;
};

import type { Script } from "node:vm";

export type IntermediateModule = {
  readonly filePath: string;
  readonly sourceCode: string;
  readonly transpiledCode: string;
  readonly script: Script;
};

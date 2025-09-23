import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { err, ok } from "neverthrow";

import type { CodegenError } from "./types";

const templateContents = `import { define, type, type GraphqlAdapter } from "@soda-gql/core";

export const scalar = {
  ...define("ID").scalar(type<{ input: string; output: string }>(), {}),
  ...define("String").scalar(type<{ input: string; output: string }>(), {}),
  ...define("Int").scalar(type<{ input: number; output: number }>(), {}),
  ...define("Float").scalar(type<{ input: number; output: number }>(), {}),
  ...define("Boolean").scalar(type<{ input: boolean; output: boolean }>(), {}),
} as const;

const createError: GraphqlAdapter["createError"] = (raw) => raw;

export const adapter = {
  createError,
} satisfies GraphqlAdapter;
`;

export const writeInjectTemplate = (outPath: string) => {
  const targetPath = resolve(outPath);

  try {
    if (existsSync(targetPath)) {
      return err<void, CodegenError>({
        code: "INJECT_TEMPLATE_EXISTS",
        message: `Inject module already exists: ${targetPath}`,
        outPath: targetPath,
      });
    }

    mkdirSync(dirname(targetPath), { recursive: true });
    writeFileSync(targetPath, `${templateContents}\n`);
    return ok<void, CodegenError>(undefined);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return err<void, CodegenError>({
      code: "INJECT_TEMPLATE_FAILED",
      message,
      outPath: targetPath,
    });
  }
};

export const getInjectTemplate = (): string => `${templateContents}\n`;

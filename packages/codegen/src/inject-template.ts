import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { err, ok } from "neverthrow";

import type { CodegenError } from "./types";

const templateContents = `\
import { defineScalar } from "@soda-gql/core";

export const scalar = {
  ...defineScalar<"ID", string, string>("ID"),
  ...defineScalar<"String", string, string>("String"),
  ...defineScalar<"Int", number, number>("Int"),
  ...defineScalar<"Float", number, number>("Float"),
  ...defineScalar<"Boolean", boolean, boolean>("Boolean"),
} as const;
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

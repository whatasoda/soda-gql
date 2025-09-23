import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { err, ok } from "neverthrow";

import type { CodegenError } from "./types";

const templateContents = `\
import { defineScalar, type GraphqlAdapter } from "@soda-gql/core";

export const scalar = {
  ...defineScalar("ID", ({ type }) => ({
    input: type<string>(),
    output: type<string>(),
    directives: {},
  })),
  ...defineScalar("String", ({ type }) => ({
    input: type<string>(),
    output: type<string>(),
    directives: {},
  })),
  ...defineScalar("Int", ({ type }) => ({
    input: type<number>(),
    output: type<number>(),
    directives: {},
  })),
  ...defineScalar("Float", ({ type }) => ({
    input: type<number>(),
    output: type<number>(),
    directives: {},
  })),
  ...defineScalar("Boolean", ({ type }) => ({
    input: type<boolean>(),
    output: type<boolean>(),
    directives: {},
  })),
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

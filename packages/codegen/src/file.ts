import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { err, ok } from "neverthrow";

import type { CodegenError } from "./types";

export const removeDirectory = (dirPath: string) => {
  const targetPath = resolve(dirPath);
  try {
    rmSync(targetPath, { recursive: true, force: true });
    return ok<void, CodegenError>(undefined);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return err<void, CodegenError>({
      code: "REMOVE_FAILED",
      message,
      outPath: targetPath,
    });
  }
};

export const readModule = (filePath: string) => {
  const targetPath = resolve(filePath);
  try {
    const content = readFileSync(targetPath, "utf-8");
    return ok<string, CodegenError>(content);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return err<string, CodegenError>({
      code: "READ_FAILED",
      message,
      outPath: targetPath,
    });
  }
};

export const writeModule = (outPath: string, contents: string) => {
  const targetPath = resolve(outPath);

  try {
    mkdirSync(dirname(targetPath), { recursive: true });
    writeFileSync(targetPath, contents);
    return ok<void, CodegenError>(undefined);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return err<void, CodegenError>({
      code: "EMIT_FAILED",
      message,
      outPath: targetPath,
    });
  }
};

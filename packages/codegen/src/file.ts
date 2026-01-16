import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { err, ok } from "neverthrow";

import type { CodegenError } from "./types";

export const ensureDirectory = (dirPath: string) => {
  try {
    mkdirSync(resolve(dirPath), { recursive: true });
    return ok<void, CodegenError>(undefined);
  } catch (error) {
    return err<void, CodegenError>({
      code: "EMIT_FAILED",
      message: error instanceof Error ? error.message : String(error),
      outPath: dirPath,
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

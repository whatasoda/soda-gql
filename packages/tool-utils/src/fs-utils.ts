import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { err, ok, type Result } from "neverthrow";

export type FileSystemError = {
  type: "FileSystemError";
  operation: "read" | "write" | "mkdir" | "exists";
  path: string;
  message: string;
};

export async function ensureDir(dirPath: string): Promise<Result<void, FileSystemError>> {
  try {
    await mkdir(dirPath, { recursive: true });
    return ok(undefined);
  } catch (error) {
    return err({
      type: "FileSystemError",
      operation: "mkdir",
      path: dirPath,
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

export async function readTextFile(filePath: string): Promise<Result<string, FileSystemError>> {
  try {
    const content = await readFile(filePath, "utf-8");
    return ok(content);
  } catch (error) {
    return err({
      type: "FileSystemError",
      operation: "read",
      path: filePath,
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

export async function writeTextFile(filePath: string, content: string): Promise<Result<void, FileSystemError>> {
  try {
    const dir = dirname(filePath);
    await mkdir(dir, { recursive: true });
    await writeFile(filePath, content, "utf-8");
    return ok(undefined);
  } catch (error) {
    return err({
      type: "FileSystemError",
      operation: "write",
      path: filePath,
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

export async function fileExists(filePath: string): Promise<Result<boolean, FileSystemError>> {
  try {
    await access(filePath);
    return ok(true);
  } catch {
    return ok(false);
  }
}

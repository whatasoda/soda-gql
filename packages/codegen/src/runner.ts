import { existsSync } from "node:fs";
import { basename, dirname, relative, resolve } from "node:path";
import { err } from "neverthrow";
import { writeModule } from "./file";
import { generateRuntimeModule } from "./generator";
import { hashSchema, loadSchema } from "./schema";
import type { CodegenError, CodegenOptions, CodegenResult, CodegenSuccess } from "./types";

const toImportSpecifier = (fromPath: string, targetPath: string): string => {
  const fromDir = dirname(fromPath);
  const raw = relative(fromDir, targetPath);
  const normalized = raw.replace(/\\/g, "/");
  const stripExtension = (value: string): string => value.replace(/\.(?:ts|tsx)$/u, "");

  if (normalized.length === 0) {
    return `./${stripExtension(basename(targetPath))}`;
  }

  const sanitized = stripExtension(normalized);
  return sanitized.startsWith(".") ? sanitized : `./${sanitized}`;
};

export const runCodegen = (options: CodegenOptions): CodegenResult =>
  loadSchema(options.schemaPath).andThen((document) => {
    if (!existsSync(options.injectFromPath)) {
      return err<CodegenSuccess, CodegenError>({
        code: "INJECT_MODULE_NOT_FOUND",
        message: `Inject module not found: ${options.injectFromPath}`,
        injectPath: options.injectFromPath,
      });
    }

    const outPath = resolve(options.outPath);
    const injectPath = resolve(options.injectFromPath);
    const importPath = toImportSpecifier(outPath, injectPath);

    const { code, stats } = generateRuntimeModule(document, {
      injection: {
        importPath,
      },
    });

    const schemaHash = hashSchema(document);

    return writeModule(outPath, code).map(
      () =>
        ({
          schemaHash,
          outPath,
          ...stats,
        }) satisfies CodegenSuccess,
    );
  });

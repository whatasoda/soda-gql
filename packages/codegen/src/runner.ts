import { resolve } from "node:path";
import { writeModule } from "./file";
import { generateRuntimeModule } from "./generator";
import { hashSchema, loadSchema } from "./schema";
import type { CodegenOptions, CodegenResult, CodegenSuccess } from "./types";

export const runCodegen = (options: CodegenOptions): CodegenResult =>
  loadSchema(options.schemaPath).andThen((document) => {
    const { code, stats } = generateRuntimeModule(document);
    const outPath = resolve(options.outPath);
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

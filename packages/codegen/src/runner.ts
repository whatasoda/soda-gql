import { resolve } from "node:path";
import { writeModule } from "./file";
import { generateRuntimeModule } from "./generator";
import { hashSchema, loadSchema } from "./schema";
import type { CodegenOptions, CodegenResult, CodegenSuccess } from "./types";

export const runCodegen = (options: CodegenOptions): CodegenResult =>
  loadSchema(options.schemaPath).andThen((schema) => {
    const { code, stats } = generateRuntimeModule(schema);
    const outPath = resolve(options.outPath);
    const schemaHash = hashSchema(schema);

    return writeModule(outPath, code).map(
      () =>
        ({
          schemaHash,
          outPath,
          ...stats,
        }) satisfies CodegenSuccess,
    );
  });

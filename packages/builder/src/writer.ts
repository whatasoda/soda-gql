import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { err, ok } from "neverthrow";
import type { BuilderArtifact } from "./artifact/types";
import type { BuilderError, BuilderResult, BuilderSuccess } from "./types";

export const writeArtifact = (outPath: string, artifact: BuilderArtifact): BuilderResult => {
  const targetPath = resolve(outPath);

  try {
    mkdirSync(dirname(targetPath), { recursive: true });
    writeFileSync(targetPath, JSON.stringify(artifact, null, 2));

    return ok<BuilderSuccess, BuilderError>({
      artifact,
      outPath: targetPath,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return err<BuilderSuccess, BuilderError>({
      code: "WRITE_FAILED",
      message,
      outPath: targetPath,
    });
  }
};

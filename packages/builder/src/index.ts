#!/usr/bin/env bun
import { runBuilderCli } from "./cli";

export { runBuilderCli } from "./cli";
export type { CanonicalId } from "./registry";
export { createCanonicalId, createDocumentRegistry } from "./registry";
export { runBuilder } from "./runner";
export { createRuntimeBindingName, createRuntimeDocumentName } from "./runtime-names";
export type {
  BuilderArtifact,
  BuilderError,
  BuilderFormat,
  BuilderMode,
  BuilderOptions,
  BuilderResult,
  BuilderSuccess,
} from "./types";

if (import.meta.main) {
  runBuilderCli(Bun.argv.slice(2))
    .then((exitCode) => {
      process.exit(exitCode);
    })
    .catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`${message}\n`);
      process.exit(1);
    });
}

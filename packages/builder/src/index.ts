#!/usr/bin/env bun
import { runBuilderCli } from "./cli";

export { runBuilderCli } from "./cli";
export type { CanonicalId } from "./registry";
export { createCanonicalId, createDocumentRegistry } from "./registry";
export { runBuilder } from "./runner";
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
  const exitCode = runBuilderCli(Bun.argv.slice(2));
  process.exit(exitCode);
}

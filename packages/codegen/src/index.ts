#!/usr/bin/env bun
import { runCodegenCli } from "./cli";

export { runCodegenCli } from "./cli";
export { runCodegen } from "./runner";
export type { CodegenError, CodegenFormat, CodegenOptions, CodegenResult, CodegenSuccess } from "./types";

if (import.meta.main) {
  const exitCode = runCodegenCli(Bun.argv.slice(2));
  process.exit(exitCode);
}

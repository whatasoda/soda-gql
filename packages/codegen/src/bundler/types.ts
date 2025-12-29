import type { Result } from "neverthrow";
import type { CodegenError } from "../types";

export type BundleOptions = {
  readonly sourcePath: string;
  readonly external: readonly string[];
};

export type BundleResult = {
  readonly cjsPath: string;
};

export type Bundler = {
  readonly name: string;
  readonly bundle: (options: BundleOptions) => Promise<Result<BundleResult, CodegenError>>;
};

export type SodaGqlBabelOptions = {
  readonly mode: "runtime" | "zero-runtime";
  readonly artifactsPath: string;
  readonly importIdentifier?: string;
  readonly diagnostics?: "json" | "console";
};

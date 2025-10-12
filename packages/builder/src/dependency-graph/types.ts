export type DependencyGraphError = {
  readonly code: "MISSING_IMPORT";
  readonly chain: readonly [importingFile: string, importSpecifier: string];
};

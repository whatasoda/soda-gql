export type FormatOptions = {
  readonly sourceCode: string;
  readonly filePath?: string;
};

export type FormatResult = {
  readonly modified: boolean;
  readonly sourceCode: string;
};

export type FormatError = {
  readonly type: "FormatError";
  readonly code: "PARSE_ERROR" | "TRANSFORM_ERROR";
  readonly message: string;
  readonly cause?: unknown;
};

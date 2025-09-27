export const formatters = {
  json: (data: unknown) => JSON.stringify(data, null, 2),
  human: (data: unknown) => {
    if (typeof data === "string") return data;
    if (data instanceof Error) return data.message;
    return JSON.stringify(data, null, 2);
  },
} as const;

export type OutputFormat = keyof typeof formatters;

export const formatOutput = (data: unknown, format: OutputFormat = "human"): string => {
  return formatters[format](data);
};

export const formatError = (error: unknown, format: OutputFormat = "human"): string => {
  if (format === "json") {
    return JSON.stringify(
      {
        error: error,
      },
      null,
      2,
    );
  }
  return error instanceof Error ? error.message : String(error);
};

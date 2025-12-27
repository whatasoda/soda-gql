import { access, readFile, writeFile } from "node:fs/promises";
import fg from "fast-glob";
import { FormatArgsSchema } from "../schemas/args";
import { parseArgs } from "../utils/parse-args";

type FormatterModule = typeof import("@soda-gql/formatter");

const loadFormatter = async (): Promise<FormatterModule | null> => {
  try {
    return await import("@soda-gql/formatter");
  } catch {
    return null;
  }
};

type FormatError = {
  code: "PARSE_ERROR" | "NO_PATTERNS" | "FORMAT_ERROR" | "FORMATTER_NOT_INSTALLED";
  message: string;
};

type FormatResult = {
  mode: "format" | "check";
  total: number;
  modified: number;
  unchanged: number;
  errors: number;
  unformatted: string[];
};

const formatFormatError = (error: FormatError): string => {
  return `${error.code}: ${error.message}`;
};

const formatResult = (result: FormatResult): string => {
  if (result.mode === "check") {
    if (result.unformatted.length > 0) {
      const files = result.unformatted.map((f) => `  ${f}`).join("\n");
      return `${result.unformatted.length} file(s) need formatting:\n${files}`;
    }
    return `All ${result.total} file(s) are properly formatted`;
  }

  const parts: string[] = [];
  if (result.modified > 0) {
    parts.push(`${result.modified} formatted`);
  }
  if (result.unchanged > 0) {
    parts.push(`${result.unchanged} unchanged`);
  }
  if (result.errors > 0) {
    parts.push(`${result.errors} errors`);
  }
  return `${result.total} file(s) checked: ${parts.join(", ")}`;
};

const isGlobPattern = (pattern: string): boolean => {
  return /[*?[\]{}]/.test(pattern);
};

const expandGlobPatterns = async (patterns: readonly string[]): Promise<string[]> => {
  const files: string[] = [];

  for (const pattern of patterns) {
    if (!isGlobPattern(pattern)) {
      // Direct file path - check if it exists
      try {
        await access(pattern);
        files.push(pattern);
      } catch {
        // File doesn't exist, skip it
      }
      continue;
    }

    // Glob pattern - use fast-glob
    const matches = await fg(pattern, { absolute: true });
    files.push(...matches);
  }

  return [...new Set(files)];
};

const FORMAT_HELP = `Usage: soda-gql format <patterns...> [options]

Format soda-gql field selections by inserting empty comments.

Options:
  --check     Check if files need formatting (exit 1 if unformatted)
  --help, -h  Show this help message

Examples:
  soda-gql format "src/**/*.ts"
  soda-gql format "src/**/*.ts" --check
  soda-gql format "src/**/*.ts" "lib/**/*.tsx"
`;

export const formatCommand = async (argv: readonly string[]): Promise<number> => {
  if (argv.includes("--help") || argv.includes("-h")) {
    process.stdout.write(FORMAT_HELP);
    return 0;
  }

  const parsed = parseArgs([...argv], FormatArgsSchema);

  if (!parsed.isOk()) {
    const error: FormatError = {
      code: "PARSE_ERROR",
      message: parsed.error,
    };
    process.stderr.write(`${formatFormatError(error)}\n`);
    return 1;
  }

  const args = parsed.value;
  const isCheckMode = args.check === true;
  const patterns = args._ ?? [];

  if (patterns.length === 0) {
    const error: FormatError = {
      code: "NO_PATTERNS",
      message: "No file patterns provided. Usage: soda-gql format <patterns...> [--check]",
    };
    process.stderr.write(`${formatFormatError(error)}\n`);
    return 1;
  }

  // Load formatter lazily - it's an optional dependency
  const formatter = await loadFormatter();
  if (!formatter) {
    const error: FormatError = {
      code: "FORMATTER_NOT_INSTALLED",
      message: "@soda-gql/formatter is not installed. Run: npm install @soda-gql/formatter",
    };
    process.stderr.write(`${formatFormatError(error)}\n`);
    return 1;
  }

  const files = await expandGlobPatterns(patterns);

  if (files.length === 0) {
    const result: FormatResult = {
      mode: isCheckMode ? "check" : "format",
      total: 0,
      modified: 0,
      unchanged: 0,
      errors: 0,
      unformatted: [],
    };
    process.stdout.write(`${formatResult(result)}\n`);
    return 0;
  }

  let modified = 0;
  let unchanged = 0;
  let errors = 0;
  const unformatted: string[] = [];

  for (const filePath of files) {
    const sourceCode = await readFile(filePath, "utf-8");

    if (isCheckMode) {
      const result = formatter.needsFormat({ sourceCode, filePath });
      if (result.isErr()) {
        errors++;
        continue;
      }
      if (result.value) {
        unformatted.push(filePath);
        modified++;
      } else {
        unchanged++;
      }
    } else {
      const result = formatter.format({ sourceCode, filePath });
      if (result.isErr()) {
        errors++;
        continue;
      }
      if (result.value.modified) {
        await writeFile(filePath, result.value.sourceCode, "utf-8");
        modified++;
      } else {
        unchanged++;
      }
    }
  }

  const result: FormatResult = {
    mode: isCheckMode ? "check" : "format",
    total: files.length,
    modified,
    unchanged,
    errors,
    unformatted,
  };

  process.stdout.write(`${formatResult(result)}\n`);

  if (isCheckMode && unformatted.length > 0) {
    return 1;
  }

  return errors > 0 ? 1 : 0;
};

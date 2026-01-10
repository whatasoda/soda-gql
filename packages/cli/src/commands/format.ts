import { access, readFile, writeFile } from "node:fs/promises";
import { loadConfig } from "@soda-gql/config";
import fg from "fast-glob";
import { err, ok } from "neverthrow";
import { cliErrors } from "../errors";
import { FormatArgsSchema } from "../schemas/args";
import type { CommandResult, CommandSuccess } from "../types";
import { parseArgs } from "../utils/parse-args";

type FormatterModule = typeof import("@soda-gql/formatter");

const loadFormatter = async (): Promise<FormatterModule | null> => {
  try {
    return await import("@soda-gql/formatter");
  } catch {
    return null;
  }
};

type FormatData = {
  mode: "format" | "check";
  total: number;
  modified: number;
  unchanged: number;
  errors: number;
  unformatted: string[];
  hasFormattingIssues: boolean;
};

const formatResultMessage = (data: FormatData): string => {
  if (data.mode === "check") {
    if (data.unformatted.length > 0) {
      const files = data.unformatted.map((f) => `  ${f}`).join("\n");
      return `${data.unformatted.length} file(s) need formatting:\n${files}`;
    }
    return `All ${data.total} file(s) are properly formatted`;
  }

  const parts: string[] = [];
  if (data.modified > 0) {
    parts.push(`${data.modified} formatted`);
  }
  if (data.unchanged > 0) {
    parts.push(`${data.unchanged} unchanged`);
  }
  if (data.errors > 0) {
    parts.push(`${data.errors} errors`);
  }
  return `${data.total} file(s) checked: ${parts.join(", ")}`;
};

const isGlobPattern = (pattern: string): boolean => {
  return /[*?[\]{}]/.test(pattern);
};

const expandGlobPatterns = async (patterns: readonly string[], excludePatterns: readonly string[] = []): Promise<string[]> => {
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

    // Glob pattern - use fast-glob with ignore
    const matches = await fg(pattern, {
      absolute: true,
      ignore: [...excludePatterns],
    });
    files.push(...matches);
  }

  return [...new Set(files)];
};

const FORMAT_HELP = `Usage: soda-gql format [patterns...] [options]

Format soda-gql field selections by inserting empty comments.

Options:
  --config <path>         Path to soda-gql.config.ts (auto-detected if omitted)
  --check                 Check if files need formatting (exit 1 if unformatted)
  --inject-fragment-keys  Inject unique keys into anonymous fragments
  --help, -h              Show this help message

Examples:
  soda-gql format                           # Use config include/exclude
  soda-gql format "src/**/*.ts"             # Override with explicit patterns
  soda-gql format --check                   # Check mode with config
  soda-gql format --inject-fragment-keys    # Inject fragment keys
`;

type FormatCommandResult = CommandResult<CommandSuccess & { data?: FormatData }>;

export const formatCommand = async (argv: readonly string[]): Promise<FormatCommandResult> => {
  if (argv.includes("--help") || argv.includes("-h")) {
    return ok({ message: FORMAT_HELP });
  }

  const parsed = parseArgs([...argv], FormatArgsSchema);

  if (!parsed.isOk()) {
    return err(cliErrors.argsInvalid("format", parsed.error));
  }

  const args = parsed.value;
  const isCheckMode = args.check === true;
  const injectFragmentKeys = args["inject-fragment-keys"] === true;
  const explicitPatterns = args._ ?? [];

  // Determine patterns: use explicit patterns or load from config
  let targetPatterns: readonly string[];
  let excludePatterns: readonly string[] = [];

  if (explicitPatterns.length > 0) {
    targetPatterns = explicitPatterns;
  } else {
    // Try to load patterns from config
    const configResult = loadConfig(args.config);
    if (configResult.isErr()) {
      return err(cliErrors.noPatterns());
    }
    targetPatterns = configResult.value.include;
    excludePatterns = configResult.value.exclude;
  }

  // Load formatter lazily - it's an optional dependency
  const formatter = await loadFormatter();
  if (!formatter) {
    return err(cliErrors.formatterNotInstalled());
  }

  const files = await expandGlobPatterns(targetPatterns, excludePatterns);

  if (files.length === 0) {
    const data: FormatData = {
      mode: isCheckMode ? "check" : "format",
      total: 0,
      modified: 0,
      unchanged: 0,
      errors: 0,
      unformatted: [],
      hasFormattingIssues: false,
    };
    return ok({ message: formatResultMessage(data), data });
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
      const result = formatter.format({ sourceCode, filePath, injectFragmentKeys });
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

  const data: FormatData = {
    mode: isCheckMode ? "check" : "format",
    total: files.length,
    modified,
    unchanged,
    errors,
    unformatted,
    hasFormattingIssues: (isCheckMode && unformatted.length > 0) || errors > 0,
  };

  return ok({ message: formatResultMessage(data), data });
};

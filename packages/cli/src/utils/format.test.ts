import { describe, expect, it } from "bun:test";
import { cliErrors } from "../errors";
import { formatCliError, formatCliErrorHuman, formatCliErrorJson, formatError, formatOutput } from "./format";

describe("formatCliErrorHuman", () => {
  describe("CLI-specific errors", () => {
    it("formats CLI_UNKNOWN_COMMAND with hint", () => {
      const error = cliErrors.unknownCommand("foobar");
      const result = formatCliErrorHuman(error);

      expect(result).toContain("Error [CLI_UNKNOWN_COMMAND]");
      expect(result).toContain("Unknown command: foobar");
      expect(result).toContain("Hint:");
      expect(result).toContain("soda-gql --help");
    });

    it("formats CLI_ARGS_INVALID with command context", () => {
      const error = cliErrors.argsInvalid("codegen", "Missing required flag");
      const result = formatCliErrorHuman(error);

      expect(result).toContain("Error [CLI_ARGS_INVALID]");
      expect(result).toContain("Missing required flag");
      expect(result).toContain("Command: codegen");
      expect(result).toContain("Hint:");
    });

    it("formats CLI_FILE_EXISTS with file path", () => {
      const error = cliErrors.fileExists("/path/to/file.ts");
      const result = formatCliErrorHuman(error);

      expect(result).toContain("Error [CLI_FILE_EXISTS]");
      expect(result).toContain("File: /path/to/file.ts");
      expect(result).toContain("Hint:");
      expect(result).toContain("--force");
    });

    it("formats CLI_UNKNOWN_SUBCOMMAND with parent context", () => {
      const error = cliErrors.unknownSubcommand("artifact", "unknown");
      const result = formatCliErrorHuman(error);

      expect(result).toContain("Error [CLI_UNKNOWN_SUBCOMMAND]");
      expect(result).toContain("Parent: artifact");
      expect(result).toContain("Hint:");
    });

    it("formats CLI_NO_PATTERNS with hint", () => {
      const error = cliErrors.noPatterns();
      const result = formatCliErrorHuman(error);

      expect(result).toContain("Error [CLI_NO_PATTERNS]");
      expect(result).toContain("Hint:");
      expect(result).toContain("soda-gql.config.ts");
    });

    it("formats CLI_FORMATTER_NOT_INSTALLED with install hint", () => {
      const error = cliErrors.formatterNotInstalled();
      const result = formatCliErrorHuman(error);

      expect(result).toContain("Error [CLI_FORMATTER_NOT_INSTALLED]");
      expect(result).toContain("Hint:");
      expect(result).toContain("bun add");
    });

    it("formats CLI_UNEXPECTED with report hint", () => {
      const error = cliErrors.unexpected("Something went wrong");
      const result = formatCliErrorHuman(error);

      expect(result).toContain("Error [CLI_UNEXPECTED]");
      expect(result).toContain("Hint:");
      expect(result).toContain("github.com");
    });
  });

  describe("wrapped codegen errors", () => {
    it("formats SCHEMA_NOT_FOUND with schema path and hint", () => {
      const error = cliErrors.fromCodegen({
        code: "SCHEMA_NOT_FOUND",
        message: "Schema file not found",
        schemaPath: "/path/to/schema.graphql",
      });
      const result = formatCliErrorHuman(error);

      expect(result).toContain("Error [SCHEMA_NOT_FOUND]");
      expect(result).toContain("Schema: /path/to/schema.graphql");
      expect(result).toContain("Hint:");
      expect(result).toContain("soda-gql.config.ts");
    });

    it("formats EMIT_FAILED with output path", () => {
      const error = cliErrors.fromCodegen({
        code: "EMIT_FAILED",
        message: "Failed to emit",
        outPath: "/path/to/output",
      });
      const result = formatCliErrorHuman(error);

      expect(result).toContain("Error [EMIT_FAILED]");
      expect(result).toContain("Output: /path/to/output");
      expect(result).toContain("Hint:");
    });

    it("formats INJECT_MODULE_NOT_FOUND with inject path", () => {
      const error = cliErrors.fromCodegen({
        code: "INJECT_MODULE_NOT_FOUND",
        message: "Inject module not found",
        injectPath: "/path/to/inject.ts",
      });
      const result = formatCliErrorHuman(error);

      expect(result).toContain("Error [INJECT_MODULE_NOT_FOUND]");
      expect(result).toContain("Inject: /path/to/inject.ts");
      expect(result).toContain("Hint:");
      expect(result).toContain("--emit-inject-template");
    });
  });

  describe("wrapped config errors", () => {
    it("formats CONFIG_NOT_FOUND with hint", () => {
      const error = cliErrors.fromConfig({
        code: "CONFIG_NOT_FOUND",
        message: "Config not found",
        filePath: "/path/to/config.ts",
      });
      const result = formatCliErrorHuman(error);

      expect(result).toContain("Error [CONFIG_NOT_FOUND]");
      expect(result).toContain("Config: /path/to/config.ts");
      expect(result).toContain("Hint:");
      expect(result).toContain("soda-gql.config.ts");
    });
  });

  describe("wrapped builder errors", () => {
    it("delegates to formatBuilderErrorForCLI", () => {
      const error = cliErrors.fromBuilder({
        code: "ENTRY_NOT_FOUND",
        message: "Entry not found",
        entry: "/path/to/entry.ts",
      });
      const result = formatCliErrorHuman(error);

      // Builder formatter should handle this
      expect(result).toContain("Error [ENTRY_NOT_FOUND]");
    });
  });
});

describe("formatCliErrorJson", () => {
  it("formats CLI error as JSON without category", () => {
    const error = cliErrors.unknownCommand("foobar");
    const result = formatCliErrorJson(error);
    const parsed = JSON.parse(result);

    expect(parsed.error.code).toBe("CLI_UNKNOWN_COMMAND");
    expect(parsed.error.message).toBe("Unknown command: foobar");
    expect(parsed.error.command).toBe("foobar");
    expect(parsed.error.category).toBeUndefined();
  });

  it("formats wrapped codegen error as JSON", () => {
    const error = cliErrors.fromCodegen({
      code: "SCHEMA_NOT_FOUND",
      message: "Schema file not found",
      schemaPath: "/path/to/schema.graphql",
    });
    const result = formatCliErrorJson(error);
    const parsed = JSON.parse(result);

    expect(parsed.error.code).toBe("SCHEMA_NOT_FOUND");
    expect(parsed.error.schemaPath).toBe("/path/to/schema.graphql");
  });

  it("produces valid JSON", () => {
    const error = cliErrors.fileExists("/path/with/special\"chars");
    const result = formatCliErrorJson(error);

    expect(() => JSON.parse(result)).not.toThrow();
  });
});

describe("formatCliError", () => {
  it("uses human format by default", () => {
    const error = cliErrors.unknownCommand("test");
    const result = formatCliError(error);

    expect(result).toContain("Error [CLI_UNKNOWN_COMMAND]");
    expect(result).not.toContain("{");
  });

  it("uses human format when specified", () => {
    const error = cliErrors.unknownCommand("test");
    const result = formatCliError(error, "human");

    expect(result).toContain("Error [CLI_UNKNOWN_COMMAND]");
  });

  it("uses json format when specified", () => {
    const error = cliErrors.unknownCommand("test");
    const result = formatCliError(error, "json");
    const parsed = JSON.parse(result);

    expect(parsed.error.code).toBe("CLI_UNKNOWN_COMMAND");
  });
});

describe("legacy formatters", () => {
  describe("formatOutput", () => {
    it("formats string as-is in human mode", () => {
      expect(formatOutput("hello", "human")).toBe("hello");
    });

    it("formats object as JSON in human mode", () => {
      const result = formatOutput({ key: "value" }, "human");
      expect(result).toContain('"key"');
    });

    it("formats as JSON in json mode", () => {
      const result = formatOutput({ key: "value" }, "json");
      expect(JSON.parse(result)).toEqual({ key: "value" });
    });
  });

  describe("formatError (deprecated)", () => {
    it("formats Error as message in human mode", () => {
      const result = formatError(new Error("test message"), "human");
      expect(result).toBe("test message");
    });

    it("formats error as JSON object in json mode", () => {
      const error = { code: "TEST", message: "test" };
      const result = formatError(error, "json");
      const parsed = JSON.parse(result);

      expect(parsed.error.code).toBe("TEST");
    });
  });
});

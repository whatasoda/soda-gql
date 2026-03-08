import { describe, expect, it } from "bun:test";
import { cliErr, cliErrors, getErrorCode, getErrorMessage, isCliError } from "./errors";

describe("cliErrors", () => {
  describe("CLI-specific error constructors", () => {
    it("creates CLI_ARGS_INVALID error", () => {
      const error = cliErrors.argsInvalid("codegen", "Missing required flag");

      expect(error.category).toBe("cli");
      expect(error.code).toBe("CLI_ARGS_INVALID");
      expect(error.message).toBe("Missing required flag");
      expect(error.command).toBe("codegen");
    });

    it("creates CLI_UNKNOWN_COMMAND error", () => {
      const error = cliErrors.unknownCommand("foobar");

      expect(error.category).toBe("cli");
      expect(error.code).toBe("CLI_UNKNOWN_COMMAND");
      expect(error.message).toBe("Unknown command: foobar");
      expect(error.command).toBe("foobar");
    });

    it("creates CLI_UNKNOWN_SUBCOMMAND error", () => {
      const error = cliErrors.unknownSubcommand("artifact", "unknown");

      expect(error.category).toBe("cli");
      expect(error.code).toBe("CLI_UNKNOWN_SUBCOMMAND");
      expect(error.message).toBe("Unknown subcommand: unknown");
      expect(error.parent).toBe("artifact");
      expect(error.subcommand).toBe("unknown");
    });

    it("creates CLI_FILE_EXISTS error with default message", () => {
      const error = cliErrors.fileExists("/path/to/file.ts");

      expect(error.category).toBe("cli");
      expect(error.code).toBe("CLI_FILE_EXISTS");
      expect(error.message).toContain("File already exists");
      expect(error.filePath).toBe("/path/to/file.ts");
    });

    it("creates CLI_FILE_EXISTS error with custom message", () => {
      const error = cliErrors.fileExists("/path/to/file.ts", "Custom message");

      expect(error.message).toBe("Custom message");
    });

    it("creates CLI_FILE_NOT_FOUND error", () => {
      const error = cliErrors.fileNotFound("/path/to/missing.ts");

      expect(error.category).toBe("cli");
      expect(error.code).toBe("CLI_FILE_NOT_FOUND");
      expect(error.filePath).toBe("/path/to/missing.ts");
    });

    it("creates CLI_WRITE_FAILED error with cause", () => {
      const cause = new Error("EACCES");
      const error = cliErrors.writeFailed("/path/to/file.ts", "Permission denied", cause);

      expect(error.category).toBe("cli");
      expect(error.code).toBe("CLI_WRITE_FAILED");
      expect(error.message).toBe("Permission denied");
      expect(error.filePath).toBe("/path/to/file.ts");
      expect(error.cause).toBe(cause);
    });

    it("creates CLI_READ_FAILED error", () => {
      const error = cliErrors.readFailed("/path/to/file.ts");

      expect(error.category).toBe("cli");
      expect(error.code).toBe("CLI_READ_FAILED");
      expect(error.filePath).toBe("/path/to/file.ts");
    });

    it("creates CLI_NO_PATTERNS error", () => {
      const error = cliErrors.noPatterns();

      expect(error.category).toBe("cli");
      expect(error.code).toBe("CLI_NO_PATTERNS");
      expect(error.message).toContain("No patterns provided");
    });

    it("creates CLI_FORMATTER_NOT_INSTALLED error", () => {
      const error = cliErrors.formatterNotInstalled();

      expect(error.category).toBe("cli");
      expect(error.code).toBe("CLI_FORMATTER_NOT_INSTALLED");
      expect(error.message).toContain("@soda-gql/formatter");
    });

    it("creates CLI_PARSE_ERROR error", () => {
      const error = cliErrors.parseError("Syntax error at line 10", "/path/to/file.ts");

      expect(error.category).toBe("cli");
      expect(error.code).toBe("CLI_PARSE_ERROR");
      expect(error.message).toBe("Syntax error at line 10");
      expect(error.filePath).toBe("/path/to/file.ts");
    });

    it("creates CLI_FORMAT_ERROR error", () => {
      const error = cliErrors.formatError("Failed to format", "/path/to/file.ts");

      expect(error.category).toBe("cli");
      expect(error.code).toBe("CLI_FORMAT_ERROR");
      expect(error.message).toBe("Failed to format");
    });

    it("creates CLI_UNEXPECTED error", () => {
      const cause = new Error("Something went wrong");
      const error = cliErrors.unexpected("Unexpected error occurred", cause);

      expect(error.category).toBe("cli");
      expect(error.code).toBe("CLI_UNEXPECTED");
      expect(error.message).toBe("Unexpected error occurred");
      expect(error.cause).toBe(cause);
    });
  });

  describe("external error wrappers", () => {
    it("wraps CodegenError", () => {
      const codegenError = {
        code: "SCHEMA_NOT_FOUND" as const,
        message: "Schema not found",
        schemaPath: "/path/to/schema.graphql",
      };
      const error = cliErrors.fromCodegen(codegenError);

      expect(error.category).toBe("codegen");
      expect(error.error).toBe(codegenError);
    });

    it("wraps BuilderError", () => {
      const builderError = {
        code: "ENTRY_NOT_FOUND" as const,
        message: "Entry not found",
        entry: "/path/to/entry.ts",
      };
      const error = cliErrors.fromBuilder(builderError);

      expect(error.category).toBe("builder");
      expect(error.error).toBe(builderError);
    });

    it("wraps ConfigError", () => {
      const configError = {
        code: "CONFIG_NOT_FOUND" as const,
        message: "Config not found",
        filePath: "/path/to/config.ts",
      };
      const error = cliErrors.fromConfig(configError);

      expect(error.category).toBe("config");
      expect(error.error).toBe(configError);
    });
  });
});

describe("cliErr", () => {
  it("creates an err Result with CliError", () => {
    const error = cliErrors.unknownCommand("test");
    const result = cliErr(error);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBe(error);
    }
  });
});

describe("isCliError", () => {
  it("returns true for CLI-specific errors", () => {
    const error = cliErrors.unknownCommand("test");
    expect(isCliError(error)).toBe(true);
  });

  it("returns false for wrapped external errors", () => {
    const error = cliErrors.fromCodegen({
      code: "SCHEMA_NOT_FOUND",
      message: "Not found",
      schemaPath: "/path",
    });
    expect(isCliError(error)).toBe(false);
  });
});

describe("getErrorCode", () => {
  it("extracts code from CLI-specific error", () => {
    const error = cliErrors.unknownCommand("test");
    expect(getErrorCode(error)).toBe("CLI_UNKNOWN_COMMAND");
  });

  it("extracts code from wrapped codegen error", () => {
    const error = cliErrors.fromCodegen({
      code: "SCHEMA_NOT_FOUND",
      message: "Not found",
      schemaPath: "/path",
    });
    expect(getErrorCode(error)).toBe("SCHEMA_NOT_FOUND");
  });

  it("extracts code from wrapped builder error", () => {
    const error = cliErrors.fromBuilder({
      code: "ENTRY_NOT_FOUND",
      message: "Entry not found",
      entry: "/path",
    });
    expect(getErrorCode(error)).toBe("ENTRY_NOT_FOUND");
  });

  it("extracts code from wrapped config error", () => {
    const error = cliErrors.fromConfig({
      code: "CONFIG_NOT_FOUND",
      message: "Config not found",
    });
    expect(getErrorCode(error)).toBe("CONFIG_NOT_FOUND");
  });
});

describe("getErrorMessage", () => {
  it("extracts message from CLI-specific error", () => {
    const error = cliErrors.argsInvalid("test", "Invalid args");
    expect(getErrorMessage(error)).toBe("Invalid args");
  });

  it("extracts message from wrapped external error", () => {
    const error = cliErrors.fromCodegen({
      code: "SCHEMA_NOT_FOUND",
      message: "Schema file not found",
      schemaPath: "/path",
    });
    expect(getErrorMessage(error)).toBe("Schema file not found");
  });
});

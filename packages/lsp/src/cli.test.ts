import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { parseCliArgs } from "./cli";

describe("parseCliArgs", () => {
  test("parses diagnostics with file path", () => {
    const result = parseCliArgs(["diagnostics", "src/index.ts"]);
    expect(result).toEqual({
      subcommand: "diagnostics",
      filePath: resolve("src/index.ts"),
      typeName: undefined,
      workspace: false,
      schemaName: undefined,
      configPath: undefined,
    });
  });

  test("parses diagnostics with --workspace", () => {
    const result = parseCliArgs(["diagnostics", "src/index.ts", "--workspace"]);
    expect(result?.workspace).toBe(true);
  });

  test("parses schema without typeName (list all)", () => {
    const result = parseCliArgs(["schema"]);
    expect(result).toEqual({
      subcommand: "schema",
      filePath: undefined,
      typeName: undefined,
      workspace: false,
      schemaName: undefined,
      configPath: undefined,
    });
  });

  test("parses schema with typeName", () => {
    const result = parseCliArgs(["schema", "Query"]);
    expect(result?.typeName).toBe("Query");
  });

  test("parses schema with --schema and --config", () => {
    const result = parseCliArgs(["schema", "Query", "--schema", "admin", "--config", "/path/to/file.ts"]);
    expect(result?.typeName).toBe("Query");
    expect(result?.schemaName).toBe("admin");
    expect(result?.configPath).toBe("/path/to/file.ts");
  });

  test("parses symbols with file path", () => {
    const result = parseCliArgs(["symbols", "src/queries.ts"]);
    expect(result).toEqual({
      subcommand: "symbols",
      filePath: resolve("src/queries.ts"),
      typeName: undefined,
      workspace: false,
      schemaName: undefined,
      configPath: undefined,
    });
  });

  test("returns undefined for unknown subcommand", () => {
    expect(parseCliArgs(["unknown"])).toBeUndefined();
  });

  test("returns undefined for --help", () => {
    expect(parseCliArgs(["--help"])).toBeUndefined();
  });

  test("returns undefined for empty args", () => {
    expect(parseCliArgs([])).toBeUndefined();
  });
});

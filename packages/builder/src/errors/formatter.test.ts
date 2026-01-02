import { describe, expect, test } from "bun:test";
import { builderErrors } from "../errors";
import { formatBuilderErrorForCLI, formatBuilderErrorStructured } from "./formatter";

describe("formatBuilderErrorStructured", () => {
  test("formats ELEMENT_EVALUATION_FAILED with location", () => {
    const error = builderErrors.elementEvaluationFailed(
      "/app/src/user.ts",
      "userFragment",
      "Cannot read properties of undefined",
    );
    const formatted = formatBuilderErrorStructured(error);

    expect(formatted.code).toBe("ELEMENT_EVALUATION_FAILED");
    expect(formatted.message).toBe("Cannot read properties of undefined");
    expect(formatted.location).toEqual({
      modulePath: "/app/src/user.ts",
      astPath: "userFragment",
    });
    expect(formatted.hint).toContain("imported fragments");
  });

  test("formats GRAPH_MISSING_IMPORT with related files", () => {
    const error = builderErrors.graphMissingImport("/app/src/a.ts", "/app/src/b.ts");
    const formatted = formatBuilderErrorStructured(error);

    expect(formatted.code).toBe("GRAPH_MISSING_IMPORT");
    expect(formatted.relatedFiles).toEqual(["/app/src/a.ts", "/app/src/b.ts"]);
    expect(formatted.hint).toContain("import path");
  });

  test("formats GRAPH_CIRCULAR_DEPENDENCY with chain", () => {
    const error = builderErrors.graphCircularDependency(["/a.ts", "/b.ts", "/c.ts", "/a.ts"]);
    const formatted = formatBuilderErrorStructured(error);

    expect(formatted.code).toBe("GRAPH_CIRCULAR_DEPENDENCY");
    expect(formatted.relatedFiles).toEqual(["/a.ts", "/b.ts", "/c.ts", "/a.ts"]);
    expect(formatted.hint).toContain("circular import");
  });

  test("formats CONFIG_NOT_FOUND with path", () => {
    const error = builderErrors.configNotFound("/app/soda-gql.config.ts");
    const formatted = formatBuilderErrorStructured(error);

    expect(formatted.code).toBe("CONFIG_NOT_FOUND");
    expect(formatted.location?.modulePath).toBe("/app/soda-gql.config.ts");
    expect(formatted.hint).toContain("Create a soda-gql.config.ts");
  });

  test("formats INTERNAL_INVARIANT with hint", () => {
    const error = builderErrors.internalInvariant("unexpected state");
    const formatted = formatBuilderErrorStructured(error);

    expect(formatted.code).toBe("INTERNAL_INVARIANT");
    expect(formatted.hint).toContain("report it");
  });

  test("preserves cause when present", () => {
    const cause = new Error("original error");
    const error = builderErrors.elementEvaluationFailed("/app/src/user.ts", "frag", "msg", cause);
    const formatted = formatBuilderErrorStructured(error);

    expect(formatted.cause).toBe(cause);
  });
});

describe("formatBuilderErrorForCLI", () => {
  test("formats error with location and hint", () => {
    const error = builderErrors.elementEvaluationFailed(
      "/app/src/user.ts",
      "userFragment",
      "Cannot read properties of undefined",
    );
    const output = formatBuilderErrorForCLI(error);

    expect(output).toContain("[ELEMENT_EVALUATION_FAILED]");
    expect(output).toContain("at /app/src/user.ts");
    expect(output).toContain("in userFragment");
    expect(output).toContain("Hint:");
  });

  test("formats error with related files", () => {
    const error = builderErrors.graphMissingImport("/app/src/a.ts", "/app/src/b.ts");
    const output = formatBuilderErrorForCLI(error);

    expect(output).toContain("[GRAPH_MISSING_IMPORT]");
    expect(output).toContain("Related files:");
    expect(output).toContain("/app/src/a.ts");
    expect(output).toContain("/app/src/b.ts");
  });

  test("formats error without location", () => {
    const error = builderErrors.internalInvariant("unexpected state");
    const output = formatBuilderErrorForCLI(error);

    expect(output).toContain("[INTERNAL_INVARIANT]");
    // Should not have "  at " (indented location line)
    expect(output).not.toMatch(/^\s{2}at /m);
    expect(output).toContain("Hint:");
  });

  test("omits empty astPath", () => {
    const error = builderErrors.elementEvaluationFailed("/app/src/user.ts", "", "Error");
    const output = formatBuilderErrorForCLI(error);

    expect(output).toContain("at /app/src/user.ts");
    // Should not have "  in " (indented astPath line)
    expect(output).not.toMatch(/^\s{2}in /m);
  });
});

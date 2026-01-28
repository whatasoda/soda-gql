import { describe, expect, it } from "bun:test";
import { formatValidationErrors, validateGeneratedSpecifiers } from "./specifier-validator";

describe("validateGeneratedSpecifiers", () => {
  it("validates valid input specifiers", () => {
    const code = `
      const input = {
        name: "s|String|!",
        email: "s|String|?",
        role: "e|Role|!",
        filter: "i|FilterInput|?",
      };
    `;

    const result = validateGeneratedSpecifiers(code);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.inputCount).toBe(4);
  });

  it("validates valid output specifiers", () => {
    const code = `
      const field = { spec: "o|User|!", arguments: {} };
      const union = { spec: "u|SearchResult|?", arguments: {} };
      const scalar = { spec: "s|String|!", arguments: {} };
    `;

    const result = validateGeneratedSpecifiers(code);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.outputCount).toBe(3);
  });

  it("validates excluded type specifiers with x prefix", () => {
    const code = `
      const input = {
        excluded: "x|InternalType|?",
      };
      const field = { spec: "x|ExcludedField|!", arguments: {} };
    `;

    const result = validateGeneratedSpecifiers(code);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.inputCount).toBe(1);
    expect(result.outputCount).toBe(1);
  });

  it("validates specifiers with default value marker", () => {
    const code = `
      const input = {
        limit: "s|Int|?|D",
        status: "e|Status|!|D",
      };
    `;

    const result = validateGeneratedSpecifiers(code);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("validates specifiers with list modifiers", () => {
    const code = `
      const input = {
        ids: "s|ID|![]!",
        names: "s|String|![]?",
      };
      const field = { spec: "o|User|![]!", arguments: {} };
    `;

    const result = validateGeneratedSpecifiers(code);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("reports invalid input specifier kind", () => {
    const code = `
      const input = {
        invalid: "z|Unknown|!",
      };
    `;

    const result = validateGeneratedSpecifiers(code);

    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    const error = result.errors[0]!;
    expect(error.type).toBe("input");
    expect(error.specifier).toBe("z|Unknown|!");
    expect(error.error).toContain("Invalid input specifier kind");
  });

  it("reports invalid output specifier kind", () => {
    const code = `
      const field = { spec: "z|Unknown|!", arguments: {} };
    `;

    const result = validateGeneratedSpecifiers(code);

    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    const error = result.errors[0]!;
    expect(error.type).toBe("output");
    expect(error.specifier).toBe("z|Unknown|!");
    expect(error.error).toContain("Invalid output specifier kind");
  });

  it("does not detect object format as specifier (catches original bug)", () => {
    // This is the format that caused the original bug
    const code = `
      const wrongFormat = { kind: "excluded", name: "TypeName", modifier: "?" };
    `;

    const result = validateGeneratedSpecifiers(code);

    // Should not find any specifiers (object format is not valid)
    expect(result.inputCount).toBe(0);
    expect(result.outputCount).toBe(0);
    expect(result.valid).toBe(true); // No errors because nothing to validate
  });

  it("handles empty code", () => {
    const result = validateGeneratedSpecifiers("");

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.inputCount).toBe(0);
    expect(result.outputCount).toBe(0);
  });
});

describe("formatValidationErrors", () => {
  it("formats no errors", () => {
    const result = formatValidationErrors([]);
    expect(result).toBe("No errors");
  });

  it("formats single error", () => {
    const result = formatValidationErrors([
      { specifier: "z|Unknown|!", type: "input", error: "Invalid input specifier kind: z" },
    ]);

    expect(result).toContain("[input]");
    expect(result).toContain("z|Unknown|!");
    expect(result).toContain("Invalid input specifier kind: z");
  });

  it("formats multiple errors", () => {
    const result = formatValidationErrors([
      { specifier: "z|A|!", type: "input", error: "Error 1" },
      { specifier: "z|B|?", type: "output", error: "Error 2" },
    ]);

    expect(result).toContain("[input]");
    expect(result).toContain("[output]");
    expect(result).toContain("z|A|!");
    expect(result).toContain("z|B|?");
  });
});

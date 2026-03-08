import { describe, expect, it } from "bun:test";
import { extractSpecifiersFromCode } from "./specifier-extractor";

describe("extractSpecifiersFromCode", () => {
  it("extracts input specifiers from field definitions", () => {
    const code = `
      const input = {
        name: "s|String|!",
        email: "s|String|?",
        role: "e|Role|!",
        filter: "i|FilterInput|?",
      };
    `;

    const result = extractSpecifiersFromCode(code);

    expect(result.inputSpecifiers).toContain("s|String|!");
    expect(result.inputSpecifiers).toContain("s|String|?");
    expect(result.inputSpecifiers).toContain("e|Role|!");
    expect(result.inputSpecifiers).toContain("i|FilterInput|?");
    expect(result.outputSpecifiers).toHaveLength(0);
  });

  it("extracts output specifiers from object format", () => {
    const code = `
      const field = { spec: "o|User|!", arguments: {} };
      const union = { spec: "u|SearchResult|?", arguments: {} };
      const scalar = { spec: "s|String|!", arguments: {} };
    `;

    const result = extractSpecifiersFromCode(code);

    expect(result.outputSpecifiers).toContain("o|User|!");
    expect(result.outputSpecifiers).toContain("u|SearchResult|?");
    expect(result.outputSpecifiers).toContain("s|String|!");
    expect(result.inputSpecifiers).toHaveLength(0);
  });

  it("extracts excluded type specifiers with x prefix", () => {
    const code = `
      const input = {
        excluded: "x|InternalType|?",
      };
      const field = { spec: "x|ExcludedField|!", arguments: {} };
    `;

    const result = extractSpecifiersFromCode(code);

    expect(result.inputSpecifiers).toContain("x|InternalType|?");
    expect(result.outputSpecifiers).toContain("x|ExcludedField|!");
  });

  it("extracts specifiers with default value marker", () => {
    const code = `
      const input = {
        limit: "s|Int|?|D",
        status: "e|Status|!|D",
      };
    `;

    const result = extractSpecifiersFromCode(code);

    expect(result.inputSpecifiers).toContain("s|Int|?|D");
    expect(result.inputSpecifiers).toContain("e|Status|!|D");
  });

  it("extracts specifiers with list modifiers", () => {
    const code = `
      const input = {
        ids: "s|ID|![]!",
        names: "s|String|![]?",
        items: "i|Item|?[]!",
      };
      const field = { spec: "o|User|![]!", arguments: {} };
    `;

    const result = extractSpecifiersFromCode(code);

    expect(result.inputSpecifiers).toContain("s|ID|![]!");
    expect(result.inputSpecifiers).toContain("s|String|![]?");
    expect(result.inputSpecifiers).toContain("i|Item|?[]!");
    expect(result.outputSpecifiers).toContain("o|User|![]!");
  });

  it("distinguishes input specifiers from output spec fields", () => {
    const code = `
      const objectDef = {
        user: { spec: "o|User|!", arguments: { id: "s|ID|!" } },
      };
    `;

    const result = extractSpecifiersFromCode(code);

    // "o|User|!" should be output, "s|ID|!" should be input
    expect(result.outputSpecifiers).toContain("o|User|!");
    expect(result.inputSpecifiers).toContain("s|ID|!");
  });

  it("does not match object format as valid specifier", () => {
    const code = `
      const wrongFormat = { kind: "excluded", name: "TypeName", modifier: "?" };
    `;

    const result = extractSpecifiersFromCode(code);

    expect(result.inputSpecifiers).toHaveLength(0);
    expect(result.outputSpecifiers).toHaveLength(0);
  });

  it("handles empty code", () => {
    const result = extractSpecifiersFromCode("");

    expect(result.inputSpecifiers).toHaveLength(0);
    expect(result.outputSpecifiers).toHaveLength(0);
  });

  it("handles code without any specifiers", () => {
    const code = `
      const obj = { name: "hello", value: 42 };
      const str = "not a specifier";
    `;

    const result = extractSpecifiersFromCode(code);

    expect(result.inputSpecifiers).toHaveLength(0);
    expect(result.outputSpecifiers).toHaveLength(0);
  });
});

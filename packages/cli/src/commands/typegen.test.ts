import { describe, expect, it } from "bun:test";
import { TypegenArgsSchema } from "../schemas/args";
import { parseArgs } from "../utils/parse-args";

describe("typegen args parsing", () => {
  it("parses empty args", () => {
    const result = parseArgs([], TypegenArgsSchema);
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.watch).toBeUndefined();
      expect(result.value.bundle).toBeUndefined();
      expect(result.value.config).toBeUndefined();
    }
  });

  it("parses --watch flag", () => {
    const result = parseArgs(["--watch"], TypegenArgsSchema);
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.watch).toBe(true);
    }
  });

  it("parses --bundle flag", () => {
    const result = parseArgs(["--bundle"], TypegenArgsSchema);
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.bundle).toBe(true);
    }
  });

  it("parses --watch --bundle combination", () => {
    const result = parseArgs(["--watch", "--bundle"], TypegenArgsSchema);
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.watch).toBe(true);
      expect(result.value.bundle).toBe(true);
    }
  });

  it("parses --config with path", () => {
    const result = parseArgs(["--config", "./custom-config.ts"], TypegenArgsSchema);
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.config).toBe("./custom-config.ts");
    }
  });

  it("parses --watch --config combination", () => {
    const result = parseArgs(["--watch", "--config", "./custom-config.ts"], TypegenArgsSchema);
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.watch).toBe(true);
      expect(result.value.config).toBe("./custom-config.ts");
    }
  });
});

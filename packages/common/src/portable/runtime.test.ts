import { describe, expect, test } from "bun:test";
import { runtime } from "./runtime";

describe("runtime", () => {
  test("detects Node.js runtime", () => {
    // After Bun code removal, runtime detection is simplified
    expect(runtime.isBun).toBe(false);
    expect(runtime.isNode).toBe(true);
  });

  test("detects supportsWebCrypto", () => {
    // This depends on environment (Node.js 19+ has global crypto)
    expect(typeof runtime.supportsWebCrypto).toBe("boolean");
  });
});

import { describe, expect, test } from "bun:test";
import { createConfigRegistry } from "./config-registry";

describe("createConfigRegistry", () => {
  test("returns error for invalid config path", () => {
    const result = createConfigRegistry(["/nonexistent/soda-gql.config.ts"]);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("CONFIG_LOAD_FAILED");
    }
  });
});

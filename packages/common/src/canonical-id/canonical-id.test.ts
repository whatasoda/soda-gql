import { describe, expect, test as it } from "bun:test";
import { type CanonicalId, createCanonicalId } from "./canonical-id";

describe("canonical identifier helpers", () => {
  it("normalizes absolute file paths and export names", () => {
    const id = createCanonicalId(
      "/app/src/../src/entities/user.ts",
      "userSlice"
    );
    expect(id).toBe(
      "/app/src/entities/user.ts::userSlice" as unknown as CanonicalId
    );
  });

  it("guards against relative paths", () => {
    expect(() => createCanonicalId("./user.ts", "userSlice")).toThrow(
      "CANONICAL_ID_REQUIRES_ABSOLUTE_PATH"
    );
  });
});

import { describe, expect, it } from "bun:test";
import { createColocateHelper, createPrefixHelper, prefixFields } from "../../src/composer";

describe("$colocate helper", () => {
  describe("createColocateHelper", () => {
    it("should prefix field entries with their labels", () => {
      const $colocate = createColocateHelper();

      const fields1 = { id: "field1", name: "field2" } as any;
      const fields2 = { title: "field3", body: "field4" } as any;

      const result = $colocate({
        user: fields1,
        post: fields2,
      });

      expect(result).toHaveLength(2);
      // First entry: user fields prefixed
      expect(result[0]).toEqual({
        user_id: "field1",
        user_name: "field2",
      });
      // Second entry: post fields prefixed
      expect(result[1]).toEqual({
        post_title: "field3",
        post_body: "field4",
      });
    });

    it("should work with single entry", () => {
      const $colocate = createColocateHelper();

      const fields = { id: "123", status: "active" } as any;

      const result = $colocate({
        order: fields,
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        order_id: "123",
        order_status: "active",
      });
    });

    it("should handle empty entries object", () => {
      const $colocate = createColocateHelper();

      const result = $colocate({});

      expect(result).toHaveLength(0);
    });
  });

  describe("prefixFields", () => {
    it("should prefix all field keys with the label", () => {
      const fields = { id: "1", name: "test", email: "test@example.com" } as any;

      const result = prefixFields("user", fields);

      expect(result).toEqual({
        user_id: "1",
        user_name: "test",
        user_email: "test@example.com",
      });
    });
  });

  describe("$prefix helper", () => {
    it("should prefix array of field entries", () => {
      const $prefix = createPrefixHelper();

      const fieldEntries = [
        { id: "1", name: "Alice" },
        { id: "2", name: "Bob" },
      ] as any;

      const result = $prefix("user", fieldEntries);

      expect(result).toHaveLength(2);
      expect(result[0] as any).toEqual({ user_id: "1", user_name: "Alice" });
      expect(result[1] as any).toEqual({ user_id: "2", user_name: "Bob" });
    });
  });
});

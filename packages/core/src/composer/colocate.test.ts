import { describe, expect, it } from "bun:test";
import { createColocateHelper } from "./colocate";
import { prefixFields } from "./field-prefix";

describe("$colocate helper", () => {
  describe("createColocateHelper", () => {
    it("should merge prefixed field entries into single object", () => {
      const $colocate = createColocateHelper();

      const fields1 = { id: "field1", name: "field2" } as any;
      const fields2 = { title: "field3", body: "field4" } as any;

      const result = $colocate({
        user: fields1,
        post: fields2,
      });

      expect(result).toEqual({
        user_id: "field1",
        user_name: "field2",
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

      expect(result).toEqual({
        order_id: "123",
        order_status: "active",
      });
    });

    it("should handle empty entries object", () => {
      const $colocate = createColocateHelper();

      const result = $colocate({});

      expect(result).toEqual({});
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
});

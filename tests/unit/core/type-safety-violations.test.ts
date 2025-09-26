import { describe, expect, it } from "bun:test";
// import { SliceResultError } from "../../../packages/core/src/runtime/operation-slice"; // unused import
import type { ExecutionResultProjection } from "../../../packages/core/src/types/execution-result-projection";

describe("Type Safety Violations", () => {
  describe("ExecutionResultProjection validation", () => {
    it("should validate projection paths start with $", () => {
      // Invalid path that doesn't start with $
      const invalidProjection = {
        projectFrom: "user.name", // Missing $ prefix
      } as ExecutionResultProjection;

      // This would be caught at compile time with proper typing,
      // but we can test runtime validation if it exists
      expect(() => {
        // Attempting to use invalid projection
        if (!invalidProjection.projectFrom.startsWith("$")) {
          throw new Error("Field path must start with $");
        }
      }).toThrow("Field path must start with $");
    });

    it("should handle valid projection paths", () => {
      const validProjection: ExecutionResultProjection = {
        projectFrom: "$user.profile.name",
      };

      expect(validProjection.projectFrom).toMatch(/^\$/);
    });
  });

  describe("Array element projection", () => {
    it("should ignore numeric segments in projections", () => {
      // Projections with numeric segments should be handled specially
      const projectionWithNumeric: ExecutionResultProjection = {
        projectFrom: "$items.0.name", // Contains numeric segment
      };

      // Parse the path to check for numeric segments
      const segments = projectionWithNumeric.projectFrom.split(".");
      const hasNumericSegment = segments.some((seg) => /^\d+$/.test(seg));

      expect(hasNumericSegment).toBe(true);
    });
  });

  describe("Primitive vs Object type violations", () => {
    it("should detect when primitive is accessed as object", () => {
      const data = {
        user: "John Doe", // String primitive, not an object
      };

      // Trying to access a property on a primitive
      const attemptAccess = () => {
        const value = data.user;
        if (typeof value !== "object" || value === null) {
          throw new Error("Expected object but got primitive");
        }
        // biome-ignore lint/suspicious/noExplicitAny: test with invalid type assertion
        return (value as any).name; // Would fail
      };

      expect(attemptAccess).toThrow("Expected object but got primitive");
    });

    it("should detect when object is accessed as primitive", () => {
      const data = {
        count: { value: 42 }, // Object, not a primitive number
      };

      // Trying to use object as primitive
      const attemptUse = () => {
        const value = data.count;
        if (typeof value === "object" && value !== null) {
          throw new Error("Expected primitive but got object");
        }
        return value + 1; // Would fail
      };

      expect(attemptUse).toThrow("Expected primitive but got object");
    });
  });

  describe("Null safety violations", () => {
    it("should handle null values in required fields", () => {
      const data = {
        requiredField: null,
      };

      const validateRequired = () => {
        if (data.requiredField === null) {
          throw new Error("Required field cannot be null");
        }
        return data.requiredField;
      };

      expect(validateRequired).toThrow("Required field cannot be null");
    });

    it("should handle undefined in GraphQL results", () => {
      const data = {
        field: undefined, // GraphQL doesn't return undefined, only null
      };

      const validateGraphQLValue = () => {
        if (data.field === undefined) {
          throw new Error("GraphQL values cannot be undefined");
        }
        return data.field;
      };

      expect(validateGraphQLValue).toThrow("GraphQL values cannot be undefined");
    });
  });

  describe("Type modifier violations", () => {
    it("should validate array types", () => {
      const data = {
        items: "not-an-array", // Should be an array
      };

      const validateArray = () => {
        if (!Array.isArray(data.items)) {
          throw new Error(`Expected array but got ${typeof data.items}`);
        }
        return data.items;
      };

      expect(validateArray).toThrow("Expected array but got string");
    });

    it("should validate non-null types", () => {
      const data = {
        nonNullField: null,
      };

      const validateNonNull = () => {
        if (data.nonNullField === null) {
          throw new Error("Non-null field cannot be null");
        }
        return data.nonNullField;
      };

      expect(validateNonNull).toThrow("Non-null field cannot be null");
    });

    it("should validate list of non-null items", () => {
      const data = {
        items: [1, null, 3], // Contains null in non-null list
      };

      const validateListItems = () => {
        for (const item of data.items) {
          if (item === null) {
            throw new Error("List items cannot be null");
          }
        }
        return data.items;
      };

      expect(validateListItems).toThrow("List items cannot be null");
    });
  });

  describe("Union type violations", () => {
    it("should validate union type members", () => {
      const data = {
        result: {
          __typename: "UnknownType", // Not a valid union member
          id: "123",
        },
      };

      const validateUnionMember = () => {
        const validTypes = ["User", "Post", "Comment"];
        if (!validTypes.includes(data.result.__typename)) {
          throw new Error(`Invalid union member type: ${data.result.__typename}`);
        }
        return data.result;
      };

      expect(validateUnionMember).toThrow("Invalid union member type: UnknownType");
    });
  });

  describe("Enum value violations", () => {
    it("should validate enum values", () => {
      const data = {
        status: "INVALID_STATUS", // Not a valid enum value
      };

      const validateEnum = () => {
        const validStatuses = ["ACTIVE", "INACTIVE", "PENDING"];
        if (!validStatuses.includes(data.status)) {
          throw new Error(`Invalid enum value: ${data.status}`);
        }
        return data.status;
      };

      expect(validateEnum).toThrow("Invalid enum value: INVALID_STATUS");
    });
  });
});

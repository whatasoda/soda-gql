import { describe, expect, it } from "bun:test";
import type { FormattedExecutionResult } from "graphql";
import { normalizeGraphQLResponse } from "./normalizer";

describe("normalizeGraphQLResponse", () => {
  it("should normalize a successful GraphQL response", () => {
    const response: FormattedExecutionResult = {
      data: {
        user: {
          id: "1",
          name: "Alice",
        },
      },
    };

    const normalized = normalizeGraphQLResponse(response);

    expect(normalized.type).toBe("graphql");
    if (normalized.type === "graphql") {
      expect(normalized.body).toEqual(response);
    }
  });

  it("should normalize a GraphQL response with errors", () => {
    const response: FormattedExecutionResult = {
      data: null,
      errors: [
        {
          message: "User not found",
          path: ["user"],
        },
      ],
    };

    const normalized = normalizeGraphQLResponse(response);

    expect(normalized.type).toBe("graphql");
    if (normalized.type === "graphql") {
      expect(normalized.body).toEqual(response);
      expect(normalized.body.errors).toHaveLength(1);
      expect(normalized.body.errors?.[0]?.message).toBe("User not found");
    }
  });

  it("should normalize a GraphQL response with partial data and errors", () => {
    const response: FormattedExecutionResult = {
      data: {
        user: {
          id: "1",
          name: null,
        },
      },
      errors: [
        {
          message: "Name field error",
          path: ["user", "name"],
        },
      ],
    };

    const normalized = normalizeGraphQLResponse(response);

    expect(normalized.type).toBe("graphql");
    if (normalized.type === "graphql") {
      expect(normalized.body).toEqual(response);
      expect(normalized.body.data).toBeDefined();
      expect(normalized.body.errors).toHaveLength(1);
    }
  });

  it("should normalize an empty response", () => {
    const response: FormattedExecutionResult = {
      data: null,
    };

    const normalized = normalizeGraphQLResponse(response);

    expect(normalized.type).toBe("empty");
  });

  it("should normalize a network error", () => {
    const error = new Error("Network request failed");
    error.name = "TypeError";

    const normalized = normalizeGraphQLResponse(error);

    expect(normalized.type).toBe("non-graphql-error");
    if (normalized.type === "non-graphql-error") {
      expect(normalized.error.code).toBe("NETWORK_ERROR");
      expect(normalized.error.message).toContain("Network request failed");
    }
  });

  it("should normalize a generic error", () => {
    const error = new Error("Something went wrong");

    const normalized = normalizeGraphQLResponse(error);

    expect(normalized.type).toBe("non-graphql-error");
    if (normalized.type === "non-graphql-error") {
      expect(normalized.error.code).toBe("UNKNOWN_ERROR");
      expect(normalized.error.message).toContain("Something went wrong");
    }
  });

  it("should normalize a string error", () => {
    const error = "String error message";

    const normalized = normalizeGraphQLResponse(error);

    expect(normalized.type).toBe("non-graphql-error");
    if (normalized.type === "non-graphql-error") {
      expect(normalized.error.code).toBe("UNKNOWN_ERROR");
      expect(normalized.error.message).toContain("String error message");
    }
  });

  it("should normalize an unknown error type", () => {
    const error = { weird: "object" };

    const normalized = normalizeGraphQLResponse(error);

    expect(normalized.type).toBe("non-graphql-error");
    if (normalized.type === "non-graphql-error") {
      expect(normalized.error.code).toBe("UNKNOWN_ERROR");
    }
  });
});

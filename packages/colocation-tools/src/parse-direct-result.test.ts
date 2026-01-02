import { describe, expect, it } from "bun:test";
import { type AnyFragment, Fragment } from "@soda-gql/core";
import { createProjection } from "./create-projection";
import { createDirectParser } from "./parse-direct-result";

describe("createDirectParser", () => {
  const createMockFragmentWithProjection = (options: {
    paths: string[];
    handle: Parameters<typeof createProjection>[1]["handle"];
  }) => {
    const mockBuilder = () => ({
      typename: "Mutation",
      spread: () => ({ createProduct: { id: "1", name: "Test" } }),
    });
    const fragment = Fragment.create(mockBuilder as any) as AnyFragment;

    const projection = createProjection(fragment, {
      paths: options.paths as any,
      handle: options.handle as any,
    });

    return { projection };
  };

  it("should parse direct result without label prefixing", () => {
    const mockFragment = createMockFragmentWithProjection({
      paths: ["$.createProduct"],
      handle: (result) => {
        if (result.isSuccess()) {
          const [product] = result.unwrap();
          return { id: (product as { id: string }).id };
        }
        return null;
      },
    });

    const parser = createDirectParser(mockFragment);
    const result = parser({
      type: "graphql",
      body: { data: { createProduct: { id: "123" } }, errors: undefined },
    });

    expect(result).toEqual({ id: "123" });
  });

  it("should handle multiple paths", () => {
    const mockFragment = createMockFragmentWithProjection({
      paths: ["$.createProduct.id", "$.createProduct.name"],
      handle: (result) => {
        if (result.isSuccess()) {
          const data = result.unwrap() as unknown as [string, string];
          return { id: data[0], name: data[1] };
        }
        return null;
      },
    });

    const parser = createDirectParser(mockFragment);
    const result = parser({
      type: "graphql",
      body: {
        data: { createProduct: { id: "123", name: "Widget" } },
        errors: undefined,
      },
    });

    expect(result).toEqual({ id: "123", name: "Widget" });
  });

  it("should handle GraphQL errors", () => {
    const mockFragment = createMockFragmentWithProjection({
      paths: ["$.createProduct"],
      handle: (result) => {
        if (result.isError()) {
          const error = result.error;
          if (error.type === "graphql-error") {
            return { error: error.errors[0]?.message ?? "Unknown", data: null };
          }
          return { error: "Other error", data: null };
        }
        if (result.isSuccess()) {
          const [product] = result.unwrap();
          return { error: null, data: product };
        }
        return { error: null, data: null };
      },
    });

    const parser = createDirectParser(mockFragment);
    const result = parser({
      type: "graphql",
      body: {
        data: null,
        errors: [{ message: "Validation failed", path: ["createProduct"] }],
      },
    });

    expect(result).toEqual({ error: "Validation failed", data: null });
  });

  it("should handle non-GraphQL errors", () => {
    const mockFragment = createMockFragmentWithProjection({
      paths: ["$.createProduct"],
      handle: (result) => {
        if (result.isError()) {
          return { error: "error" };
        }
        return { error: null };
      },
    });

    const parser = createDirectParser(mockFragment);
    const result = parser({
      type: "non-graphql-error",
      error: new Error("Network error"),
    });

    expect(result).toEqual({ error: "error" });
  });

  it("should handle empty results", () => {
    const mockFragment = createMockFragmentWithProjection({
      paths: ["$.createProduct"],
      handle: (result) => {
        if (result.isEmpty()) {
          return { isEmpty: true };
        }
        return { isEmpty: false };
      },
    });

    const parser = createDirectParser(mockFragment);
    const result = parser({ type: "empty" });

    expect(result).toEqual({ isEmpty: true });
  });

  it("should return parse-error when data path is invalid", () => {
    const mockFragment = createMockFragmentWithProjection({
      paths: ["$.createProduct.nested"],
      handle: (result) => {
        if (result.isError() && result.error.type === "parse-error") {
          return { parseError: true };
        }
        return { parseError: false };
      },
    });

    const parser = createDirectParser(mockFragment);
    const result = parser({
      type: "graphql",
      body: { data: { createProduct: null }, errors: undefined },
    });

    expect(result).toEqual({ parseError: true });
  });

  it("should handle nested paths correctly", () => {
    const mockFragment = createMockFragmentWithProjection({
      paths: ["$.insert_products_one.id", "$.insert_products_one.category.name"],
      handle: (result) => {
        if (result.isSuccess()) {
          const data = result.unwrap() as unknown as [string, string];
          return { productId: data[0], category: data[1] };
        }
        return null;
      },
    });

    const parser = createDirectParser(mockFragment);
    const result = parser({
      type: "graphql",
      body: {
        data: {
          insert_products_one: {
            id: "prod-001",
            category: { name: "Electronics" },
          },
        },
        errors: undefined,
      },
    });

    expect(result).toEqual({ productId: "prod-001", category: "Electronics" });
  });
});

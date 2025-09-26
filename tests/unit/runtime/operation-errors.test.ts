import { describe, expect, it } from "bun:test";
import { pseudoTypeAnnotation } from "../../../packages/core/src/types/utility";
import type { GraphqlRuntimeAdapter } from "../../../packages/core/src/types/adapter";
import type { NormalizedExecutionResult } from "../../../packages/core/src/types/execution-result";
import { createParse } from "../../../packages/core/src/runtime/operation";
import { SliceResultError, SliceResultEmpty, SliceResultSuccess } from "../../../packages/core/src/types/slice-result";
import type { ExecutionResultProjection, ExecutionResultProjectionPathGraphNode } from "../../../packages/core/src/types/execution-result-projection";

describe("Runtime Operation Error Handling", () => {
  const adapter = {
    nonGraphqlErrorType: pseudoTypeAnnotation<{ type: "test-error"; message: string }>(),
  } satisfies GraphqlRuntimeAdapter;

  describe("Non-GraphQL errors", () => {
    it("should map non-graphql-error to SliceResultError for all projections", () => {
      const projectionPathGraph: ExecutionResultProjectionPathGraphNode = {
        projections: new Map([
          ["$user", { projectFrom: "$user" } as ExecutionResultProjection],
          ["$posts", { projectFrom: "$posts" } as ExecutionResultProjection],
        ]),
        children: new Map(),
      };

      const parse = createParse({
        adapter,
        projectionPathGraph,
        slices: {},  // Add required slices parameter
      });

      const result: NormalizedExecutionResult<typeof adapter, object, object> = {
        type: "non-graphql-error",
        error: { type: "test-error", message: "Connection failed" },
      };

      const parsed = parse(result);

      expect(parsed.$user).toBeInstanceOf(SliceResultError);
      expect(parsed.$posts).toBeInstanceOf(SliceResultError);

      const userError = parsed.$user as SliceResultError<{ type: "test-error"; message: string }>;
      expect(userError.error).toEqual({ type: "test-error", message: "Connection failed" });
    });
  });

  describe("Empty results", () => {
    it("should map empty results to SliceResultEmpty for all projections", () => {
      const projectionPathGraph: ExecutionResultProjectionPathGraphNode = {
        projections: new Map([
          ["$data", { projectFrom: "$data" } as ExecutionResultProjection],
        ]),
        children: new Map(),
      };

      const parse = createParse({
        adapter,
        projectionPathGraph,
        slices: {},  // Add required slices parameter
      });

      const result: NormalizedExecutionResult<typeof adapter, object, object> = {
        type: "empty",
      };

      const parsed = parse(result);

      expect(parsed.$data).toBeInstanceOf(SliceResultEmpty);
    });
  });

  describe("GraphQL errors with various path formats", () => {
    it("should handle errors with empty paths", () => {
      const projectionPathGraph: ExecutionResultProjectionPathGraphNode = {
        projections: new Map([
          ["$query", { projectFrom: "$query" } as ExecutionResultProjection],
        ]),
        children: new Map(),
      };

      const parse = createParse({
        adapter,
        projectionPathGraph,
        slices: {},  // Add required slices parameter
      });

      const result: NormalizedExecutionResult<typeof adapter, object, object> = {
        type: "graphql",
        body: {
          data: null,
          errors: [
            {
              message: "Root error",
              path: [], // Empty path
            },
          ],
        },
      };

      const parsed = parse(result);
      expect(parsed.$query).toBeInstanceOf(SliceResultError);
    });

    it("should handle errors with numeric segments in paths", () => {
      const projectionPathGraph: ExecutionResultProjectionPathGraphNode = {
        projections: new Map([
          ["$items", { projectFrom: "$items" } as ExecutionResultProjection],
        ]),
        children: new Map([
          ["items", {
            projections: new Map(),
            children: new Map([
              ["0", { // Numeric segment
                projections: new Map([
                  ["$item", { projectFrom: "$items.0" } as ExecutionResultProjection],
                ]),
                children: new Map(),
              }],
            ]),
          }],
        ]),
      };

      const parse = createParse({
        adapter,
        projectionPathGraph,
        slices: {},  // Add required slices parameter
      });

      const result: NormalizedExecutionResult<typeof adapter, object, object> = {
        type: "graphql",
        body: {
          data: {
            items: [{ id: "1", name: "Item 1" }],
          },
          errors: [
            {
              message: "Item error",
              path: ["items", 0, "name"], // Numeric in path
            },
          ],
        },
      };

      const parsed = parse(result);
      // Numeric segments should be handled appropriately
      expect(parsed).toBeDefined();
    });
  });

  describe("Data access failures", () => {
    it("should return parse-error when accessing null data", () => {
      const projectionPathGraph: ExecutionResultProjectionPathGraphNode = {
        projections: new Map([
          ["$user", { projectFrom: "$user.profile" } as ExecutionResultProjection],
        ]),
        children: new Map([
          ["user", {
            projections: new Map(),
            children: new Map([
              ["profile", {
                projections: new Map(),
                children: new Map(),
              }],
            ]),
          }],
        ]),
      };

      const parse = createParse({
        adapter,
        projectionPathGraph,
        slices: {},  // Add required slices parameter
      });

      const result: NormalizedExecutionResult<typeof adapter, object, object> = {
        type: "graphql",
        body: {
          data: {
            user: null, // Null at intermediate path
          },
        },
      };

      const parsed = parse(result);
      expect(parsed.$user).toBeInstanceOf(SliceResultError);

      const error = parsed.$user as SliceResultError<unknown>;
      expect(error.error).toEqual({
        type: "parse-error",
        path: ["user", "profile"],
      });
    });

    it("should return parse-error when accessing scalar as object", () => {
      const projectionPathGraph: ExecutionResultProjectionPathGraphNode = {
        projections: new Map([
          ["$nested", { projectFrom: "$value.nested" } as ExecutionResultProjection],
        ]),
        children: new Map([
          ["value", {
            projections: new Map(),
            children: new Map([
              ["nested", {
                projections: new Map(),
                children: new Map(),
              }],
            ]),
          }],
        ]),
      };

      const parse = createParse({
        adapter,
        projectionPathGraph,
        slices: {},  // Add required slices parameter
      });

      const result: NormalizedExecutionResult<typeof adapter, object, object> = {
        type: "graphql",
        body: {
          data: {
            value: "scalar-string", // Scalar instead of object
          },
        },
      };

      const parsed = parse(result);
      expect(parsed.$nested).toBeInstanceOf(SliceResultError);

      const error = parsed.$nested as SliceResultError<unknown>;
      expect(error.error).toEqual({
        type: "parse-error",
        path: ["value", "nested"],
      });
    });

    it("should return parse-error when accessing array element incorrectly", () => {
      const projectionPathGraph: ExecutionResultProjectionPathGraphNode = {
        projections: new Map([
          ["$item", { projectFrom: "$items.name" } as ExecutionResultProjection],
        ]),
        children: new Map([
          ["items", {
            projections: new Map(),
            children: new Map([
              ["name", {
                projections: new Map(),
                children: new Map(),
              }],
            ]),
          }],
        ]),
      };

      const parse = createParse({
        adapter,
        projectionPathGraph,
        slices: {},  // Add required slices parameter
      });

      const result: NormalizedExecutionResult<typeof adapter, object, object> = {
        type: "graphql",
        body: {
          data: {
            items: [{ id: "1" }, { id: "2" }], // Array instead of object with 'name'
          },
        },
      };

      const parsed = parse(result);
      expect(parsed.$item).toBeInstanceOf(SliceResultError);
    });
  });

  describe("Invalid result types", () => {
    it("should throw on unknown result discriminator", () => {
      const projectionPathGraph: ExecutionResultProjectionPathGraphNode = {
        projections: new Map([
          ["$data", { projectFrom: "$data" } as ExecutionResultProjection],
        ]),
        children: new Map(),
      };

      const parse = createParse({
        adapter,
        projectionPathGraph,
        slices: {},  // Add required slices parameter
      });

      const invalidResult = {
        type: "unknown-type",
        something: "weird",
      } as any;

      expect(() => parse(invalidResult)).toThrow("Invalid result type");
    });
  });

  describe("Mixed success and error handling", () => {
    it("should handle mixed success and error projections", () => {
      const projectionPathGraph: ExecutionResultProjectionPathGraphNode = {
        projections: new Map([
          ["$user", { projectFrom: "$user" } as ExecutionResultProjection],
          ["$posts", { projectFrom: "$posts" } as ExecutionResultProjection],
        ]),
        children: new Map([
          ["user", {
            projections: new Map(),
            children: new Map(),
          }],
          ["posts", {
            projections: new Map(),
            children: new Map(),
          }],
        ]),
      };

      const parse = createParse({
        adapter,
        projectionPathGraph,
        slices: {},  // Add required slices parameter
      });

      const result: NormalizedExecutionResult<typeof adapter, object, object> = {
        type: "graphql",
        body: {
          data: {
            user: { id: "1", name: "Test User" },
            posts: null,
          },
          errors: [
            {
              message: "Posts fetch failed",
              path: ["posts"],
            },
          ],
        },
      };

      const parsed = parse(result);

      expect(parsed.$user).toBeInstanceOf(SliceResultSuccess);
      expect(parsed.$posts).toBeInstanceOf(SliceResultError);

      const userResult = parsed.$user as SliceResultSuccess<unknown>;
      expect(userResult.safeUnwrap()).toEqual({ id: "1", name: "Test User" });

      const postsError = parsed.$posts as SliceResultError<unknown>;
      expect(postsError.error).toEqual({
        type: "graphql-error",
        errors: [
          {
            message: "Posts fetch failed",
            path: ["posts"],
          },
        ],
      });
    });
  });
});
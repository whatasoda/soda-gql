import { describe, expect, it } from "bun:test";
import { createParse } from "../../../packages/core/src/runtime/operation";
import type { GraphqlRuntimeAdapter } from "../../../packages/core/src/types/adapter";
import type { NormalizedExecutionResult } from "../../../packages/core/src/types/execution-result";
import { ExecutionResultProjection } from "../../../packages/core/src/types/execution-result-projection";
import type { ExecutionResultProjectionPathGraphNode } from "../../../packages/core/src/types/operation";
import { SliceResultEmpty, SliceResultError, SliceResultSuccess } from "../../../packages/core/src/types/slice-result";
import { pseudoTypeAnnotation } from "../../../packages/core/src/types/utility";
import { createTestOperationSlices } from "../../utils/runtime";

/**
 * Helper to build a compliant projection path graph
 */
const buildProjectionGraph = (label: string, rawPath: string): ExecutionResultProjectionPathGraphNode => {
  const segments = rawPath.split(".").slice(1); // Remove leading $

  // Root node
  const root: ExecutionResultProjectionPathGraphNode = {
    matches: segments.length === 0 ? [{ label, path: rawPath, exact: true }] : [],
    children: {},
  };

  // Build the tree for nested paths
  if (segments.length > 0) {
    let currentNode: any = root;

    segments.forEach((segment, index) => {
      if (!currentNode.children[segment]) {
        currentNode.children[segment] = {
          matches: [],
          children: {},
        };
      }

      const node = currentNode.children[segment];
      const isLast = index === segments.length - 1;

      if (isLast) {
        node.matches.push({ label, path: rawPath, exact: true });
      }

      currentNode = node;
    });
  }

  return root;
};

describe("Runtime Operation Error Handling", () => {
  const adapter = {
    nonGraphqlErrorType: pseudoTypeAnnotation<{ type: "test-error"; message: string }>(),
  } satisfies GraphqlRuntimeAdapter;

  describe("GraphQL error handling", () => {
    it("should wrap GraphQL errors in SliceResultError", () => {
      const PATH = "$.user" as const;
      const slices = createTestOperationSlices({
        userSlice: new ExecutionResultProjection([PATH], (result) => result),
      });
      const projectionPathGraph = buildProjectionGraph("userSlice", PATH);
      const parse = createParse({ slices, projectionPathGraph });

      const result: NormalizedExecutionResult<typeof adapter, object, object> = {
        type: "graphql",
        body: {
          data: { user: null },
          errors: [
            {
              message: "User not found",
              path: ["user"],
              extensions: {},
            },
          ],
        },
      };

      const parsed = parse(result);
      expect(parsed.userSlice).toBeInstanceOf(SliceResultError);

      if (parsed.userSlice instanceof SliceResultError) {
        expect(parsed.userSlice.error.type).toBe("graphql-error");
        expect(parsed.userSlice.error.errors).toHaveLength(1);
        expect(parsed.userSlice.error.errors[0].message).toBe("User not found");
      }
    });

    it("should handle successful GraphQL responses", () => {
      const PATH = "$.user.profile" as const;
      const slices = createTestOperationSlices({
        profile: new ExecutionResultProjection([PATH], (result) => result),
      });
      const projectionPathGraph = buildProjectionGraph("profile", PATH);
      const parse = createParse({ slices, projectionPathGraph });

      const result: NormalizedExecutionResult<typeof adapter, object, object> = {
        type: "graphql",
        body: {
          data: {
            user: {
              profile: {
                name: "John Doe",
                email: "john@example.com",
              },
            },
          },
        },
      };

      const parsed = parse(result);
      expect(parsed.profile).toBeInstanceOf(SliceResultSuccess);

      if (parsed.profile instanceof SliceResultSuccess) {
        const data = parsed.profile.unwrap();
        // unwrap returns an array of path results
        expect(data).toEqual([
          {
            name: "John Doe",
            email: "john@example.com",
          },
        ]);
      }
    });

    it("should handle missing data with parse error", () => {
      const PATH = "$.user.profile.settings" as const;
      const slices = createTestOperationSlices({
        settings: new ExecutionResultProjection([PATH], (result) => result),
      });
      const projectionPathGraph = buildProjectionGraph("settings", PATH);
      const parse = createParse({ slices, projectionPathGraph });

      const result: NormalizedExecutionResult<typeof adapter, object, object> = {
        type: "graphql",
        body: {
          data: {
            user: {
              profile: null, // Missing nested data
            },
          },
        },
      };

      const parsed = parse(result);
      expect(parsed.settings).toBeInstanceOf(SliceResultError);

      if (parsed.settings instanceof SliceResultError) {
        expect(parsed.settings.error.type).toBe("parse-error");
      }
    });
  });

  describe("Non-GraphQL error handling", () => {
    it("should handle non-graphql-error results", () => {
      const PATH = "$.data" as const;
      const slices = createTestOperationSlices({
        data: new ExecutionResultProjection([PATH], (result) => result),
      });
      const projectionPathGraph = buildProjectionGraph("data", PATH);
      const parse = createParse({ slices, projectionPathGraph });

      const result: NormalizedExecutionResult<typeof adapter, object, object> = {
        type: "non-graphql-error",
        error: { type: "test-error", message: "Connection failed" },
      };

      const parsed = parse(result);
      expect(parsed.data).toBeInstanceOf(SliceResultError);

      if (parsed.data instanceof SliceResultError) {
        expect(parsed.data.error.type).toBe("non-graphql-error");
        // The error object itself is stored in the error property
        expect(parsed.data.error.error).toEqual({
          type: "test-error",
          message: "Connection failed",
        });
      }
    });
  });

  describe("Empty result handling", () => {
    it("should handle empty results", () => {
      const PATH = "$.data" as const;
      const slices = createTestOperationSlices({
        data: new ExecutionResultProjection([PATH], (result) => result),
      });
      const projectionPathGraph = buildProjectionGraph("data", PATH);
      const parse = createParse({ slices, projectionPathGraph });

      const result: NormalizedExecutionResult<typeof adapter, object, object> = {
        type: "empty",
      };

      const parsed = parse(result);
      expect(parsed.data).toBeInstanceOf(SliceResultEmpty);

      if (parsed.data instanceof SliceResultEmpty) {
        expect(parsed.data.isEmpty()).toBe(true);
      }
    });
  });

  describe("Multiple slices", () => {
    it("should handle multiple slices with mixed results", () => {
      const slices = createTestOperationSlices({
        user: new ExecutionResultProjection(["$.user"], (result) => result),
        posts: new ExecutionResultProjection(["$.posts"], (result) => result),
      });

      // Build projection graph for multiple slices
      const userGraph = buildProjectionGraph("user", "$.user");
      const postsGraph = buildProjectionGraph("posts", "$.posts");

      // Merge the graphs
      const projectionPathGraph: ExecutionResultProjectionPathGraphNode = {
        matches: [],
        children: {
          user: userGraph.children.user || { matches: [{ label: "user", path: "$.user", exact: true }], children: {} },
          posts: postsGraph.children.posts || { matches: [{ label: "posts", path: "$.posts", exact: true }], children: {} },
        },
      };

      const parse = createParse({ slices, projectionPathGraph });

      const result: NormalizedExecutionResult<typeof adapter, object, object> = {
        type: "graphql",
        body: {
          data: {
            user: { id: "1", name: "Alice" },
            posts: null,
          },
          errors: [
            {
              message: "Posts not available",
              path: ["posts"],
              extensions: {},
            },
          ],
        },
      };

      const parsed = parse(result);

      // User slice should be successful
      expect(parsed.user).toBeInstanceOf(SliceResultSuccess);
      if (parsed.user instanceof SliceResultSuccess) {
        expect(parsed.user.unwrap()).toEqual([{ id: "1", name: "Alice" }]);
      }

      // Posts slice should have an error
      expect(parsed.posts).toBeInstanceOf(SliceResultError);
      if (parsed.posts instanceof SliceResultError) {
        expect(parsed.posts.error.type).toBe("graphql-error");
      }
    });
  });

  describe("Invalid result type", () => {
    it("should throw on invalid result type", () => {
      const slices = createTestOperationSlices({
        test: new ExecutionResultProjection(["$.test"], (result) => result),
      });
      const projectionPathGraph = buildProjectionGraph("test", "$.test");
      const parse = createParse({ slices, projectionPathGraph });

      const invalidResult = {
        type: "unknown-type",
        something: "weird",
      } as any;

      expect(() => parse(invalidResult)).toThrow();
    });
  });
});

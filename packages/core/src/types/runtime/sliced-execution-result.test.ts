import { describe, expect, it } from "bun:test";
import { createRuntimeAdapter } from "@soda-gql/runtime";
import { createTestSlices } from "../../../test/utils/slices";
import { createExecutionResultParser } from "../../runtime/parse-execution-result";
import type { ProjectionPathGraphNode } from "../element/composed-operation";
import type { NormalizedExecutionResult } from "./execution-result";
import { Projection } from "./projection";
import type { AnyGraphqlRuntimeAdapter } from "./runtime-adapter";
import { SlicedExecutionResultEmpty, SlicedExecutionResultError, SlicedExecutionResultSuccess } from "./sliced-execution-result";

/**
 * Helper to build a compliant projection path graph
 */
const buildProjectionGraph = (label: string, rawPath: string): ProjectionPathGraphNode => {
  const segments = rawPath.split(".").slice(1); // Remove leading $

  // Root node
  const root: ProjectionPathGraphNode = {
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
  const adapter = createRuntimeAdapter(({ type }) => ({
    nonGraphqlErrorType: type<{ type: "test-error"; message: string }>(),
  })) satisfies AnyGraphqlRuntimeAdapter;

  describe("GraphQL error handling", () => {
    it("should wrap GraphQL errors in SlicedExecutionResultError", () => {
      const PATH = "$.user" as const;
      const slices = createTestSlices({
        userSlice: new Projection([PATH], (result) => result),
      });
      const projectionPathGraph = buildProjectionGraph("userSlice", PATH);
      const parse = createExecutionResultParser<typeof adapter>({
        fragments: slices,
        projectionPathGraph,
      });

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
      expect(parsed.userSlice).toBeInstanceOf(SlicedExecutionResultError);

      if (parsed.userSlice instanceof SlicedExecutionResultError) {
        expect(parsed.userSlice.error.type).toBe("graphql-error");
        expect(parsed.userSlice.error.errors).toHaveLength(1);
        expect(parsed.userSlice.error.errors[0].message).toBe("User not found");
      }
    });

    it("should handle successful GraphQL responses", () => {
      const PATH = "$.user.profile" as const;
      const slices = createTestSlices({
        profile: new Projection([PATH], (result) => result),
      });
      const projectionPathGraph = buildProjectionGraph("profile", PATH);
      const parse = createExecutionResultParser<typeof adapter>({
        fragments: slices,
        projectionPathGraph,
      });

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
      expect(parsed.profile).toBeInstanceOf(SlicedExecutionResultSuccess);

      if (parsed.profile instanceof SlicedExecutionResultSuccess) {
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
      const slices = createTestSlices({
        settings: new Projection([PATH], (result) => result),
      });
      const projectionPathGraph = buildProjectionGraph("settings", PATH);
      const parse = createExecutionResultParser<typeof adapter>({
        fragments: slices,
        projectionPathGraph,
      });

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
      expect(parsed.settings).toBeInstanceOf(SlicedExecutionResultError);

      if (parsed.settings instanceof SlicedExecutionResultError) {
        expect(parsed.settings.error.type).toBe("parse-error");
      }
    });
  });

  describe("Non-GraphQL error handling", () => {
    it("should handle non-graphql-error results", () => {
      const PATH = "$.data" as const;
      const slices = createTestSlices({
        data: new Projection([PATH], (result) => result),
      });
      const projectionPathGraph = buildProjectionGraph("data", PATH);
      const parse = createExecutionResultParser<typeof adapter>({
        fragments: slices,
        projectionPathGraph,
      });

      const result: NormalizedExecutionResult<typeof adapter, object, object> = {
        type: "non-graphql-error",
        error: { type: "test-error", message: "Connection failed" },
      };

      const parsed = parse(result);
      expect(parsed.data).toBeInstanceOf(SlicedExecutionResultError);

      if (parsed.data instanceof SlicedExecutionResultError) {
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
      const slices = createTestSlices({
        data: new Projection([PATH], (result) => result),
      });
      const projectionPathGraph = buildProjectionGraph("data", PATH);
      const parse = createExecutionResultParser<typeof adapter>({
        fragments: slices,
        projectionPathGraph,
      });

      const result: NormalizedExecutionResult<typeof adapter, object, object> = {
        type: "empty",
      };

      const parsed = parse(result);
      expect(parsed.data).toBeInstanceOf(SlicedExecutionResultEmpty);

      if (parsed.data instanceof SlicedExecutionResultEmpty) {
        expect(parsed.data.isEmpty()).toBe(true);
      }
    });
  });

  describe("Multiple slices", () => {
    it("should handle multiple slices with mixed results", () => {
      const slices = createTestSlices({
        user: new Projection(["$.user"], (result) => result),
        posts: new Projection(["$.posts"], (result) => result),
      });

      // Build projection graph for multiple slices
      const userGraph = buildProjectionGraph("user", "$.user");
      const postsGraph = buildProjectionGraph("posts", "$.posts");

      // Merge the graphs
      const projectionPathGraph: ProjectionPathGraphNode = {
        matches: [],
        children: {
          user: userGraph.children.user || {
            matches: [{ label: "user", path: "$.user", exact: true }],
            children: {},
          },
          posts: postsGraph.children.posts || {
            matches: [{ label: "posts", path: "$.posts", exact: true }],
            children: {},
          },
        },
      };

      const parse = createExecutionResultParser<typeof adapter>({
        fragments: slices,
        projectionPathGraph,
      });

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
      expect(parsed.user).toBeInstanceOf(SlicedExecutionResultSuccess);
      if (parsed.user instanceof SlicedExecutionResultSuccess) {
        expect(parsed.user.unwrap()).toEqual([{ id: "1", name: "Alice" }]);
      }

      // Posts slice should have an error
      expect(parsed.posts).toBeInstanceOf(SlicedExecutionResultError);
      if (parsed.posts instanceof SlicedExecutionResultError) {
        expect(parsed.posts.error.type).toBe("graphql-error");
      }
    });
  });

  describe("Invalid result type", () => {
    it("should throw on invalid result type", () => {
      const slices = createTestSlices({
        test: new Projection(["$.test"], (result) => result),
      });
      const projectionPathGraph = buildProjectionGraph("test", "$.test");
      const parse = createExecutionResultParser<typeof adapter>({
        fragments: slices,
        projectionPathGraph,
      });

      const invalidResult = {
        type: "unknown-type",
        something: "weird",
      } as any;

      expect(() => parse(invalidResult)).toThrow();
    });
  });
});

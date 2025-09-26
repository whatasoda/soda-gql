import { describe, expect, it } from "bun:test";
import { createParse } from "../../../packages/core/src/runtime/operation";
import type { GraphqlRuntimeAdapter } from "../../../packages/core/src/types/adapter";
import type { NormalizedExecutionResult } from "../../../packages/core/src/types/execution-result";
import {
  ExecutionResultProjection,
  type ExecutionResultProjectionPathGraphNode,
} from "../../../packages/core/src/types/execution-result-projection";
import { pseudoTypeAnnotation } from "../../../packages/core/src/types/utility";

describe("Runtime Operation Error Handling", () => {
  const adapter = {
    nonGraphqlErrorType: pseudoTypeAnnotation<{ type: "test-error"; message: string }>(),
  } satisfies GraphqlRuntimeAdapter;

  describe("createParse basic functionality", () => {
    it("should handle non-graphql-error results", () => {
      const slices = {
        test: {
          projections: {
            test: new ExecutionResultProjection(
              "$.test",
              (result) => result, // Return raw SliceResult for testing
            ),
          },
        },
      };

      const projectionPathGraph: ExecutionResultProjectionPathGraphNode = {
        matches: [{ label: "test", projection: slices.test.projections.test }],
        children: new Map(),
      };

      const parse = createParse({
        slices,
        projectionPathGraph,
      });

      const result: NormalizedExecutionResult<typeof adapter, object, object> = {
        type: "non-graphql-error",
        error: { type: "test-error", message: "Connection failed" },
      };

      // Parse returns an object with slice labels as keys
      const parsed = parse(result);
      expect(parsed).toHaveProperty("test");
      // The value is the SliceResult wrapped in an object structure
      expect(parsed.test).toBeDefined();
    });

    it("should handle empty results", () => {
      const slices = {
        test: {
          projections: {
            test: new ExecutionResultProjection("$.test", (result) => result),
          },
        },
      };

      const projectionPathGraph: ExecutionResultProjectionPathGraphNode = {
        matches: [{ label: "test", projection: slices.test.projections.test }],
        children: new Map(),
      };

      const parse = createParse({
        slices,
        projectionPathGraph,
      });

      const result: NormalizedExecutionResult<typeof adapter, object, object> = {
        type: "empty",
      };

      const parsed = parse(result);
      expect(parsed).toHaveProperty("test");
      expect(parsed.test).toBeDefined();
    });

    it("should handle graphql results with data", () => {
      const slices = {
        test: {
          projections: {
            test: new ExecutionResultProjection("$.data", (result) => result),
          },
        },
      };

      const projectionPathGraph: ExecutionResultProjectionPathGraphNode = {
        matches: [{ label: "test", projection: slices.test.projections.test, path: ["data"] }],
        children: new Map([
          [
            "data",
            {
              matches: [],
              children: new Map(),
            },
          ],
        ]),
      };

      const parse = createParse({
        slices,
        projectionPathGraph,
      });

      const result: NormalizedExecutionResult<typeof adapter, object, object> = {
        type: "graphql",
        body: {
          data: { value: "test data" },
        },
      };

      const parsed = parse(result);
      expect(parsed).toHaveProperty("test");
      expect(parsed.test).toBeDefined();
    });

    it("should handle graphql results with errors", () => {
      const slices = {
        test: {
          projections: {
            test: new ExecutionResultProjection("$.data", (result) => result),
          },
        },
      };

      const projectionPathGraph: ExecutionResultProjectionPathGraphNode = {
        matches: [{ label: "test", projection: slices.test.projections.test }],
        children: new Map(),
      };

      const parse = createParse({
        slices,
        projectionPathGraph,
      });

      const result: NormalizedExecutionResult<typeof adapter, object, object> = {
        type: "graphql",
        body: {
          data: null,
          errors: [
            {
              message: "Error message",
              path: [],
            },
          ],
        },
      };

      const parsed = parse(result);
      expect(parsed).toHaveProperty("test");
      expect(parsed.test).toBeDefined();
    });

    it("should throw on invalid result type", () => {
      const slices = {
        test: {
          projections: {
            test: new ExecutionResultProjection("$.test", (result) => result),
          },
        },
      };

      const projectionPathGraph: ExecutionResultProjectionPathGraphNode = {
        matches: [{ label: "test", projection: slices.test.projections.test }],
        children: new Map(),
      };

      const parse = createParse({
        slices,
        projectionPathGraph,
      });

      const invalidResult = {
        type: "unknown-type",
        something: "weird",
        // biome-ignore lint/suspicious/noExplicitAny: test with invalid type
      } as any;

      expect(() => parse(invalidResult)).toThrow("Invalid result type");
    });
  });
});

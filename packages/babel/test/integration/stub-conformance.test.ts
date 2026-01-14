/**
 * Conformance tests for internal module stubbing.
 *
 * These tests verify that babel-transformer produces the same stub output
 * as tsc-transformer for internal modules (graphql-system, scalars, adapter).
 */

import { describe, expect, it } from "bun:test";
import { createBabelTransformer } from "@soda-gql/babel";
import { loadStubTestCases } from "@soda-gql/tsc/test";

describe("Babel Internal Module Stub Conformance", () => {
  const testCases = loadStubTestCases();

  for (const testCase of testCases) {
    describe(testCase.id, () => {
      if (testCase.shouldStub) {
        it("should stub to 'export {};'", () => {
          const transformer = createBabelTransformer({
            config: testCase.config,
            artifact: testCase.artifact,
          });

          const result = transformer.transform({
            sourceCode: testCase.sourceCode,
            sourcePath: testCase.sourcePath,
          });

          expect(result.transformed).toBe(true);
          expect(result.sourceCode).toBe("export {};");
        });
      } else {
        it("should not stub regular files", () => {
          const transformer = createBabelTransformer({
            config: testCase.config,
            artifact: testCase.artifact,
          });

          const result = transformer.transform({
            sourceCode: testCase.sourceCode,
            sourcePath: testCase.sourcePath,
          });

          expect(result.sourceCode).not.toBe("export {};");
        });
      }
    });
  }
});

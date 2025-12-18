import { describe, expect, test } from "bun:test";
import type { ModuleAnalysis, ModuleDefinition } from "@soda-gql/builder/ast";
import { createIntermediateRegistry } from "@soda-gql/builder/intermediate-module/registry";
import { createCanonicalId } from "@soda-gql/common";

/**
 * Helper to create a mock ModuleAnalysis with specified definitions count
 */
const createMockAnalysis = (filePath: string, hasGqlDefinitions: boolean): ModuleAnalysis => {
  const definitions: ModuleDefinition[] = hasGqlDefinitions
    ? [
        {
          canonicalId: createCanonicalId(filePath, "test"),
          astPath: "test",
          isTopLevel: true,
          isExported: true,
          expression: "gql.default()",
          loc: { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } },
        },
      ]
    : [];
  return {
    filePath,
    signature: "test-sig",
    definitions,
    diagnostics: [],
    imports: [],
    exports: [],
  };
};

describe("createIntermediateRegistry", () => {
  describe("generator + trampoline evaluation", () => {
    test("should evaluate single module without dependencies", () => {
      const registry = createIntermediateRegistry();

      // @ts-expect-error - test uses simplified return type
      // biome-ignore lint/correctness/useYield: generator without dependencies for testing
      registry.setModule("/src/a.ts", function* () {
        return { value: "a" };
      });

      const result = registry.evaluate();
      expect(result).toEqual({});
    });

    test("should handle linear dependency chain", () => {
      const registry = createIntermediateRegistry();
      const evalOrder: string[] = [];

      // Module C (no dependencies)
      // @ts-expect-error - test uses simplified return type
      // biome-ignore lint/correctness/useYield: generator without dependencies for testing
      registry.setModule("/src/c.ts", function* () {
        evalOrder.push("c-start");
        const result = { c: "value-c" };
        evalOrder.push("c-end");
        return result;
      });

      // Module B depends on C
      // @ts-expect-error - test uses simplified return type
      registry.setModule("/src/b.ts", function* () {
        evalOrder.push("b-start");
        const { c } = yield registry.requestImport("/src/c.ts");
        const result = { b: `value-b-${c}` };
        evalOrder.push("b-end");
        return result;
      });

      // Module A depends on B
      // @ts-expect-error - test uses simplified return type
      registry.setModule("/src/a.ts", function* () {
        evalOrder.push("a-start");
        const { b } = yield registry.requestImport("/src/b.ts");
        const result = { a: `value-a-${b}` };
        evalOrder.push("a-end");
        return result;
      });

      registry.evaluate();

      // Verify dependency resolution order
      expect(evalOrder).toContain("c-start");
      expect(evalOrder).toContain("c-end");
      expect(evalOrder).toContain("b-start");
      expect(evalOrder).toContain("b-end");
      expect(evalOrder).toContain("a-start");
      expect(evalOrder).toContain("a-end");
    });

    test("should handle diamond dependency pattern", () => {
      const registry = createIntermediateRegistry();
      let dEvalCount = 0;

      // D is shared dependency
      // @ts-expect-error - test uses simplified return type
      // biome-ignore lint/correctness/useYield: generator without dependencies for testing
      registry.setModule("/src/d.ts", function* () {
        dEvalCount++;
        return { d: "value-d" };
      });

      // B depends on D
      // @ts-expect-error - test uses simplified return type
      registry.setModule("/src/b.ts", function* () {
        const { d } = yield registry.requestImport("/src/d.ts");
        return { b: `b-${d}` };
      });

      // C depends on D
      // @ts-expect-error - test uses simplified return type
      registry.setModule("/src/c.ts", function* () {
        const { d } = yield registry.requestImport("/src/d.ts");
        return { c: `c-${d}` };
      });

      // A depends on B and C
      // @ts-expect-error - test uses simplified return type
      registry.setModule("/src/a.ts", function* () {
        const { b } = yield registry.requestImport("/src/b.ts");
        const { c } = yield registry.requestImport("/src/c.ts");
        return { a: `a-${b}-${c}` };
      });

      registry.evaluate();

      // D should only be evaluated once (cached)
      expect(dEvalCount).toBe(1);
    });

    test("should detect circular dependencies", () => {
      const registry = createIntermediateRegistry();

      // A depends on B
      // @ts-expect-error - test uses simplified return type
      registry.setModule("/src/a.ts", function* () {
        const { b } = yield registry.requestImport("/src/b.ts");
        return { a: b };
      });

      // B depends on A (circular)
      // @ts-expect-error - test uses simplified return type
      registry.setModule("/src/b.ts", function* () {
        const { a } = yield registry.requestImport("/src/a.ts");
        return { b: a };
      });

      expect(() => registry.evaluate()).toThrow("Circular dependency detected");
    });

    test("should handle deep module chain without stack overflow", () => {
      const registry = createIntermediateRegistry();
      const CHAIN_LENGTH = 500; // Deep enough to overflow normal recursion

      // Create a chain: module_0 -> module_1 -> ... -> module_N
      for (let i = 0; i < CHAIN_LENGTH; i++) {
        const currentPath = `/src/module_${i}.ts`;
        const nextPath = `/src/module_${i + 1}.ts`;

        if (i === CHAIN_LENGTH - 1) {
          // Last module - no dependencies
          // @ts-expect-error - test uses simplified return type
          // biome-ignore lint/correctness/useYield: generator without dependencies for testing
          registry.setModule(currentPath, function* () {
            return { value: `module_${i}` };
          });
        } else {
          // Intermediate module - depends on next
          const currentIndex = i;
          // @ts-expect-error - test uses simplified return type
          registry.setModule(currentPath, function* () {
            const dep = yield registry.requestImport(nextPath);
            return { value: `module_${currentIndex}->${dep.value}` };
          });
        }
      }

      // Should not throw "Maximum call stack size exceeded"
      expect(() => registry.evaluate()).not.toThrow();
    });

    test("should throw for missing module", () => {
      const registry = createIntermediateRegistry();

      registry.setModule("/src/a.ts", function* () {
        const dep = yield registry.requestImport("/src/nonexistent.ts");
        return { a: dep };
      });

      expect(() => registry.evaluate()).toThrow("Module not found or yet to be registered");
    });
  });

  describe("circular dependency relaxation with analyses", () => {
    test("should throw for circular dependency when both modules have gql definitions", () => {
      const analyses = new Map<string, ModuleAnalysis>([
        ["/src/a.ts", createMockAnalysis("/src/a.ts", true)],
        ["/src/b.ts", createMockAnalysis("/src/b.ts", true)],
      ]);
      const registry = createIntermediateRegistry({ analyses });

      // A depends on B
      // @ts-expect-error - test uses simplified return type
      registry.setModule("/src/a.ts", function* () {
        const { b } = yield registry.requestImport("/src/b.ts");
        return { a: b };
      });

      // B depends on A (circular)
      // @ts-expect-error - test uses simplified return type
      registry.setModule("/src/b.ts", function* () {
        const { a } = yield registry.requestImport("/src/a.ts");
        return { b: a };
      });

      expect(() => registry.evaluate()).toThrow("Circular dependency detected");
    });

    test("should allow circular dependency when target module has no gql definitions", () => {
      const analyses = new Map<string, ModuleAnalysis>([
        ["/src/a.ts", createMockAnalysis("/src/a.ts", true)], // has gql
        ["/src/b.ts", createMockAnalysis("/src/b.ts", false)], // no gql
      ]);
      const registry = createIntermediateRegistry({ analyses });
      let bReceivedValue: unknown;

      // A depends on B (B has no gql)
      // @ts-expect-error - test uses simplified return type
      registry.setModule("/src/a.ts", function* () {
        const dep = yield registry.requestImport("/src/b.ts");
        return { a: `a-got-${JSON.stringify(dep)}` };
      });

      // B depends on A (circular, but B has no gql)
      // @ts-expect-error - test uses simplified return type
      registry.setModule("/src/b.ts", function* () {
        bReceivedValue = yield registry.requestImport("/src/a.ts");
        return { b: "b-value" };
      });

      // Should not throw - B has no gql, so circular is allowed
      expect(() => registry.evaluate()).not.toThrow();
      // B should receive empty object for circular import
      expect(bReceivedValue).toEqual({});
    });

    test("should allow circular dependency when source module has no gql definitions", () => {
      const analyses = new Map<string, ModuleAnalysis>([
        ["/src/a.ts", createMockAnalysis("/src/a.ts", false)], // no gql
        ["/src/b.ts", createMockAnalysis("/src/b.ts", true)], // has gql
      ]);
      const registry = createIntermediateRegistry({ analyses });
      let aReceivedValue: unknown;

      // A depends on B (A has no gql)
      // @ts-expect-error - test uses simplified return type
      registry.setModule("/src/a.ts", function* () {
        const dep = yield registry.requestImport("/src/b.ts");
        return { a: `a-got-${JSON.stringify(dep)}` };
      });

      // B depends on A (circular, A has no gql)
      // @ts-expect-error - test uses simplified return type
      registry.setModule("/src/b.ts", function* () {
        aReceivedValue = yield registry.requestImport("/src/a.ts");
        return { b: "b-value" };
      });

      // Should not throw - A has no gql, so circular is allowed
      expect(() => registry.evaluate()).not.toThrow();
      // A receives empty object when circular import is detected
      expect(aReceivedValue).toEqual({});
    });

    test("should allow circular dependency when neither module has gql definitions", () => {
      const analyses = new Map<string, ModuleAnalysis>([
        ["/src/a.ts", createMockAnalysis("/src/a.ts", false)], // no gql
        ["/src/b.ts", createMockAnalysis("/src/b.ts", false)], // no gql
      ]);
      const registry = createIntermediateRegistry({ analyses });
      let bReceivedValue: unknown;

      // A depends on B
      // @ts-expect-error - test uses simplified return type
      registry.setModule("/src/a.ts", function* () {
        yield registry.requestImport("/src/b.ts");
        return { a: "a-value" };
      });

      // B depends on A (circular)
      // @ts-expect-error - test uses simplified return type
      registry.setModule("/src/b.ts", function* () {
        bReceivedValue = yield registry.requestImport("/src/a.ts");
        return { b: "b-value" };
      });

      // Should not throw - neither has gql
      expect(() => registry.evaluate()).not.toThrow();
      // B receives empty object for the circular import back to A
      expect(bReceivedValue).toEqual({});
    });

    test("should detect circular without analyses (backward compatibility)", () => {
      // Without analyses, circular detection should work as before
      const registry = createIntermediateRegistry();

      // A depends on B
      // @ts-expect-error - test uses simplified return type
      registry.setModule("/src/a.ts", function* () {
        const { b } = yield registry.requestImport("/src/b.ts");
        return { a: b };
      });

      // B depends on A (circular)
      // @ts-expect-error - test uses simplified return type
      registry.setModule("/src/b.ts", function* () {
        const { a } = yield registry.requestImport("/src/a.ts");
        return { b: a };
      });

      expect(() => registry.evaluate()).toThrow("Circular dependency detected");
    });

    test("should allow circular through non-gql module (A -> B -> A pattern)", () => {
      // NestJS-like pattern: A (gql) imports B (no gql), B imports A (gql)
      const analyses = new Map<string, ModuleAnalysis>([
        ["/src/a.ts", createMockAnalysis("/src/a.ts", true)], // has gql
        ["/src/b.ts", createMockAnalysis("/src/b.ts", false)], // no gql (service file)
      ]);
      const registry = createIntermediateRegistry({ analyses });
      let bReceivedFromA: unknown;

      // A (gql) depends on B (no gql)
      // @ts-expect-error - test uses simplified return type
      registry.setModule("/src/a.ts", function* () {
        const dep = yield registry.requestImport("/src/b.ts");
        return { a: `a-got-b:${JSON.stringify(dep)}` };
      });

      // B (no gql) depends on A (gql) - this creates circular
      // @ts-expect-error - test uses simplified return type
      registry.setModule("/src/b.ts", function* () {
        bReceivedFromA = yield registry.requestImport("/src/a.ts");
        return { b: "service" };
      });

      // Should not throw - B has no gql, circular is allowed
      expect(() => registry.evaluate()).not.toThrow();
      // B receives empty object for the circular import back to A
      expect(bReceivedFromA).toEqual({});
    });
  });
});

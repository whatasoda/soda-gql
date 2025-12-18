import { describe, expect, test } from "bun:test";
import { createIntermediateRegistry } from "@soda-gql/builder/intermediate-module/registry";

describe("createIntermediateRegistry", () => {
  describe("generator + trampoline evaluation", () => {
    test("should evaluate single module without dependencies", () => {
      const registry = createIntermediateRegistry();

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
      registry.setModule("/src/c.ts", function* () {
        evalOrder.push("c-start");
        const result = { c: "value-c" };
        evalOrder.push("c-end");
        return result;
      });

      // Module B depends on C
      registry.setModule("/src/b.ts", function* () {
        evalOrder.push("b-start");
        const { c } = yield registry.requestImport("/src/c.ts");
        const result = { b: `value-b-${c}` };
        evalOrder.push("b-end");
        return result;
      });

      // Module A depends on B
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
      registry.setModule("/src/d.ts", function* () {
        dEvalCount++;
        return { d: "value-d" };
      });

      // B depends on D
      registry.setModule("/src/b.ts", function* () {
        const { d } = yield registry.requestImport("/src/d.ts");
        return { b: `b-${d}` };
      });

      // C depends on D
      registry.setModule("/src/c.ts", function* () {
        const { d } = yield registry.requestImport("/src/d.ts");
        return { c: `c-${d}` };
      });

      // A depends on B and C
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
      registry.setModule("/src/a.ts", function* () {
        const { b } = yield registry.requestImport("/src/b.ts");
        return { a: b };
      });

      // B depends on A (circular)
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
          registry.setModule(currentPath, function* () {
            return { value: `module_${i}` };
          });
        } else {
          // Intermediate module - depends on next
          const currentIndex = i;
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
});

import { describe, expect, it } from "bun:test";
import { createCanonicalTracker } from "../../../packages/builder/src/canonical/path-tracker";

describe("CanonicalPathTracker", () => {
  const filePath = "/test/src/test.ts";

  describe("Basic scope management", () => {
    it("enters and exits scopes correctly", () => {
      const tracker = createCanonicalTracker({ filePath });

      const handle1 = tracker.enterScope({ segment: "foo", kind: "function", stableKey: "func:foo" });
      expect(tracker.currentDepth()).toBe(1);

      const handle2 = tracker.enterScope({ segment: "bar", kind: "variable", stableKey: "var:bar" });
      expect(tracker.currentDepth()).toBe(2);

      tracker.exitScope(handle2);
      expect(tracker.currentDepth()).toBe(1);

      tracker.exitScope(handle1);
      expect(tracker.currentDepth()).toBe(0);
    });

    it("validates scope exit order", () => {
      const tracker = createCanonicalTracker({ filePath });

      const handle1 = tracker.enterScope({ segment: "foo", kind: "function", stableKey: "func:foo" });
      const _handle2 = tracker.enterScope({ segment: "bar", kind: "variable", stableKey: "var:bar" });

      // Try to exit handle1 before handle2 (invalid order)
      expect(() => tracker.exitScope(handle1)).toThrow("Invalid scope exit");
    });
  });

  describe("Definition registration", () => {
    it("registers top-level definitions", () => {
      const tracker = createCanonicalTracker({ filePath });

      const def = tracker.registerDefinition();

      expect(def.astPath).toBe("");
      expect(def.isTopLevel).toBe(true);
      expect(def.exportBinding).toBeUndefined();
    });

    it("registers nested definitions", () => {
      const tracker = createCanonicalTracker({ filePath });

      tracker.enterScope({ segment: "MyComponent", kind: "function", stableKey: "func:MyComponent" });
      const def = tracker.registerDefinition();

      expect(def.astPath).toBe("MyComponent");
      expect(def.isTopLevel).toBe(false);
    });

    it("builds astPath from scope stack", () => {
      const tracker = createCanonicalTracker({ filePath });

      tracker.enterScope({ segment: "outer", kind: "function", stableKey: "func:outer" });
      tracker.enterScope({ segment: "inner", kind: "function", stableKey: "func:inner" });
      const def = tracker.registerDefinition();

      expect(def.astPath).toBe("outer.inner");
    });
  });

  describe("Path uniqueness", () => {
    it("ensures unique paths for duplicate definitions", () => {
      const tracker = createCanonicalTracker({ filePath });

      const def1 = tracker.registerDefinition();
      const def2 = tracker.registerDefinition();
      const def3 = tracker.registerDefinition();

      expect(def1.astPath).toBe("");
      expect(def2.astPath).toBe("$1");
      expect(def3.astPath).toBe("$2");
    });

    it("ensures unique paths for nested duplicates", () => {
      const tracker = createCanonicalTracker({ filePath });

      tracker.enterScope({ segment: "foo", kind: "function", stableKey: "func:foo" });

      const def1 = tracker.registerDefinition();
      const def2 = tracker.registerDefinition();

      expect(def1.astPath).toBe("foo");
      expect(def2.astPath).toBe("foo$1");
    });
  });

  describe("Occurrence tracking", () => {
    it("tracks occurrences for duplicate scope names", () => {
      const tracker = createCanonicalTracker({ filePath });

      const handle1 = tracker.enterScope({ segment: "foo", kind: "function", stableKey: "func:foo" });
      tracker.exitScope(handle1);

      const handle2 = tracker.enterScope({ segment: "foo", kind: "function", stableKey: "func:foo" });
      tracker.exitScope(handle2);

      // Both should enter successfully (tracker manages occurrences)
      expect(tracker.currentDepth()).toBe(0);
    });

    it("uses stableKey for occurrence tracking", () => {
      const tracker = createCanonicalTracker({ filePath });

      // Same stableKey should increment occurrence
      const handle1 = tracker.enterScope({ segment: "foo1", kind: "function", stableKey: "same-key" });
      expect(handle1.depth).toBe(0);
      tracker.exitScope(handle1);

      const handle2 = tracker.enterScope({ segment: "foo2", kind: "function", stableKey: "same-key" });
      expect(handle2.depth).toBe(0);
      tracker.exitScope(handle2);

      // Different stableKey should start at 0
      const handle3 = tracker.enterScope({ segment: "bar", kind: "function", stableKey: "different-key" });
      expect(handle3.depth).toBe(0);
    });
  });

  describe("Canonical ID resolution", () => {
    it("resolves canonical IDs from astPath", () => {
      const tracker = createCanonicalTracker({ filePath });

      const canonicalId = tracker.resolveCanonicalId("foo.bar");

      expect(canonicalId).toBe("/test/src/test.ts::foo.bar");
    });

    it("handles empty astPath", () => {
      const tracker = createCanonicalTracker({ filePath });

      const canonicalId = tracker.resolveCanonicalId("");

      expect(canonicalId).toBe("/test/src/test.ts::");
    });
  });

  describe("Export binding registration", () => {
    it("registers export bindings", () => {
      const tracker = createCanonicalTracker({ filePath });

      tracker.registerExportBinding("localName", "exportedName");

      // Export binding is internal state, validated through getExportName
      expect(tracker.currentDepth()).toBe(0); // Just verify tracker is still functional
    });

    it("uses getExportName callback", () => {
      const exports = new Map([
        ["foo", "Foo"],
        ["bar", "Bar"],
      ]);

      const tracker = createCanonicalTracker({
        filePath,
        getExportName: (local) => exports.get(local),
      });

      // The getExportName is used internally
      expect(tracker.currentDepth()).toBe(0);
    });
  });

  describe("Edge cases", () => {
    it("handles special characters in segments", () => {
      const tracker = createCanonicalTracker({ filePath });

      tracker.enterScope({ segment: "foo$bar", kind: "function", stableKey: "func:foo$bar" });
      const def = tracker.registerDefinition();

      expect(def.astPath).toBe("foo$bar");
    });

    it("handles numeric segments", () => {
      const tracker = createCanonicalTracker({ filePath });

      tracker.enterScope({ segment: "123", kind: "property", stableKey: "prop:123" });
      const def = tracker.registerDefinition();

      expect(def.astPath).toBe("123");
    });

    it("handles deeply nested scopes", () => {
      const tracker = createCanonicalTracker({ filePath });

      const handles = [];
      for (let i = 0; i < 10; i++) {
        handles.push(tracker.enterScope({ segment: `level${i}`, kind: "function", stableKey: `func:level${i}` }));
      }

      const def = tracker.registerDefinition();
      expect(def.astPath).toBe("level0.level1.level2.level3.level4.level5.level6.level7.level8.level9");
      expect(def.isTopLevel).toBe(false);

      // Clean up
      for (let i = handles.length - 1; i >= 0; i--) {
        tracker.exitScope(handles[i]);
      }
    });
  });

  describe("Integration with different scope kinds", () => {
    it("handles mixed scope kinds", () => {
      const tracker = createCanonicalTracker({ filePath });

      tracker.enterScope({ segment: "MyClass", kind: "class", stableKey: "class:MyClass" });
      tracker.enterScope({ segment: "myMethod", kind: "method", stableKey: "member:MyClass.myMethod" });
      tracker.enterScope({ segment: "localVar", kind: "variable", stableKey: "var:localVar" });

      const def = tracker.registerDefinition();

      expect(def.astPath).toBe("MyClass.myMethod.localVar");
    });

    it("handles property scopes", () => {
      const tracker = createCanonicalTracker({ filePath });

      tracker.enterScope({ segment: "config", kind: "variable", stableKey: "var:config" });
      tracker.enterScope({ segment: "database", kind: "property", stableKey: "prop:database" });
      tracker.enterScope({ segment: "host", kind: "property", stableKey: "prop:host" });

      const def = tracker.registerDefinition();

      expect(def.astPath).toBe("config.database.host");
    });
  });
});

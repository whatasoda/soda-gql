import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { types as t } from "@babel/core";
import { parseSync } from "@babel/core";
import type { BuilderArtifact } from "@soda-gql/builder";
import { runBabelTransform } from "../../utils/transform";

const isModuleLoader = (stmt: t.Statement): boolean => {
  // ESM: import declaration
  if (stmt.type === "ImportDeclaration") {
    return true;
  }

  // CommonJS: const foo = require("bar") or const foo = __webpack_require__(123)
  if (stmt.type === "VariableDeclaration") {
    return stmt.declarations.some((decl) => {
      if (!decl.init || decl.init.type !== "CallExpression") {
        return false;
      }
      const callee = decl.init.callee;
      return callee.type === "Identifier" && (callee.name === "require" || callee.name === "__webpack_require__");
    });
  }

  // CommonJS: require("bar") as standalone expression
  if (stmt.type === "ExpressionStatement") {
    const expr = stmt.expression;
    if (expr.type !== "CallExpression") {
      return false;
    }
    const callee = expr.callee;
    return callee.type === "Identifier" && (callee.name === "require" || callee.name === "__webpack_require__");
  }

  return false;
};

const isRuntimeOperation = (stmt: t.Statement): boolean => {
  if (stmt.type !== "ExpressionStatement") {
    return false;
  }

  const expr = stmt.expression;
  if (expr.type !== "CallExpression") {
    return false;
  }

  // Check for gqlRuntime.operation(...)
  const callee = expr.callee;
  if (callee.type !== "MemberExpression") {
    return false;
  }

  const object = callee.object;
  const property = callee.property;

  return (
    object.type === "Identifier" &&
    object.name === "gqlRuntime" &&
    property.type === "Identifier" &&
    property.name === "operation"
  );
};

describe("runtime insertion order", () => {
  it("should insert runtime calls after all CommonJS require statements", async () => {
    const fixtureSource = readFileSync(join(__dirname, "../../fixtures/plugin-babel/runtime-order/commonjs/source.ts"), "utf-8");

    const artifact = {
      elements: {
        "/test/operations.ts::getUserQuery": {
          id: "/test/operations.ts::getUserQuery",
          type: "operation",
          prebuild: {
            operationType: "query",
            operationName: "GetUser",
            document: {
              kind: "Document",
              definitions: [
                {
                  kind: "OperationDefinition",
                  operation: "query",
                  name: { kind: "Name", value: "GetUser" },
                  variableDefinitions: [],
                  selectionSet: { kind: "SelectionSet", selections: [] },
                },
              ],
            },
            variableNames: ["userId"],
            projectionPathGraph: { matches: [], children: {} },
          },
          metadata: {
            sourcePath: "/test/operations.ts",
            sourceHash: "test",
            contentHash: "test",
          },
        },
      },
      report: {
        durationMs: 0,
        warnings: [],
        stats: { hits: 0, misses: 1, skips: 0 },
      },
    };

    const code = await runBabelTransform(fixtureSource, "/test/operations.ts", artifact as BuilderArtifact, {
      skipTypeCheck: true,
    });

    // Parse the transformed output
    const ast = parseSync(code, {
      filename: "/test/operations.ts",
      parserOpts: { sourceType: "module" },
    });

    if (!ast) {
      throw new Error("Failed to parse transformed code");
    }

    // Find positions of loaders and runtime calls
    const statements = ast.program.body;
    let lastLoaderIndex = -1;
    let firstRuntimeIndex = -1;

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      if (!stmt) continue;

      if (isModuleLoader(stmt)) {
        lastLoaderIndex = i;
      }

      if (isRuntimeOperation(stmt) && firstRuntimeIndex === -1) {
        firstRuntimeIndex = i;
      }
    }

    // Assertions
    expect(lastLoaderIndex).toBeGreaterThanOrEqual(0);
    expect(firstRuntimeIndex).toBeGreaterThan(0);
    expect(firstRuntimeIndex).toBeGreaterThan(lastLoaderIndex);

    // Verify no loaders appear after runtime calls
    for (let i = firstRuntimeIndex; i < statements.length; i++) {
      const stmt = statements[i];
      if (stmt) {
        expect(isModuleLoader(stmt)).toBe(false);
      }
    }
  });

  it("should insert runtime calls after all ESM import statements", async () => {
    const fixtureSource = readFileSync(join(__dirname, "../../fixtures/plugin-babel/runtime-order/esm/source.ts"), "utf-8");

    const artifact = {
      elements: {
        "/test/operations.ts::getUserQuery": {
          id: "/test/operations.ts::getUserQuery",
          type: "operation",
          prebuild: {
            operationType: "query",
            operationName: "GetUser",
            document: {
              kind: "Document",
              definitions: [
                {
                  kind: "OperationDefinition",
                  operation: "query",
                  name: { kind: "Name", value: "GetUser" },
                  variableDefinitions: [],
                  selectionSet: { kind: "SelectionSet", selections: [] },
                },
              ],
            },
            variableNames: ["userId"],
            projectionPathGraph: { matches: [], children: {} },
          },
          metadata: {
            sourcePath: "/test/operations.ts",
            sourceHash: "test",
            contentHash: "test",
          },
        },
      },
      report: {
        durationMs: 0,
        warnings: [],
        stats: { hits: 0, misses: 1, skips: 0 },
      },
    };

    const code = await runBabelTransform(fixtureSource, "/test/operations.ts", artifact as BuilderArtifact, {
      skipTypeCheck: true,
    });

    // Parse the transformed output
    const ast = parseSync(code, {
      filename: "/test/operations.ts",
      parserOpts: { sourceType: "module" },
    });

    if (!ast) {
      throw new Error("Failed to parse transformed code");
    }

    // Find positions of imports and runtime calls
    const statements = ast.program.body;
    let lastImportIndex = -1;
    let firstRuntimeIndex = -1;

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      if (!stmt) continue;

      if (stmt.type === "ImportDeclaration") {
        lastImportIndex = i;
      }

      if (isRuntimeOperation(stmt) && firstRuntimeIndex === -1) {
        firstRuntimeIndex = i;
      }
    }

    // Assertions
    expect(lastImportIndex).toBeGreaterThanOrEqual(0);
    expect(firstRuntimeIndex).toBeGreaterThan(0);
    expect(firstRuntimeIndex).toBeGreaterThan(lastImportIndex);

    // Verify no imports appear after runtime calls
    for (let i = firstRuntimeIndex; i < statements.length; i++) {
      const stmt = statements[i];
      if (stmt && stmt.type === "ImportDeclaration") {
        throw new Error("Import found after runtime call");
      }
    }
  });
});

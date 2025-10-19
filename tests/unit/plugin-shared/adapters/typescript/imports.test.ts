import { describe, expect, test } from "bun:test";
import ts from "typescript";
import {
  ensureGqlRuntimeRequire,
  ensureGqlRuntimeImport,
  maybeRemoveUnusedGqlImport,
} from "@soda-gql/plugin-shared/adapters/typescript/imports";

describe("ensureGqlRuntimeRequire", () => {
  const factory = ts.factory;

  test("should inject require statement when not present", () => {
    // Create a simple source file without any require
    const sourceFile = ts.createSourceFile(
      "test.ts",
      'export const foo = "bar";',
      ts.ScriptTarget.ES2020,
      true,
      ts.ScriptKind.TS,
    );

    const result = ensureGqlRuntimeRequire(sourceFile, factory, ts);

    // Print the result to string
    const printer = ts.createPrinter();
    const output = printer.printFile(result);

    // Should contain the require statement
    expect(output).toContain('const __soda_gql_runtime = require("@soda-gql/runtime")');

    // Should be at the beginning
    const lines = output.trim().split("\n");
    expect(lines[0]).toContain("const __soda_gql_runtime");

    // Original code should still be present
    expect(output).toContain('export const foo = "bar"');
  });

  test("should not duplicate require statement if already present", () => {
    // Create source file with existing require
    const sourceFile = ts.createSourceFile(
      "test.ts",
      'const __soda_gql_runtime = require("@soda-gql/runtime");\nexport const foo = "bar";',
      ts.ScriptTarget.ES2020,
      true,
      ts.ScriptKind.TS,
    );

    const result = ensureGqlRuntimeRequire(sourceFile, factory, ts);

    // Print the result
    const printer = ts.createPrinter();
    const output = printer.printFile(result);

    // Count occurrences of the require statement
    const matches = output.match(/const __soda_gql_runtime = require\("@soda-gql\/runtime"\)/g);
    expect(matches).toBeTruthy();
    expect(matches?.length).toBe(1);
  });

  test("should preserve other statements when injecting require", () => {
    const sourceFile = ts.createSourceFile(
      "test.ts",
      'const other = require("other-module");\nexport const foo = "bar";',
      ts.ScriptTarget.ES2020,
      true,
      ts.ScriptKind.TS,
    );

    const result = ensureGqlRuntimeRequire(sourceFile, factory, ts);
    const printer = ts.createPrinter();
    const output = printer.printFile(result);

    // Should have both require statements
    expect(output).toContain('const __soda_gql_runtime = require("@soda-gql/runtime")');
    expect(output).toContain('const other = require("other-module")');
    expect(output).toContain('export const foo = "bar"');
  });
});

describe("ensureGqlRuntimeImport", () => {
  const factory = ts.factory;

  test("should inject import statement when not present", () => {
    const sourceFile = ts.createSourceFile(
      "test.ts",
      'export const foo = "bar";',
      ts.ScriptTarget.ES2020,
      true,
      ts.ScriptKind.TS,
    );

    const result = ensureGqlRuntimeImport(sourceFile, factory, ts);
    const printer = ts.createPrinter();
    const output = printer.printFile(result);

    expect(output).toContain('import { gqlRuntime } from "@soda-gql/runtime"');
  });

  test("should add to existing import if present", () => {
    const sourceFile = ts.createSourceFile(
      "test.ts",
      'import { someOtherExport } from "@soda-gql/runtime";\nexport const foo = "bar";',
      ts.ScriptTarget.ES2020,
      true,
      ts.ScriptKind.TS,
    );

    const result = ensureGqlRuntimeImport(sourceFile, factory, ts);
    const printer = ts.createPrinter();
    const output = printer.printFile(result);

    // Should have merged import
    expect(output).toContain("someOtherExport");
    expect(output).toContain("gqlRuntime");
    expect(output).toContain('@soda-gql/runtime"');

    // Should only have one import from @soda-gql/runtime
    const matches = output.match(/from "@soda-gql\/runtime"/g);
    expect(matches?.length).toBe(1);
  });

  test("should not duplicate if gqlRuntime already imported", () => {
    const sourceFile = ts.createSourceFile(
      "test.ts",
      'import { gqlRuntime } from "@soda-gql/runtime";\nexport const foo = "bar";',
      ts.ScriptTarget.ES2020,
      true,
      ts.ScriptKind.TS,
    );

    const result = ensureGqlRuntimeImport(sourceFile, factory, ts);
    const printer = ts.createPrinter();
    const output = printer.printFile(result);

    // Should not duplicate
    const matches = output.match(/gqlRuntime/g);
    expect(matches?.length).toBe(1);
  });
});

describe("maybeRemoveUnusedGqlImport", () => {
  const factory = ts.factory;

  test("should remove ESM import for runtimeModule", () => {
    const sourceFile = ts.createSourceFile(
      "test.ts",
      'import { gql } from "@/graphql-system";\nimport { gqlRuntime } from "@soda-gql/runtime";\nexport const foo = "bar";',
      ts.ScriptTarget.ES2020,
      true,
      ts.ScriptKind.TS,
    );

    const result = maybeRemoveUnusedGqlImport(sourceFile, "@/graphql-system", factory, ts);
    const printer = ts.createPrinter();
    const output = printer.printFile(result);

    // Should not contain the graphql-system import
    expect(output).not.toContain('@/graphql-system"');
    expect(output).not.toContain('import { gql }');

    // Should still contain the runtime import and other code
    expect(output).toContain('@soda-gql/runtime"');
    expect(output).toContain("gqlRuntime");
    expect(output).toContain('export const foo = "bar"');
  });

  test("should remove CommonJS require for runtimeModule", () => {
    const sourceFile = ts.createSourceFile(
      "test.ts",
      'const graphql_system_1 = require("@/graphql-system");\nconst __soda_gql_runtime = require("@soda-gql/runtime");\nexport const foo = "bar";',
      ts.ScriptTarget.ES2020,
      true,
      ts.ScriptKind.TS,
    );

    const result = maybeRemoveUnusedGqlImport(sourceFile, "@/graphql-system", factory, ts);
    const printer = ts.createPrinter();
    const output = printer.printFile(result);

    // Should not contain the graphql-system require
    expect(output).not.toContain('require("@/graphql-system")');
    expect(output).not.toContain("graphql_system_1");

    // Should still contain the runtime require and other code
    expect(output).toContain('require("@soda-gql/runtime")');
    expect(output).toContain('export const foo = "bar"');
  });

  test("should remove __importDefault wrapped require", () => {
    const sourceFile = ts.createSourceFile(
      "test.ts",
      'const graphql_system_1 = __importDefault(require("@/graphql-system"));\nconst __soda_gql_runtime = require("@soda-gql/runtime");\nexport const foo = "bar";',
      ts.ScriptTarget.ES2020,
      true,
      ts.ScriptKind.TS,
    );

    const result = maybeRemoveUnusedGqlImport(sourceFile, "@/graphql-system", factory, ts);
    const printer = ts.createPrinter();
    const output = printer.printFile(result);

    // Should not contain the graphql-system require
    expect(output).not.toContain('require("@/graphql-system")');
    expect(output).not.toContain("graphql_system_1");
    expect(output).not.toContain("__importDefault");

    // Should still contain the runtime require
    expect(output).toContain('require("@soda-gql/runtime")');
  });

  test("should remove __importStar wrapped require", () => {
    const sourceFile = ts.createSourceFile(
      "test.ts",
      'const graphql_system_1 = __importStar(require("@/graphql-system"));\nconst __soda_gql_runtime = require("@soda-gql/runtime");\nexport const foo = "bar";',
      ts.ScriptTarget.ES2020,
      true,
      ts.ScriptKind.TS,
    );

    const result = maybeRemoveUnusedGqlImport(sourceFile, "@/graphql-system", factory, ts);
    const printer = ts.createPrinter();
    const output = printer.printFile(result);

    // Should not contain the graphql-system require
    expect(output).not.toContain('require("@/graphql-system")');
    expect(output).not.toContain("graphql_system_1");
    expect(output).not.toContain("__importStar");

    // Should still contain the runtime require
    expect(output).toContain('require("@soda-gql/runtime")');
  });

  test("should preserve other require statements", () => {
    const sourceFile = ts.createSourceFile(
      "test.ts",
      'const graphql_system_1 = require("@/graphql-system");\nconst other = require("other-module");\nexport const foo = "bar";',
      ts.ScriptTarget.ES2020,
      true,
      ts.ScriptKind.TS,
    );

    const result = maybeRemoveUnusedGqlImport(sourceFile, "@/graphql-system", factory, ts);
    const printer = ts.createPrinter();
    const output = printer.printFile(result);

    // Should remove only the graphql-system require
    expect(output).not.toContain('require("@/graphql-system")');

    // Should preserve other requires
    expect(output).toContain('require("other-module")');
    expect(output).toContain("const other");
  });

  test("should handle files without runtimeModule import", () => {
    const sourceFile = ts.createSourceFile(
      "test.ts",
      'import { gqlRuntime } from "@soda-gql/runtime";\nexport const foo = "bar";',
      ts.ScriptTarget.ES2020,
      true,
      ts.ScriptKind.TS,
    );

    const result = maybeRemoveUnusedGqlImport(sourceFile, "@/graphql-system", factory, ts);
    const printer = ts.createPrinter();
    const output = printer.printFile(result);

    // Should not change anything
    expect(output).toContain('@soda-gql/runtime"');
    expect(output).toContain('export const foo = "bar"');
  });
});

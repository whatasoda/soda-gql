import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { GraphqlSystemIdentifyHelper } from "@soda-gql/builder";
import { scanSourceFiles } from "./template-scanner";

const TEST_DIR = join(import.meta.dir, "../test/fixtures/.template-scanner-test");

const createTestHelper = (): GraphqlSystemIdentifyHelper => ({
  isGraphqlSystemFile: () => false,
  isGraphqlSystemImportSpecifier: ({ specifier }) => specifier === "./graphql-system" || specifier === "@/graphql-system",
  isInternalModuleFile: () => false,
});

describe("scanSourceFiles", () => {
  const helper = createTestHelper();

  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it("discovers and extracts templates from source files", () => {
    writeFileSync(
      join(TEST_DIR, "a.ts"),
      `
      import { gql } from "./graphql-system";
      export const GetUser = gql.default(({ query }) =>
        query\`query GetUser { user { id } }\`
      );
    `,
    );

    const result = scanSourceFiles({
      include: ["**/*.ts"],
      exclude: [],
      baseDir: TEST_DIR,
      helper,
    });

    expect(result.templates.size).toBe(1);
    const entries = [...result.templates.values()];
    expect(entries[0]).toHaveLength(1);
    expect(entries[0]![0]!.kind).toBe("query");
    expect(entries[0]![0]!.schemaName).toBe("default");
  });

  it("returns empty when no files match include patterns", () => {
    writeFileSync(join(TEST_DIR, "a.js"), "console.log('hello');");

    const result = scanSourceFiles({
      include: ["**/*.ts"],
      exclude: [],
      baseDir: TEST_DIR,
      helper,
    });

    expect(result.templates.size).toBe(0);
    expect(result.warnings).toHaveLength(0);
  });

  it("excludes files matching exclude patterns", () => {
    writeFileSync(
      join(TEST_DIR, "included.ts"),
      `
      import { gql } from "./graphql-system";
      export const A = gql.default(({ query }) => query\`query A { a }\`);
    `,
    );
    writeFileSync(
      join(TEST_DIR, "excluded.ts"),
      `
      import { gql } from "./graphql-system";
      export const B = gql.default(({ query }) => query\`query B { b }\`);
    `,
    );

    const result = scanSourceFiles({
      include: ["**/*.ts"],
      exclude: ["excluded.ts"],
      baseDir: TEST_DIR,
      helper,
    });

    expect(result.templates.size).toBe(1);
  });

  it("skips files without gql imports", () => {
    writeFileSync(join(TEST_DIR, "no-gql.ts"), "export const x = 42;");
    writeFileSync(
      join(TEST_DIR, "with-gql.ts"),
      `
      import { gql } from "./graphql-system";
      export const Q = gql.default(({ query }) => query\`query Q { q }\`);
    `,
    );

    const result = scanSourceFiles({
      include: ["**/*.ts"],
      exclude: [],
      baseDir: TEST_DIR,
      helper,
    });

    expect(result.templates.size).toBe(1);
  });

  it("handles multiple files with templates", () => {
    mkdirSync(join(TEST_DIR, "sub"), { recursive: true });
    writeFileSync(
      join(TEST_DIR, "a.ts"),
      `
      import { gql } from "./graphql-system";
      export const A = gql.default(({ query }) => query\`query A { a }\`);
    `,
    );
    writeFileSync(
      join(TEST_DIR, "sub/b.ts"),
      `
      import { gql } from "./graphql-system";
      export const B = gql.default(({ fragment }) => fragment\`fragment B on User { id }\`());
    `,
    );

    const result = scanSourceFiles({
      include: ["**/*.ts"],
      exclude: [],
      baseDir: TEST_DIR,
      helper,
    });

    expect(result.templates.size).toBe(2);
  });
});

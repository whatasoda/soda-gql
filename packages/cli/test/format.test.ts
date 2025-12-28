import { afterAll, describe, expect, it } from "vitest";
import { mkdirSync, rmSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createTempConfigFile } from "@soda-gql/config/test";
import { assertCliSuccess, getProjectRoot, runFormatCli } from "./utils/cli";

const projectRoot = getProjectRoot();

describe("soda-gql format CLI", () => {
  const tmpRoot = join(projectRoot, "tests/.tmp/format-cli-test");
  mkdirSync(tmpRoot, { recursive: true });

  describe("format mode", () => {
    it("formats files that need formatting", async () => {
      const caseDir = join(tmpRoot, `case-${Date.now()}`);
      mkdirSync(caseDir, { recursive: true });

      const testFile = join(caseDir, "test.ts");
      const unformatted = `import { gql } from "@/graphql-system";
export const model = gql.default(({ model }) => model.User({}, ({ f }) => [f.id(), f.name()]));
`;
      await writeFile(testFile, unformatted);

      const result = await runFormatCli([testFile]);

      assertCliSuccess(result);
      expect(result.stdout).toContain("1 formatted");

      const formatted = await readFile(testFile, "utf-8");
      expect(formatted).toContain("//");
    });

    it("reports unchanged for already formatted files", async () => {
      const caseDir = join(tmpRoot, `case-${Date.now()}`);
      mkdirSync(caseDir, { recursive: true });

      const testFile = join(caseDir, "test.ts");
      const alreadyFormatted = `import { gql } from "@/graphql-system";
export const model = gql.default(({ model }) =>
  model.User({}, ({ f }) => [
    //
    f.id(),
    f.name(),
  ]),
);
`;
      await writeFile(testFile, alreadyFormatted);

      const result = await runFormatCli([testFile]);

      assertCliSuccess(result);
      expect(result.stdout).toContain("1 unchanged");
    });

    it("handles multiple files via glob pattern", async () => {
      const caseDir = join(tmpRoot, `case-${Date.now()}`);
      mkdirSync(caseDir, { recursive: true });

      const file1 = join(caseDir, "a.ts");
      const file2 = join(caseDir, "b.ts");

      const unformatted = `import { gql } from "@/graphql-system";
export const model = gql.default(({ model }) => model.User({}, ({ f }) => [f.id()]));
`;
      await writeFile(file1, unformatted);
      await writeFile(file2, unformatted);

      const result = await runFormatCli([join(caseDir, "*.ts")]);

      assertCliSuccess(result);
      expect(result.stdout).toContain("2 file(s) checked");
      expect(result.stdout).toContain("2 formatted");
    });
  });

  describe("check mode", () => {
    it("exits 0 when all files are formatted", async () => {
      const caseDir = join(tmpRoot, `case-${Date.now()}`);
      mkdirSync(caseDir, { recursive: true });

      const testFile = join(caseDir, "test.ts");
      const alreadyFormatted = `import { gql } from "@/graphql-system";
export const model = gql.default(({ model }) =>
  model.User({}, ({ f }) => [
    //
    f.id(),
  ]),
);
`;
      await writeFile(testFile, alreadyFormatted);

      const result = await runFormatCli([testFile, "--check"]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("properly formatted");
    });

    it("exits 1 when files need formatting", async () => {
      const caseDir = join(tmpRoot, `case-${Date.now()}`);
      mkdirSync(caseDir, { recursive: true });

      const testFile = join(caseDir, "test.ts");
      const unformatted = `import { gql } from "@/graphql-system";
export const model = gql.default(({ model }) => model.User({}, ({ f }) => [f.id()]));
`;
      await writeFile(testFile, unformatted);

      const result = await runFormatCli([testFile, "--check"]);

      expect(result.exitCode).toBe(1);
      expect(result.stdout).toContain("need formatting");
    });

    it("does not modify files in check mode", async () => {
      const caseDir = join(tmpRoot, `case-${Date.now()}`);
      mkdirSync(caseDir, { recursive: true });

      const testFile = join(caseDir, "test.ts");
      const unformatted = `import { gql } from "@/graphql-system";
export const model = gql.default(({ model }) => model.User({}, ({ f }) => [f.id()]));
`;
      await writeFile(testFile, unformatted);

      await runFormatCli(["--check", testFile]);

      const content = await readFile(testFile, "utf-8");
      expect(content).toBe(unformatted);
    });
  });

  describe("error handling", () => {
    it("returns error when no patterns and no config", async () => {
      const caseDir = join(tmpRoot, `case-${Date.now()}`);
      mkdirSync(caseDir, { recursive: true });

      // Run from a directory without config
      const result = await runFormatCli([], { cwd: caseDir });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("NO_PATTERNS");
    });

    it("handles non-matching glob gracefully", async () => {
      const caseDir = join(tmpRoot, `case-${Date.now()}`);
      mkdirSync(caseDir, { recursive: true });

      const result = await runFormatCli([join(caseDir, "*.ts")]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("0 file(s) checked");
    });
  });

  describe("config-based patterns", () => {
    it("uses include patterns from config when no patterns provided", async () => {
      const caseDir = join(tmpRoot, `case-${Date.now()}`);
      const srcDir = join(caseDir, "src");
      mkdirSync(srcDir, { recursive: true });

      // Create test file
      const testFile = join(srcDir, "test.ts");
      const unformatted = `import { gql } from "@/graphql-system";
export const model = gql.default(({ model }) => model.User({}, ({ f }) => [f.id()]));
`;
      await writeFile(testFile, unformatted);

      // Create config with include pattern
      const configPath = createTempConfigFile(caseDir, {
        outdir: "./graphql-system",
        include: ["src/**/*.ts"],
        schemas: {
          default: {
            schema: "./schema.graphql",
            inject: { scalars: "./scalars.ts" },
          },
        },
      });

      const result = await runFormatCli(["--config", configPath]);

      assertCliSuccess(result);
      expect(result.stdout).toContain("1 formatted");
    });

    it("respects exclude patterns from config", async () => {
      const caseDir = join(tmpRoot, `case-${Date.now()}`);
      const srcDir = join(caseDir, "src");
      mkdirSync(srcDir, { recursive: true });

      // Create regular file and test file
      const regularFile = join(srcDir, "app.ts");
      const testFile = join(srcDir, "app.test.ts");
      const unformatted = `import { gql } from "@/graphql-system";
export const model = gql.default(({ model }) => model.User({}, ({ f }) => [f.id()]));
`;
      await writeFile(regularFile, unformatted);
      await writeFile(testFile, unformatted);

      // Create config that excludes test files
      const configPath = createTempConfigFile(caseDir, {
        outdir: "./graphql-system",
        include: ["src/**/*.ts"],
        exclude: ["src/**/*.test.ts"],
        schemas: {
          default: {
            schema: "./schema.graphql",
            inject: { scalars: "./scalars.ts" },
          },
        },
      });

      const result = await runFormatCli(["--config", configPath]);

      assertCliSuccess(result);
      // Only 1 file should be formatted (the test file is excluded)
      expect(result.stdout).toContain("1 file(s) checked");
      expect(result.stdout).toContain("1 formatted");
    });

    it("explicit patterns override config", async () => {
      const caseDir = join(tmpRoot, `case-${Date.now()}`);
      const srcDir = join(caseDir, "src");
      const libDir = join(caseDir, "lib");
      mkdirSync(srcDir, { recursive: true });
      mkdirSync(libDir, { recursive: true });

      const srcFile = join(srcDir, "app.ts");
      const libFile = join(libDir, "util.ts");
      const unformatted = `import { gql } from "@/graphql-system";
export const model = gql.default(({ model }) => model.User({}, ({ f }) => [f.id()]));
`;
      await writeFile(srcFile, unformatted);
      await writeFile(libFile, unformatted);

      // Config includes src, but we explicitly specify lib
      createTempConfigFile(caseDir, {
        outdir: "./graphql-system",
        include: ["src/**/*.ts"],
        schemas: {
          default: {
            schema: "./schema.graphql",
            inject: { scalars: "./scalars.ts" },
          },
        },
      });

      // Explicitly specify lib directory only
      const result = await runFormatCli([join(libDir, "*.ts")]);

      assertCliSuccess(result);
      expect(result.stdout).toContain("1 file(s) checked");
    });
  });

  afterAll(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });
});

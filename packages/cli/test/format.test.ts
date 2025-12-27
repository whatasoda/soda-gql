import { afterAll, describe, expect, it } from "bun:test";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
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
      await Bun.write(testFile, unformatted);

      const result = await runFormatCli([testFile]);

      assertCliSuccess(result);
      expect(result.stdout).toContain("1 formatted");

      const formatted = await Bun.file(testFile).text();
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
      await Bun.write(testFile, alreadyFormatted);

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
      await Bun.write(file1, unformatted);
      await Bun.write(file2, unformatted);

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
      await Bun.write(testFile, alreadyFormatted);

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
      await Bun.write(testFile, unformatted);

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
      await Bun.write(testFile, unformatted);

      await runFormatCli(["--check", testFile]);

      const content = await Bun.file(testFile).text();
      expect(content).toBe(unformatted);
    });
  });

  describe("error handling", () => {
    it("returns error when no patterns provided", async () => {
      const result = await runFormatCli([]);

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

  afterAll(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });
});

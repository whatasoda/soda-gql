import { afterAll, describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { getProjectRoot, runInitCli } from "../utils/cli";

const projectRoot = getProjectRoot();

describe("soda-gql init CLI", () => {
  const tmpRoot = join(projectRoot, "tests/.tmp/init-cli-test");
  mkdirSync(tmpRoot, { recursive: true });

  describe("initialization", () => {
    it("creates all required files in empty directory", async () => {
      const caseDir = join(tmpRoot, `case-${Date.now()}-1`);
      mkdirSync(caseDir, { recursive: true });

      const result = await runInitCli([], { cwd: caseDir });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("initialized successfully");

      expect(existsSync(join(caseDir, "soda-gql.config.ts"))).toBe(true);
      expect(existsSync(join(caseDir, "schema.graphql"))).toBe(true);
      expect(existsSync(join(caseDir, "graphql-system/default.inject.ts"))).toBe(true);
      expect(existsSync(join(caseDir, "graphql-system/.gitignore"))).toBe(true);
    });

    it("creates valid config that can be loaded", async () => {
      const caseDir = join(tmpRoot, `case-${Date.now()}-2`);
      mkdirSync(caseDir, { recursive: true });

      await runInitCli([], { cwd: caseDir });

      const configContent = await Bun.file(join(caseDir, "soda-gql.config.ts")).text();
      expect(configContent).toContain("defineConfig");
      expect(configContent).toContain("outdir");
      expect(configContent).toContain("schemas");
      expect(configContent).toContain("schema.graphql");
    });
  });

  describe("--force flag", () => {
    it("fails when files exist without --force", async () => {
      const caseDir = join(tmpRoot, `case-${Date.now()}-3`);
      mkdirSync(caseDir, { recursive: true });

      writeFileSync(join(caseDir, "soda-gql.config.ts"), "existing content");

      const result = await runInitCli([], { cwd: caseDir });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("FILE_EXISTS");
      expect(result.stderr).toContain("--force");
    });

    it("overwrites existing files with --force", async () => {
      const caseDir = join(tmpRoot, `case-${Date.now()}-4`);
      mkdirSync(caseDir, { recursive: true });

      writeFileSync(join(caseDir, "soda-gql.config.ts"), "old content");

      const result = await runInitCli(["--force"], { cwd: caseDir });

      expect(result.exitCode).toBe(0);

      const configContent = await Bun.file(join(caseDir, "soda-gql.config.ts")).text();
      expect(configContent).toContain("defineConfig");
      expect(configContent).not.toContain("old content");
    });
  });

  describe("help", () => {
    it("shows help with --help flag", async () => {
      const result = await runInitCli(["--help"], {});

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Initialize a new soda-gql project");
      expect(result.stdout).toContain("--force");
    });

    it("shows help with -h flag", async () => {
      const result = await runInitCli(["-h"], {});

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Initialize");
    });
  });

  describe("inject template content", () => {
    it("includes scalar and adapter exports", async () => {
      const caseDir = join(tmpRoot, `case-${Date.now()}-5`);
      mkdirSync(caseDir, { recursive: true });

      await runInitCli([], { cwd: caseDir });

      const injectContent = await Bun.file(join(caseDir, "graphql-system/default.inject.ts")).text();

      expect(injectContent).toContain("export const scalar");
      expect(injectContent).toContain("export const adapter");
      expect(injectContent).toContain("defineScalar");
      expect(injectContent).toContain("defineAdapter");
    });
  });

  describe("gitignore content", () => {
    it("ignores generated index files", async () => {
      const caseDir = join(tmpRoot, `case-${Date.now()}-6`);
      mkdirSync(caseDir, { recursive: true });

      await runInitCli([], { cwd: caseDir });

      const gitignoreContent = await Bun.file(join(caseDir, "graphql-system/.gitignore")).text();

      expect(gitignoreContent).toContain("/index.ts");
      expect(gitignoreContent).toContain("/index.cjs");
    });
  });

  afterAll(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });
});

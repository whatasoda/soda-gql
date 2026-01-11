/**
 * E2E tests using fixture-catalog.
 *
 * These tests verify that the fixture-catalog's graphql-system is correctly
 * generated and passes type checking. The fixture-catalog is pre-built with
 * codegen and typegen via `bun fixture:setup`.
 *
 * @module
 */

import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(fileURLToPath(import.meta.url), "../../../../..");
const fixtureCatalogRoot = join(projectRoot, "fixture-catalog");
const graphqlSystemDir = join(fixtureCatalogRoot, "graphql-system");
const tscPath = join(projectRoot, "node_modules/.bin/tsc");

describe("fixture-catalog typegen integration", () => {
  test("graphql-system directory exists and contains required files", () => {
    expect(existsSync(graphqlSystemDir)).toBe(true);
    expect(existsSync(join(graphqlSystemDir, "index.ts"))).toBe(true);
    expect(existsSync(join(graphqlSystemDir, "index.prebuilt.ts"))).toBe(true);
    expect(existsSync(join(graphqlSystemDir, "types.prebuilt.ts"))).toBe(true);
  });

  test("types.prebuilt.ts contains keyed fragments", () => {
    const typesContent = readFileSync(join(graphqlSystemDir, "types.prebuilt.ts"), "utf-8");

    // Check for keyed fragments from fragments/with-key/source.ts
    expect(typesContent).toContain('"KeyedUserFields"');
    expect(typesContent).toContain('"KeyedPostFields"');
    expect(typesContent).toContain("readonly fragments:");
  });

  test("types.prebuilt.ts contains named operations", () => {
    const typesContent = readFileSync(join(graphqlSystemDir, "types.prebuilt.ts"), "utf-8");

    // Check for named operations from various fixtures
    expect(typesContent).toContain('"GetUser"');
    expect(typesContent).toContain('"ProfilePageQuery"');
    expect(typesContent).toContain("readonly operations:");
  });

  test("fixture-catalog passes tsc --noEmit", async () => {
    const proc = Bun.spawn([tscPath, "--noEmit", "--project", fixtureCatalogRoot], {
      cwd: fixtureCatalogRoot,
      stdout: "pipe",
      stderr: "pipe",
    });

    const exitCode = await proc.exited;

    if (exitCode !== 0) {
      const stdout = await new Response(proc.stdout).text();
      const stderr = await new Response(proc.stderr).text();
      console.error("tsc errors:", stdout || stderr);
    }

    expect(exitCode).toBe(0);
  });
});

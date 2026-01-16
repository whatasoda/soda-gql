import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAliasResolver } from "./alias-resolver";

describe("createAliasResolver", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `alias-resolver-test-${Date.now()}`);
    await mkdir(join(testDir, "src", "utils"), { recursive: true });
    await mkdir(join(testDir, "src", "components"), { recursive: true });
    await mkdir(join(testDir, "lib"), { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  test("resolves exact match pattern", async () => {
    await writeFile(join(testDir, "src", "utils", "index.ts"), "export const x = 1;");

    const resolver = createAliasResolver({
      baseUrl: testDir,
      paths: {
        "@utils": [join(testDir, "src", "utils")],
      },
    });

    const result = resolver.resolve("@utils");
    expect(result).toBe(join(testDir, "src", "utils", "index.ts").replace(/\\/g, "/"));
  });

  test("resolves wildcard pattern", async () => {
    await writeFile(join(testDir, "src", "components", "Button.ts"), "export const Button = {};");

    const resolver = createAliasResolver({
      baseUrl: testDir,
      paths: {
        "@/*": [join(testDir, "src", "*")],
      },
    });

    const result = resolver.resolve("@/components/Button");
    expect(result).toBe(join(testDir, "src", "components", "Button.ts").replace(/\\/g, "/"));
  });

  test("resolves nested wildcard paths", async () => {
    await writeFile(join(testDir, "src", "components", "Button.ts"), "export const Button = {};");

    const resolver = createAliasResolver({
      baseUrl: testDir,
      paths: {
        "@components/*": [join(testDir, "src", "components", "*")],
      },
    });

    const result = resolver.resolve("@components/Button");
    expect(result).toBe(join(testDir, "src", "components", "Button.ts").replace(/\\/g, "/"));
  });

  test("tries multiple targets in order (fallback)", async () => {
    // Only create file in lib, not in src
    await writeFile(join(testDir, "lib", "helper.ts"), "export const helper = 1;");

    const resolver = createAliasResolver({
      baseUrl: testDir,
      paths: {
        "@/*": [
          join(testDir, "src", "*"), // doesn't exist
          join(testDir, "lib", "*"), // exists
        ],
      },
    });

    const result = resolver.resolve("@/helper");
    expect(result).toBe(join(testDir, "lib", "helper.ts").replace(/\\/g, "/"));
  });

  test("returns null for unmatched pattern", async () => {
    const resolver = createAliasResolver({
      baseUrl: testDir,
      paths: {
        "@/*": [join(testDir, "src", "*")],
      },
    });

    const result = resolver.resolve("lodash");
    expect(result).toBeNull();
  });

  test("returns null when file doesn't exist", async () => {
    const resolver = createAliasResolver({
      baseUrl: testDir,
      paths: {
        "@/*": [join(testDir, "src", "*")],
      },
    });

    const result = resolver.resolve("@/nonexistent");
    expect(result).toBeNull();
  });

  test("first pattern match wins", async () => {
    // Create files in both locations
    await writeFile(join(testDir, "src", "a.ts"), "export const a = 'src';");
    await writeFile(join(testDir, "lib", "a.ts"), "export const a = 'lib';");

    const resolver = createAliasResolver({
      baseUrl: testDir,
      paths: {
        // First pattern matches first
        "@/*": [join(testDir, "src", "*")],
        // This pattern would also match but comes second
        "@/a": [join(testDir, "lib", "a")],
      },
    });

    const result = resolver.resolve("@/a");
    // Should resolve to src/a.ts because first pattern matches first
    expect(result).toBe(join(testDir, "src", "a.ts").replace(/\\/g, "/"));
  });

  test("resolves with .tsx extension", async () => {
    await writeFile(join(testDir, "src", "components", "Button.tsx"), "export const Button = () => null;");

    const resolver = createAliasResolver({
      baseUrl: testDir,
      paths: {
        "@/*": [join(testDir, "src", "*")],
      },
    });

    const result = resolver.resolve("@/components/Button");
    expect(result).toBe(join(testDir, "src", "components", "Button.tsx").replace(/\\/g, "/"));
  });

  test("handles ESM-style .js extension in alias", async () => {
    // Import specifier uses .js but actual file is .ts
    await writeFile(join(testDir, "src", "utils", "helper.ts"), "export const helper = 1;");

    const resolver = createAliasResolver({
      baseUrl: testDir,
      paths: {
        "@/*": [join(testDir, "src", "*")],
      },
    });

    const result = resolver.resolve("@/utils/helper.js");
    expect(result).toBe(join(testDir, "src", "utils", "helper.ts").replace(/\\/g, "/"));
  });

  test("resolves directory with index file", async () => {
    await writeFile(join(testDir, "src", "utils", "index.ts"), "export const utils = {};");

    const resolver = createAliasResolver({
      baseUrl: testDir,
      paths: {
        "@/*": [join(testDir, "src", "*")],
      },
    });

    const result = resolver.resolve("@/utils");
    expect(result).toBe(join(testDir, "src", "utils", "index.ts").replace(/\\/g, "/"));
  });

  test("prefers file with extension over directory", async () => {
    // Create both utils.ts and utils/index.ts
    await writeFile(join(testDir, "src", "utils.ts"), "export const utils = 'file';");
    await writeFile(join(testDir, "src", "utils", "index.ts"), "export const utils = 'dir';");

    const resolver = createAliasResolver({
      baseUrl: testDir,
      paths: {
        "@/*": [join(testDir, "src", "*")],
      },
    });

    const result = resolver.resolve("@/utils");
    // File with extension should be found first
    expect(result).toBe(join(testDir, "src", "utils.ts").replace(/\\/g, "/"));
  });

  test("handles path with explicit .ts extension", async () => {
    await writeFile(join(testDir, "src", "helper.ts"), "export const helper = 1;");

    const resolver = createAliasResolver({
      baseUrl: testDir,
      paths: {
        "@/*": [join(testDir, "src", "*")],
      },
    });

    // Explicit .ts extension should work
    const result = resolver.resolve("@/helper.ts");
    expect(result).toBe(join(testDir, "src", "helper.ts").replace(/\\/g, "/"));
  });
});

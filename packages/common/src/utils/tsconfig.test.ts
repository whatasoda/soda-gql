import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readTsconfigPaths } from "./tsconfig";

describe("readTsconfigPaths", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `tsconfig-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  test("reads paths from tsconfig.json", async () => {
    const tsconfig = {
      compilerOptions: {
        baseUrl: ".",
        paths: {
          "@/*": ["./src/*"],
          "@utils": ["./src/utils"],
        },
      },
    };
    await writeFile(join(testDir, "tsconfig.json"), JSON.stringify(tsconfig));

    const result = readTsconfigPaths(join(testDir, "tsconfig.json"));
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toEqual({
      baseUrl: testDir,
      paths: {
        "@/*": [join(testDir, "src/*")],
        "@utils": [join(testDir, "src/utils")],
      },
    });
  });

  test("returns null when no paths defined", async () => {
    const tsconfig = {
      compilerOptions: {
        target: "ES2020",
      },
    };
    await writeFile(join(testDir, "tsconfig.json"), JSON.stringify(tsconfig));

    const result = readTsconfigPaths(join(testDir, "tsconfig.json"));
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toBeNull();
  });

  test("returns null when compilerOptions is missing", async () => {
    const tsconfig = {};
    await writeFile(join(testDir, "tsconfig.json"), JSON.stringify(tsconfig));

    const result = readTsconfigPaths(join(testDir, "tsconfig.json"));
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toBeNull();
  });

  test("handles tsconfig with comments", async () => {
    const content = `{
      // This is a line comment
      "compilerOptions": {
        "baseUrl": ".",
        /* Block comment */
        "paths": {
          "@/*": ["./src/*"]
        }
      }
    }`;
    await writeFile(join(testDir, "tsconfig.json"), content);

    const result = readTsconfigPaths(join(testDir, "tsconfig.json"));
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toEqual({
      baseUrl: testDir,
      paths: {
        "@/*": [join(testDir, "src/*")],
      },
    });
  });

  test("handles tsconfig with trailing commas", async () => {
    const content = `{
      "compilerOptions": {
        "baseUrl": ".",
        "paths": {
          "@/*": ["./src/*"],
        },
      },
    }`;
    await writeFile(join(testDir, "tsconfig.json"), content);

    const result = readTsconfigPaths(join(testDir, "tsconfig.json"));
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()?.paths).toEqual({
      "@/*": [join(testDir, "src/*")],
    });
  });

  test("resolves paths relative to baseUrl", async () => {
    const tsconfig = {
      compilerOptions: {
        baseUrl: "./src",
        paths: {
          "@/*": ["./*"],
          "@lib/*": ["../lib/*"],
        },
      },
    };
    await writeFile(join(testDir, "tsconfig.json"), JSON.stringify(tsconfig));

    const result = readTsconfigPaths(join(testDir, "tsconfig.json"));
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toEqual({
      baseUrl: join(testDir, "src"),
      paths: {
        "@/*": [join(testDir, "src/*")],
        "@lib/*": [join(testDir, "lib/*")],
      },
    });
  });

  test("uses tsconfig directory as baseUrl when not specified", async () => {
    const tsconfig = {
      compilerOptions: {
        paths: {
          "@/*": ["./src/*"],
        },
      },
    };
    await writeFile(join(testDir, "tsconfig.json"), JSON.stringify(tsconfig));

    const result = readTsconfigPaths(join(testDir, "tsconfig.json"));
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toEqual({
      baseUrl: testDir,
      paths: {
        "@/*": [join(testDir, "src/*")],
      },
    });
  });

  test("handles multiple path targets (fallbacks)", async () => {
    const tsconfig = {
      compilerOptions: {
        baseUrl: ".",
        paths: {
          "@/*": ["./src/*", "./lib/*", "./shared/*"],
        },
      },
    };
    await writeFile(join(testDir, "tsconfig.json"), JSON.stringify(tsconfig));

    const result = readTsconfigPaths(join(testDir, "tsconfig.json"));
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()?.paths["@/*"]).toEqual([
      join(testDir, "src/*"),
      join(testDir, "lib/*"),
      join(testDir, "shared/*"),
    ]);
  });

  test("returns error for non-existent file", async () => {
    const result = readTsconfigPaths(join(testDir, "nonexistent.json"));
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("TSCONFIG_READ_FAILED");
  });

  test("returns error for invalid JSON", async () => {
    await writeFile(join(testDir, "tsconfig.json"), "{ invalid }");

    const result = readTsconfigPaths(join(testDir, "tsconfig.json"));
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("TSCONFIG_PARSE_FAILED");
  });

  test("returns error for non-object tsconfig", async () => {
    await writeFile(join(testDir, "tsconfig.json"), '"string"');

    const result = readTsconfigPaths(join(testDir, "tsconfig.json"));
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("TSCONFIG_INVALID");
  });
});

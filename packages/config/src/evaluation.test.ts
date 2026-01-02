import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { executeConfigFile } from "./evaluation";

describe("evaluation.ts", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `soda-gql-config-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe("environment variable access", () => {
    test("config file can access process.env", async () => {
      // Set a test environment variable
      const testEnvValue = `test-value-${Date.now()}`;
      process.env.SODA_GQL_TEST_VAR = testEnvValue;

      try {
        const configPath = join(testDir, "soda-gql.config.ts");
        await writeFile(
          configPath,
          `
import { defineConfig } from "@soda-gql/config";

const envValue = process.env.SODA_GQL_TEST_VAR;

export default defineConfig({
  outdir: envValue || "./default",
  include: ["./src/**/*.ts"],
  schemas: {
    default: {
      schema: "./schema.graphql",
      inject: { scalars: "./scalars.ts" },
    },
  },
});
        `.trim(),
        );

        const result = executeConfigFile(configPath);

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          expect(result.value.outdir).toBe(testEnvValue);
        }
      } finally {
        delete process.env.SODA_GQL_TEST_VAR;
      }
    });

    test("config file can use process.env for conditional artifact config", async () => {
      // Simulate CI environment
      process.env.CI = "true";

      try {
        const configPath = join(testDir, "soda-gql.config.ts");
        await writeFile(
          configPath,
          `
import { defineConfig } from "@soda-gql/config";

export default defineConfig({
  outdir: "./graphql-system",
  include: ["./src/**/*.ts"],
  schemas: {
    default: {
      schema: "./schema.graphql",
      inject: { scalars: "./scalars.ts" },
    },
  },
  artifact: process.env.CI
    ? { path: "./dist/soda-gql-artifact.json" }
    : undefined,
});
        `.trim(),
        );

        const result = executeConfigFile(configPath);

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          expect(result.value.artifact).toEqual({
            path: "./dist/soda-gql-artifact.json",
          });
        }
      } finally {
        delete process.env.CI;
      }
    });

    test("config file artifact is undefined when CI is not set", async () => {
      // Ensure CI is not set
      delete process.env.CI;

      const configPath = join(testDir, "soda-gql.config.ts");
      await writeFile(
        configPath,
        `
import { defineConfig } from "@soda-gql/config";

export default defineConfig({
  outdir: "./graphql-system",
  include: ["./src/**/*.ts"],
  schemas: {
    default: {
      schema: "./schema.graphql",
      inject: { scalars: "./scalars.ts" },
    },
  },
  artifact: process.env.CI
    ? { path: "./dist/soda-gql-artifact.json" }
    : undefined,
});
        `.trim(),
      );

      const result = executeConfigFile(configPath);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.artifact).toBeUndefined();
      }
    });

    test("config file can use process.env.NODE_ENV for environment-based config", async () => {
      process.env.NODE_ENV = "production";

      try {
        const configPath = join(testDir, "soda-gql.config.ts");
        await writeFile(
          configPath,
          `
import { defineConfig } from "@soda-gql/config";

const isProduction = process.env.NODE_ENV === "production";

export default defineConfig({
  outdir: "./graphql-system",
  include: ["./src/**/*.ts"],
  schemas: {
    default: {
      schema: "./schema.graphql",
      inject: { scalars: "./scalars.ts" },
    },
  },
  artifact: isProduction
    ? { path: "./dist/artifact.json" }
    : undefined,
});
        `.trim(),
        );

        const result = executeConfigFile(configPath);

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          expect(result.value.artifact).toEqual({
            path: "./dist/artifact.json",
          });
        }
      } finally {
        delete process.env.NODE_ENV;
      }
    });
  });

  describe("config loading", () => {
    test("loads valid TypeScript config file", async () => {
      const configPath = join(testDir, "soda-gql.config.ts");
      await writeFile(
        configPath,
        `
import { defineConfig } from "@soda-gql/config";

export default defineConfig({
  outdir: "./graphql-system",
  include: ["./src/**/*.ts"],
  schemas: {
    default: {
      schema: "./schema.graphql",
      inject: { scalars: "./scalars.ts" },
    },
  },
});
        `.trim(),
      );

      const result = executeConfigFile(configPath);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.outdir).toBe("./graphql-system");
        expect(result.value.include).toEqual(["./src/**/*.ts"]);
      }
    });

    test("returns error for non-existent file", async () => {
      const configPath = join(testDir, "non-existent.config.ts");

      const result = executeConfigFile(configPath);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("CONFIG_LOAD_FAILED");
      }
    });

    test("returns error for invalid config", async () => {
      const configPath = join(testDir, "soda-gql.config.ts");
      await writeFile(
        configPath,
        `
export default { invalid: true };
        `.trim(),
      );

      const result = executeConfigFile(configPath);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("CONFIG_LOAD_FAILED");
      }
    });
  });
});

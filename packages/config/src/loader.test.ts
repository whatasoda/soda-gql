import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { findAllConfigFiles, findConfigFile } from "./loader";

const tmpDir = join(import.meta.dir, "__test_fixtures_loader__");

beforeAll(() => {
  // Create fixture directory structure:
  // __test_fixtures_loader__/
  //   soda-gql.config.ts         (root config)
  //   packages/
  //     app-a/
  //       soda-gql.config.ts     (nested config)
  //     app-b/
  //       soda-gql.config.mts    (nested config, different extension)
  //     lib-no-config/
  //       src/
  //         index.ts
  //   node_modules/
  //     some-pkg/
  //       soda-gql.config.ts     (should be skipped)
  //   .hidden/
  //     soda-gql.config.ts       (should be skipped)
  //   dist/
  //     soda-gql.config.ts       (should be skipped)

  rmSync(tmpDir, { recursive: true, force: true });

  mkdirSync(join(tmpDir, "packages/app-a"), { recursive: true });
  mkdirSync(join(tmpDir, "packages/app-b"), { recursive: true });
  mkdirSync(join(tmpDir, "packages/lib-no-config/src"), { recursive: true });
  mkdirSync(join(tmpDir, "node_modules/some-pkg"), { recursive: true });
  mkdirSync(join(tmpDir, ".hidden"), { recursive: true });
  mkdirSync(join(tmpDir, "dist"), { recursive: true });

  writeFileSync(join(tmpDir, "soda-gql.config.ts"), "export default {}");
  writeFileSync(join(tmpDir, "packages/app-a/soda-gql.config.ts"), "export default {}");
  writeFileSync(join(tmpDir, "packages/app-b/soda-gql.config.mts"), "export default {}");
  writeFileSync(join(tmpDir, "packages/lib-no-config/src/index.ts"), "export {}");
  writeFileSync(join(tmpDir, "node_modules/some-pkg/soda-gql.config.ts"), "export default {}");
  writeFileSync(join(tmpDir, ".hidden/soda-gql.config.ts"), "export default {}");
  writeFileSync(join(tmpDir, "dist/soda-gql.config.ts"), "export default {}");
});

afterAll(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("findAllConfigFiles", () => {
  test("discovers multiple config files in nested directories", () => {
    const results = findAllConfigFiles(tmpDir);

    expect(results).toContain(join(tmpDir, "soda-gql.config.ts"));
    expect(results).toContain(join(tmpDir, "packages/app-a/soda-gql.config.ts"));
    expect(results).toContain(join(tmpDir, "packages/app-b/soda-gql.config.mts"));
    expect(results).toHaveLength(3);
  });

  test("skips node_modules directories", () => {
    const results = findAllConfigFiles(tmpDir);

    const nodeModulesConfig = results.find((p) => p.includes("node_modules"));
    expect(nodeModulesConfig).toBeUndefined();
  });

  test("skips dot-prefixed directories", () => {
    const results = findAllConfigFiles(tmpDir);

    const hiddenConfig = results.find((p) => p.includes(".hidden"));
    expect(hiddenConfig).toBeUndefined();
  });

  test("skips dist directories", () => {
    const results = findAllConfigFiles(tmpDir);

    const distConfig = results.find((p) => p.includes("dist"));
    expect(distConfig).toBeUndefined();
  });

  test("returns empty array when no configs exist", () => {
    const results = findAllConfigFiles(join(tmpDir, "packages/lib-no-config"));

    expect(results).toHaveLength(0);
  });

  test("returns single config when only root has one", () => {
    // Create a temp dir with only a root config
    const singleDir = join(tmpDir, "__single__");
    mkdirSync(join(singleDir, "src"), { recursive: true });
    writeFileSync(join(singleDir, "soda-gql.config.ts"), "export default {}");
    writeFileSync(join(singleDir, "src/index.ts"), "export {}");

    const results = findAllConfigFiles(singleDir);

    expect(results).toHaveLength(1);
    expect(results[0]).toBe(join(singleDir, "soda-gql.config.ts"));

    rmSync(singleDir, { recursive: true, force: true });
  });
});

describe("findConfigFile", () => {
  test("finds config file in current directory", () => {
    const result = findConfigFile(tmpDir);

    expect(result).toBe(join(tmpDir, "soda-gql.config.ts"));
  });

  test("walks up to find config from subdirectory", () => {
    const result = findConfigFile(join(tmpDir, "packages/lib-no-config/src"));

    expect(result).toBe(join(tmpDir, "soda-gql.config.ts"));
  });

  test("finds nearest config first", () => {
    const result = findConfigFile(join(tmpDir, "packages/app-a"));

    expect(result).toBe(join(tmpDir, "packages/app-a/soda-gql.config.ts"));
  });
});

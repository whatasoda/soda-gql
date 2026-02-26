import { describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, normalize, resolve } from "node:path";
import { resolveEntryPaths } from "./entry-paths";

const fixtureRoot = join(process.cwd(), ".cache", "test", "entry-paths");

const toPosix = (p: string) => normalize(resolve(p)).replace(/\\/g, "/");

const setup = () => {
  rmSync(fixtureRoot, { recursive: true, force: true });
  mkdirSync(join(fixtureRoot, "sub"), { recursive: true });

  writeFileSync(join(fixtureRoot, "a.ts"), "export const a = 1;");
  writeFileSync(join(fixtureRoot, "b.ts"), "export const b = 2;");
  writeFileSync(join(fixtureRoot, "c.ts"), "export const c = 3;");
  writeFileSync(join(fixtureRoot, "excluded.ts"), "export const excluded = true;");
  writeFileSync(join(fixtureRoot, "sub", "d.ts"), "export const d = 4;");
};

describe("resolveEntryPaths", () => {
  describe("basic resolution", () => {
    test("resolves direct file paths", () => {
      setup();
      const result = resolveEntryPaths([join(fixtureRoot, "a.ts"), join(fixtureRoot, "b.ts")]);

      expect(result.isOk()).toBe(true);
      const paths = result._unsafeUnwrap();
      expect(paths).toContain(toPosix(join(fixtureRoot, "a.ts")));
      expect(paths).toContain(toPosix(join(fixtureRoot, "b.ts")));
      expect(paths).toHaveLength(2);
    });

    test("resolves glob patterns", () => {
      setup();
      const result = resolveEntryPaths([join(fixtureRoot, "*.ts")]);

      expect(result.isOk()).toBe(true);
      const paths = result._unsafeUnwrap();
      expect(paths.length).toBeGreaterThanOrEqual(4);
      expect(paths).toContain(toPosix(join(fixtureRoot, "a.ts")));
    });

    test("returns error when no files match", () => {
      setup();
      const result = resolveEntryPaths([join(fixtureRoot, "nonexistent-*.xyz")]);

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe("ENTRY_NOT_FOUND");
    });
  });

  describe("exclude patterns", () => {
    test("excludes files matching exclude patterns", () => {
      setup();
      const result = resolveEntryPaths([join(fixtureRoot, "*.ts")], [join(fixtureRoot, "excluded.ts")]);

      expect(result.isOk()).toBe(true);
      const paths = result._unsafeUnwrap();
      expect(paths).not.toContain(toPosix(join(fixtureRoot, "excluded.ts")));
      expect(paths).toContain(toPosix(join(fixtureRoot, "a.ts")));
    });

    test("excludes files matching glob exclude patterns", () => {
      setup();
      const result = resolveEntryPaths([join(fixtureRoot, "**/*.ts")], [join(fixtureRoot, "sub/**")]);

      expect(result.isOk()).toBe(true);
      const paths = result._unsafeUnwrap();
      expect(paths).not.toContain(toPosix(join(fixtureRoot, "sub", "d.ts")));
      expect(paths).toContain(toPosix(join(fixtureRoot, "a.ts")));
    });

    test("exclude patterns with leading ! are passed through as-is (still excludes)", () => {
      setup();
      // When exclude already has !, it is passed as-is (not double-negated)
      // so it still acts as a negation glob that excludes the file
      const result = resolveEntryPaths([join(fixtureRoot, "*.ts")], [`!${join(fixtureRoot, "a.ts")}`]);

      expect(result.isOk()).toBe(true);
      const paths = result._unsafeUnwrap();
      // a.ts is excluded because the pattern is passed as a negation glob
      expect(paths).not.toContain(toPosix(join(fixtureRoot, "a.ts")));
      expect(paths).toContain(toPosix(join(fixtureRoot, "b.ts")));
    });
  });

  describe("negation globs in entries", () => {
    test("negation patterns exclude matching files", () => {
      setup();
      const result = resolveEntryPaths([join(fixtureRoot, "*.ts"), `!${join(fixtureRoot, "excluded.ts")}`]);

      expect(result.isOk()).toBe(true);
      const paths = result._unsafeUnwrap();
      expect(paths).not.toContain(toPosix(join(fixtureRoot, "excluded.ts")));
      expect(paths).toContain(toPosix(join(fixtureRoot, "a.ts")));
    });
  });

  describe("mixed direct paths, globs, and excludes", () => {
    test("combines direct paths with glob matches and applies excludes", () => {
      setup();
      const directPath = join(fixtureRoot, "a.ts");
      const result = resolveEntryPaths([directPath, join(fixtureRoot, "sub/*.ts")], [join(fixtureRoot, "sub/d.ts")]);

      expect(result.isOk()).toBe(true);
      const paths = result._unsafeUnwrap();
      // Direct path should be included
      expect(paths).toContain(toPosix(directPath));
      // Note: direct paths are not affected by exclude patterns
      // (exclude only applies to glob results)
    });

    test("direct paths are not filtered by exclude patterns", () => {
      setup();
      const directPath = join(fixtureRoot, "excluded.ts");
      const result = resolveEntryPaths([directPath], [join(fixtureRoot, "excluded.ts")]);

      expect(result.isOk()).toBe(true);
      const paths = result._unsafeUnwrap();
      // Direct paths bypass exclude filtering
      expect(paths).toContain(toPosix(directPath));
    });
  });
});

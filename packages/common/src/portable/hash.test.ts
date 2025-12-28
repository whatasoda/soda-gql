import { beforeEach, describe, expect, test } from "vitest";
import { __resetPortableHasherForTests, createPortableHasher } from "./hash";

describe("PortableHasher", () => {
  beforeEach(() => {
    __resetPortableHasherForTests();
  });

  test("generates consistent sha256 hashes", () => {
    const hasher = createPortableHasher();
    const content = "test content";

    const hash1 = hasher.hash(content, "sha256");
    const hash2 = hasher.hash(content, "sha256");

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // SHA256 = 64 hex chars
  });

  test("generates consistent xxhash hashes", () => {
    const hasher = createPortableHasher();
    const content = "test content";

    const hash1 = hasher.hash(content, "xxhash");
    const hash2 = hasher.hash(content, "xxhash");

    expect(hash1).toBe(hash2);
  });

  test("different content produces different hashes", () => {
    const hasher = createPortableHasher();

    const hash1 = hasher.hash("content A", "sha256");
    const hash2 = hasher.hash("content B", "sha256");

    expect(hash1).not.toBe(hash2);
  });

  test("default algorithm is xxhash", () => {
    const hasher = createPortableHasher();
    const content = "test";

    const hashDefault = hasher.hash(content);
    const hashXxhash = hasher.hash(content, "xxhash");

    expect(hashDefault).toBe(hashXxhash);
  });

  test("sha256 produces known hash", () => {
    const hasher = createPortableHasher();
    // Known SHA256 hash for "hello world"
    const hash = hasher.hash("hello world", "sha256");

    expect(hash).toBe("b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9");
  });
});

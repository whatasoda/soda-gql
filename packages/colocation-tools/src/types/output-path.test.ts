import { describe, expect, it } from "bun:test";
import type { InferByOutputPath, InferPathsOutput } from "./output-path";

// Type-level tests for output-path types
// These tests verify compile-time type inference

type TestOutput = {
  user: {
    id: string;
    name: string;
    posts?: { title: string }[];
  };
};

type Check<T extends [expected: unknown, received: unknown]> = [T[0], T[1]] extends [T[1], T[0]] ? true : false;

// Type-level assertions (compile errors if types are wrong)

// Test InferByOutputPath - simple field
type _Test1 = Check<[string, InferByOutputPath<TestOutput, "$.user.id">]>;
const _check1: _Test1 = true;

// Test InferByOutputPath - array field
type _Test2 = Check<[{ title: string }[], InferByOutputPath<TestOutput, "$.user.posts">]>;
const _check2: _Test2 = true;

// Test InferByOutputPath - nested in array
type _Test3 = Check<[string, InferByOutputPath<TestOutput, "$.user.posts.title">]>;
const _check3: _Test3 = false;

// Test InferPathsOutput - tuple inference
type _Test4 = Check<[[string, string], InferPathsOutput<TestOutput, ["$.user.id", "$.user.name"]>]>;
const _check4: _Test4 = true;

// Test InferByOutputPath - root path
type _Test5 = Check<[TestOutput, InferByOutputPath<TestOutput, "$">]>;
const _check5: _Test5 = true;

describe("InferByOutputPath", () => {
  it("should infer correct types at paths (type-level test)", () => {
    // Type assertions verified at compile time via const assignments above
    expect(_check1).toBe(true);
    expect(_check2).toBe(true);
    expect(_check3).toBe(false);
    expect(_check5).toBe(true);
  });
});

describe("InferPathsOutput", () => {
  it("should infer tuple of types from tuple of paths (type-level test)", () => {
    expect(_check4).toBe(true);
  });
});

import { describe, expect, test } from "bun:test";
import { spawn } from "@soda-gql/common";

describe("spawn", () => {
  test("executes command and captures stdout", async () => {
    const result = await spawn({
      cmd: ["echo", "hello world"],
    });

    expect(result.stdout.trim()).toBe("hello world");
    expect(result.exitCode).toBe(0);
  });

  test("captures stderr", async () => {
    // Use a command that writes to stderr
    const result = await spawn({
      cmd: ["sh", "-c", "echo 'error message' >&2"],
    });

    expect(result.stderr).toContain("error message");
    expect(result.exitCode).toBe(0);
  });

  test("captures exit code on failure", async () => {
    const result = await spawn({
      cmd: ["sh", "-c", "exit 42"],
    });

    expect(result.exitCode).toBe(42);
  });

  test("respects cwd option", async () => {
    const result = await spawn({
      cmd: ["pwd"],
      cwd: "/tmp",
    });

    // On macOS, /tmp is a symlink to /private/tmp
    const output = result.stdout.trim();
    expect(output === "/tmp" || output === "/private/tmp").toBe(true);
  });

  test("respects env option", async () => {
    const result = await spawn({
      cmd: ["sh", "-c", "echo $TEST_VAR"],
      env: { TEST_VAR: "test_value" },
    });

    expect(result.stdout.trim()).toBe("test_value");
  });
});

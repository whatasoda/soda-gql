import { describe, expect, it } from "bun:test";
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type CliResult = {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
};

const projectRoot = fileURLToPath(new URL("../../", import.meta.url));
const fixturesRoot = join(projectRoot, "tests", "fixtures", "runtime-app");
const tmpRoot = join(projectRoot, "tests", ".tmp", "integration");

const runCodegenCli = async (args: readonly string[]): Promise<CliResult> => {
  const subprocess = Bun.spawn({
    cmd: ["bun", "run", "soda-gql", "codegen", ...args],
    cwd: projectRoot,
    stdio: ["ignore", "pipe", "pipe"],
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(subprocess.stdout).text(),
    new Response(subprocess.stderr).text(),
    subprocess.exited,
  ]);

  return { stdout, stderr, exitCode };
};

const runBuilderCli = async (
  workspaceRoot: string,
  args: readonly string[],
): Promise<CliResult> => {
  const subprocess = Bun.spawn({
    cmd: ["bun", "run", "soda-gql", "builder", ...args],
    cwd: projectRoot,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      NODE_PATH: [
        join(workspaceRoot, "node_modules"),
        process.env.NODE_PATH ?? "",
      ]
        .filter(Boolean)
        .join(":"),
    },
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(subprocess.stdout).text(),
    new Response(subprocess.stderr).text(),
    subprocess.exited,
  ]);

  return { stdout, stderr, exitCode };
};

const copyFixtureWorkspace = (name: string) => {
  mkdirSync(tmpRoot, { recursive: true });
  const workspaceRoot = resolve(tmpRoot, `${name}-${Date.now()}`);
  rmSync(workspaceRoot, { recursive: true, force: true });
  cpSync(fixturesRoot, workspaceRoot, { recursive: true });
  return workspaceRoot;
};

describe("runtime builder flow", () => {
  it("runs codegen then builder runtime to produce artifact", async () => {
    const workspace = copyFixtureWorkspace("runtime-flow");

    const graphqlSystemDir = join(workspace, "node_modules", "@", "graphql-system");
    mkdirSync(graphqlSystemDir, { recursive: true });
    const graphqlSystemEntry = join(graphqlSystemDir, "index.ts");

    const codegenResult = await runCodegenCli([
      "--schema",
      join(workspace, "schema.graphql"),
      "--out",
      graphqlSystemEntry,
      "--format",
      "json",
    ]);

    expect(codegenResult.exitCode).toBe(0);
    const generatedExists = await Bun.file(graphqlSystemEntry).exists();
    expect(generatedExists).toBe(true);

    const artifactDir = join(workspace, ".cache", "soda-gql");
    mkdirSync(artifactDir, { recursive: true });
    const artifactPath = join(artifactDir, "runtime.json");

    const builderResult = await runBuilderCli(workspace, [
      "--mode",
      "runtime",
      "--entry",
      join(workspace, "src", "pages", "profile.page.ts"),
      "--out",
      artifactPath,
      "--format",
      "json",
    ]);

    expect(builderResult.exitCode).toBe(0);
    const artifactExists = await Bun.file(artifactPath).exists();
    expect(artifactExists).toBe(true);

    const artifact = JSON.parse(await Bun.file(artifactPath).text());
    expect(artifact.documents.ProfilePageQuery.text).toContain("ProfilePageQuery");
    expect(artifact.refs).toHaveProperty(
      `${join(workspace, "src", "pages", "profile.query.ts")}::profileQuery`,
    );
    expect(Array.isArray(artifact.report.warnings)).toBe(true);
  });
});

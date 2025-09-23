import { afterAll, beforeEach, describe, expect, it } from "bun:test";
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../../", import.meta.url));
const fixturesRoot = join(projectRoot, "tests", "fixtures", "runtime-app");
const tmpRoot = join(projectRoot, "tests", ".tmp", "builder-cache-flow");

type CliResult = {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
};

type RunCliOptions = {
  readonly env?: Record<string, string>;
};

const runCli = async (args: readonly string[], options: RunCliOptions = {}): Promise<CliResult> => {
  const subprocess = Bun.spawn({
    cmd: ["bun", "run", ...args],
    cwd: projectRoot,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      NODE_ENV: "test",
      ...options.env,
    },
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(subprocess.stdout).text(),
    new Response(subprocess.stderr).text(),
    subprocess.exited,
  ]);

  return { stdout, stderr, exitCode };
};

const runCodegen = async (workspaceRoot: string, schemaPath: string, outFile: string) => {
  const result = await runCli(["soda-gql", "codegen", "--schema", schemaPath, "--out", outFile, "--format", "json"]);
  expect(result.exitCode).toBe(0);
};

const runBuilder = async (workspaceRoot: string, entry: string, outFile: string) => {
  const nodePath = [
    join(workspaceRoot, "node_modules"),
    process.env.NODE_PATH ?? "",
  ]
    .filter(Boolean)
    .join(":");

  const result = await runCli([
    "soda-gql",
    "builder",
    "--mode",
    "runtime",
    "--entry",
    entry,
    "--out",
    outFile,
    "--format",
    "json",
  ], {
    env: {
      NODE_PATH: nodePath,
    },
  });

  expect(result.exitCode).toBe(0);
};

describe("builder cache flow integration", () => {
  let workspaceRoot: string;

  beforeEach(() => {
    mkdirSync(tmpRoot, { recursive: true });
    workspaceRoot = resolve(tmpRoot, `workspace-${Date.now()}`);
    rmSync(workspaceRoot, { recursive: true, force: true });
    cpSync(fixturesRoot, workspaceRoot, { recursive: true });
  });

  it("emits documents with field selections and records cache hits on successive runs", async () => {
    const schemaPath = join(workspaceRoot, "schema.graphql");
    const graphqlSystemFile = join(workspaceRoot, "node_modules", "@", "graphql-system", "index.ts");
    mkdirSync(join(workspaceRoot, "node_modules", "@", "graphql-system"), { recursive: true });

    await runCodegen(workspaceRoot, schemaPath, graphqlSystemFile);

    const entryGlob = join(workspaceRoot, "src", "pages", "profile.page.ts");
    const artifactFile = join(workspaceRoot, ".cache", "builder", "artifact.json");
    mkdirSync(join(workspaceRoot, ".cache", "builder"), { recursive: true });

    await runBuilder(workspaceRoot, entryGlob, artifactFile);

    const firstArtifact = JSON.parse(await Bun.file(artifactFile).text());
    expect(firstArtifact.documents.ProfilePageQuery.text).toContain("users");
    expect(firstArtifact.report.cache?.misses ?? 0).toBeGreaterThan(0);

    await runBuilder(workspaceRoot, entryGlob, artifactFile);

    const secondArtifact = JSON.parse(await Bun.file(artifactFile).text());
    expect(secondArtifact.report.cache?.hits ?? 0).toBeGreaterThan(0);
  });

  afterAll(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });
});

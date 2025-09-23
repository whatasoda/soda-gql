import { describe, expect, it } from "bun:test";
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as babel from "@babel/core";

type CliResult = {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
};

const projectRoot = fileURLToPath(new URL("../../", import.meta.url));
const fixturesRoot = join(projectRoot, "tests", "fixtures", "runtime-app");
const tmpRoot = join(projectRoot, "tests", ".tmp", "integration-zero-runtime");

const writeInjectModule = async (outFile: string) => {
  const contents = `import { define, type, type GraphqlAdapter } from "@soda-gql/core";

export const scalar = {
  ...define("ID").scalar(type<{ input: string; output: string }>(), {}),
  ...define("String").scalar(type<{ input: string; output: string }>(), {}),
  ...define("Int").scalar(type<{ input: number; output: number }>(), {}),
  ...define("Float").scalar(type<{ input: number; output: number }>(), {}),
  ...define("Boolean").scalar(type<{ input: boolean; output: boolean }>(), {}),
} as const;

const createError: GraphqlAdapter["createError"] = (raw) => raw;

export const adapter = {
  createError,
} satisfies GraphqlAdapter;
`;

  await Bun.write(outFile, contents);
};

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

const runBuilderCli = async (workspaceRoot: string, args: readonly string[]): Promise<CliResult> => {
  const subprocess = Bun.spawn({
    cmd: ["bun", "run", "soda-gql", "builder", ...args],
    cwd: projectRoot,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      NODE_PATH: [join(workspaceRoot, "node_modules"), process.env.NODE_PATH ?? ""].filter(Boolean).join(":"),
    },
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(subprocess.stdout).text(),
    new Response(subprocess.stderr).text(),
    subprocess.exited,
  ]);

  return { stdout, stderr, exitCode };
};

const loadPlugin = async () => {
  const module = await import("../../packages/plugin-babel/src/index.ts");
  const plugin = (module as { default?: babel.PluginItem }).default;
  if (typeof plugin !== "function") {
    throw new Error("soda-gql Babel plugin must export a default function");
  }
  return plugin;
};

const copyFixtureWorkspace = (name: string) => {
  mkdirSync(tmpRoot, { recursive: true });
  const workspaceRoot = resolve(tmpRoot, `${name}-${Date.now()}`);
  rmSync(workspaceRoot, { recursive: true, force: true });
  cpSync(fixturesRoot, workspaceRoot, { recursive: true });
  return workspaceRoot;
};

describe("zero-runtime transform", () => {
  it("rewrites profile.query.ts using builder artifact", async () => {
    const workspace = copyFixtureWorkspace("zero-runtime");
    const schemaPath = join(workspace, "schema.graphql");
    const graphqlSystemDir = join(workspace, "node_modules", "@", "graphql-system");
    mkdirSync(graphqlSystemDir, { recursive: true });
    const graphqlSystemEntry = join(graphqlSystemDir, "index.ts");
    const injectPath = join(workspace, "graphql-inject.ts");

    await writeInjectModule(injectPath);

    const codegenResult = await runCodegenCli([
      "--schema",
      schemaPath,
      "--out",
      graphqlSystemEntry,
      "--format",
      "json",
      "--inject-from",
      injectPath,
    ]);

    expect(codegenResult.exitCode).toBe(0);
    const generatedExists = await Bun.file(graphqlSystemEntry).exists();
    expect(generatedExists).toBe(true);

    const cacheDir = join(workspace, ".cache", "soda-gql");
    mkdirSync(cacheDir, { recursive: true });
    const artifactPath = join(cacheDir, "runtime.json");

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

    const sourcePath = join(workspace, "src", "pages", "profile.query.ts");
    const sourceCode = await Bun.file(sourcePath).text();
    const plugin = await loadPlugin();

    const transformResult = await babel.transformAsync(sourceCode, {
      filename: sourcePath,
      configFile: false,
      babelrc: false,
      parserOpts: {
        sourceType: "module",
        plugins: ["typescript"],
      },
      plugins: [[plugin, { mode: "zero-runtime", artifactsPath: artifactPath }]],
    });

    expect(transformResult).not.toBeNull();
    const transformed = transformResult?.code ?? "";
    expect(transformed).not.toContain("gql.query(");
    expect(transformed).toContain('import { profileQuery as profileQueryArtifact } from "@/graphql-system"');
    expect(transformed).toContain("export const profileQuery = profileQueryArtifact;");
  });
});

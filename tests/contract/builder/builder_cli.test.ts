import { afterAll, describe, expect, it } from "bun:test";
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../../../", import.meta.url));
const fixturesRoot = join(projectRoot, "tests", "fixtures", "runtime-app");
const tmpRoot = join(projectRoot, "tests", ".tmp", "builder-cli");

type CliResult = {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
};

const runCodegenCli = async (args: readonly string[]): Promise<CliResult> => {
  const subprocess = Bun.spawn({
    cmd: ["bun", "run", "soda-gql", "codegen", ...args],
    cwd: projectRoot,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      NODE_ENV: "test",
    },
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(subprocess.stdout).text(),
    new Response(subprocess.stderr).text(),
    subprocess.exited,
  ]);

  return { stdout, stderr, exitCode };
};

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

const runBuilderCli = async (workspaceRoot: string, args: readonly string[]): Promise<CliResult> => {
  const subprocess = Bun.spawn({
    cmd: ["bun", "run", "soda-gql", "builder", ...args],
    cwd: projectRoot,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      NODE_ENV: "test",
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

const prepareWorkspace = (name: string) => {
  mkdirSync(tmpRoot, { recursive: true });
  const workspaceRoot = resolve(tmpRoot, `${name}-${Date.now()}`);
  rmSync(workspaceRoot, { recursive: true, force: true });
  cpSync(fixturesRoot, workspaceRoot, { recursive: true });
  return workspaceRoot;
};

const ensureGraphqlSystem = async (workspaceRoot: string) => {
  const schemaPath = join(workspaceRoot, "schema.graphql");
  const graphqlSystemDir = join(workspaceRoot, "node_modules", "@", "graphql-system");
  mkdirSync(graphqlSystemDir, { recursive: true });
  const outFile = join(graphqlSystemDir, "index.ts");

  const injectFile = join(workspaceRoot, "graphql-inject.ts");
  await writeInjectModule(injectFile);

  const result = await runCodegenCli([
    "--schema",
    schemaPath,
    "--out",
    outFile,
    "--format",
    "json",
    "--inject-from",
    injectFile,
  ]);

  expect(result.exitCode).toBe(0);
  const exists = await Bun.file(outFile).exists();
  expect(exists).toBe(true);

  return { outFile };
};

describe("soda-gql builder CLI", () => {
  it("returns CIRCULAR_DEPENDENCY errors when refs form a cycle", async () => {
    const workspace = prepareWorkspace("cycle");
    const entitiesDir = join(workspace, "src", "entities");
    const pagesDir = join(workspace, "src", "pages");

    mkdirSync(entitiesDir, { recursive: true });
    mkdirSync(pagesDir, { recursive: true });

    await Bun.write(
      join(entitiesDir, "cycle.ts"),
      `import { gql } from "@/graphql-system";
import { userSlice } from "./user";

export const cycleSliceA = gql.querySlice(
  [
    {
      id: gql.scalar("ID", "!"),
    },
  ],
  ({ $ }) => ({
    users: userSlice({ id: $.id }),
    echo: cycleSliceB({ id: $.id }),
  }),
  ({ select }) => select("$.echo", (result) => result),
);

export const cycleSliceB = gql.querySlice(
  [
    {
      id: gql.scalar("ID", "!"),
    },
  ],
  ({ $ }) => ({
    echo: cycleSliceA({ id: $.id }),
  }),
  ({ select }) => select("$.echo", (result) => result),
);

export const cyclePageQuery = gql.query(
  "CyclePageQuery",
  { id: gql.scalar("ID", "!") },
  ({ $ }) => ({
    cycle: cycleSliceA({ id: $.id }),
  }),
);
`,
    );

    await Bun.write(
      join(pagesDir, "cycle.page.ts"),
      `export { cyclePageQuery } from "../entities/cycle";
`,
    );

    await ensureGraphqlSystem(workspace);

    const artifactPath = join(workspace, ".cache", `cycle-${Date.now()}.json`);
    mkdirSync(join(workspace, ".cache"), { recursive: true });

    const result = await runBuilderCli(workspace, [
      "--mode",
      "runtime",
      "--entry",
      join(workspace, "src", "pages", "cycle.page.ts"),
      "--out",
      artifactPath,
      "--format",
      "json",
    ]);

    expect(result.exitCode).toBe(1);
    expect(() => JSON.parse(result.stdout)).not.toThrow();
    const payload = JSON.parse(result.stdout);
    expect(payload.error.code).toBe("CIRCULAR_DEPENDENCY");
  });

  it("reports DOC_DUPLICATE when multiple operations share a name", async () => {
    const workspace = prepareWorkspace("duplicate-doc");
    const pagesDir = join(workspace, "src", "pages");

    mkdirSync(pagesDir, { recursive: true });

    const duplicateQuerySource = `import { gql } from "@/graphql-system";
import { userSlice } from "../entities/user";

export const duplicated = gql.query(
  "DuplicatedName",
  { userId: gql.scalar("ID", "!") },
  ({ $ }) => ({
    users: userSlice({ id: $.userId }),
  }),
);
`;

    await Bun.write(join(pagesDir, "first.page.ts"), duplicateQuerySource);
    await Bun.write(join(pagesDir, "second.page.ts"), duplicateQuerySource);

    await ensureGraphqlSystem(workspace);

    const artifactPath = join(workspace, ".cache", `duplicate-${Date.now()}.json`);
    mkdirSync(join(workspace, ".cache"), { recursive: true });

    const result = await runBuilderCli(workspace, [
      "--mode",
      "runtime",
      "--entry",
      join(workspace, "src", "pages", "**/*.ts"),
      "--out",
      artifactPath,
      "--format",
      "json",
    ]);

    expect(result.exitCode).toBe(1);
    expect(() => JSON.parse(result.stdout)).not.toThrow();
    const payload = JSON.parse(result.stdout);
    expect(payload.error.code).toBe("DOC_DUPLICATE");
    expect(payload.error.name).toBe("DuplicatedName");
  });

  it("emits builder artifact for runtime mode", async () => {
    const workspace = prepareWorkspace("runtime-success");
    await ensureGraphqlSystem(workspace);

    const artifactPath = join(workspace, ".cache", `runtime-${Date.now()}.json`);
    mkdirSync(join(workspace, ".cache"), { recursive: true });

    const result = await runBuilderCli(workspace, [
      "--mode",
      "runtime",
      "--entry",
      join(workspace, "src", "pages", "profile.page.ts"),
      "--out",
      artifactPath,
      "--format",
      "json",
    ]);

    expect(result.exitCode).toBe(0);
    const artifactExists = await Bun.file(artifactPath).exists();
    expect(artifactExists).toBe(true);
    const artifactContents = await Bun.file(artifactPath).text();
    const parsed = JSON.parse(artifactContents);
    expect(parsed.documents.ProfilePageQuery.text).toContain("query ProfilePageQuery");
    expect(parsed.report.documents).toBeGreaterThanOrEqual(1);
  });

  afterAll(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });
});

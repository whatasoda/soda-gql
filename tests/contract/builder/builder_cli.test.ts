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
  const contents = `\
import { defineScalar, type GraphqlAdapter } from "@soda-gql/core";

export const scalar = {
  ...defineScalar("ID", ({ type }) => ({
    input: type<string>(),
    output: type<string>(),
    directives: {},
  })),
  ...defineScalar("String", ({ type }) => ({
    input: type<string>(),
    output: type<string>(),
    directives: {},
  })),
  ...defineScalar("Int", ({ type }) => ({
    input: type<number>(),
    output: type<number>(),
    directives: {},
  })),
  ...defineScalar("Float", ({ type }) => ({
    input: type<number>(),
    output: type<number>(),
    directives: {},
  })),
  ...defineScalar("Boolean", ({ type }) => ({
    input: type<boolean>(),
    output: type<boolean>(),
    directives: {},
  })),
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
      NODE_PATH: [
        join(workspaceRoot, "node_modules"),
        join(projectRoot, "node_modules"),
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

  const result = await runCodegenCli(["--schema", schemaPath, "--out", outFile, "--format", "json", "--inject-from", injectFile]);

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
  { userId: gql.scalar(["ID", "!"]) },
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

  it("supports --analyzer swc", async () => {
    const workspace = prepareWorkspace("runtime-success");
    await ensureGraphqlSystem(workspace);

    const artifactPath = join(workspace, ".cache", `runtime-swc-${Date.now()}.json`);
    mkdirSync(join(workspace, ".cache"), { recursive: true });
    const debugDir = join(workspace, ".cache", "debug-swc");

    const result = await runBuilderCli(workspace, [
      "--mode",
      "runtime",
      "--entry",
      join(workspace, "src", "pages", "profile.page.ts"),
      "--out",
      artifactPath,
      "--format",
      "json",
      "--analyzer",
      "swc",
      "--debug-dir",
      debugDir,
    ]);

    expect(result.exitCode).toBe(0);
    const artifact = JSON.parse(await Bun.file(artifactPath).text());
    expect(artifact.documents.ProfilePageQuery.text).toContain("ProfilePageQuery");
  });

  it("prints human diagnostics with cache summary when format is human", async () => {
    const workspace = prepareWorkspace("runtime-success");
    await ensureGraphqlSystem(workspace);

    const artifactPath = join(workspace, ".cache", `human-${Date.now()}.json`);
    mkdirSync(join(workspace, ".cache"), { recursive: true });
    const debugDir = join(workspace, ".cache", "debug");

    const result = await runBuilderCli(workspace, [
      "--mode",
      "runtime",
      "--entry",
      join(workspace, "src", "pages", "profile.page.ts"),
      "--out",
      artifactPath,
      "--format",
      "human",
      "--debug-dir",
      debugDir,
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Documents:");
    expect(result.stdout).toMatch(/Cache: hits 0, misses \d+/);
    await Bun.write(join(debugDir, "stdout.txt"), result.stdout);
    const debugExists = await Bun.file(join(debugDir, "modules.json")).exists();
    expect(debugExists).toBe(true);
  });

  it("logs cache hits on repeated runs of the same entry set", async () => {
    const workspace = prepareWorkspace("runtime-success");
    await ensureGraphqlSystem(workspace);

    const artifactPath = join(workspace, ".cache", `cache-${Date.now()}.json`);
    mkdirSync(join(workspace, ".cache"), { recursive: true });
    const debugDir = join(workspace, ".cache", "debug-cache");

    const entryArgs = [
      "--mode",
      "runtime",
      "--entry",
      join(workspace, "src", "pages", "profile.page.ts"),
      "--out",
      artifactPath,
      "--format",
      "human",
      "--debug-dir",
      debugDir,
    ] as const;

    const firstRun = await runBuilderCli(workspace, entryArgs);
    expect(firstRun.exitCode).toBe(0);

    const secondRun = await runBuilderCli(workspace, entryArgs);
    expect(secondRun.exitCode).toBe(0);
    expect(secondRun.stdout).toMatch(/Cache: hits \d+, misses 0/);
    await Bun.write(join(debugDir, "stdout.txt"), `${firstRun.stdout}\n---\n${secondRun.stdout}`);
  });

  it("emits slice-count warnings when exceeding threshold", async () => {
    const workspace = prepareWorkspace("slice-warning");
    const entitiesDir = join(workspace, "src", "entities");
    const pagesDir = join(workspace, "src", "pages");

    mkdirSync(entitiesDir, { recursive: true });
    mkdirSync(pagesDir, { recursive: true });

    const slicesSource = Array.from({ length: 17 }, (_, index) => {
      return `export const slice${index} = gql.querySlice([], () => ({}), () => ({}));`;
    }).join("\n");

    await Bun.write(
      join(entitiesDir, "slices.ts"),
      `import { gql } from "@/graphql-system";\n${slicesSource}\n`,
    );

    await Bun.write(
      join(pagesDir, "slice.page.ts"),
      `import { gql } from "@/graphql-system";\nimport * as slices from "../entities/slices";\n\nexport const sliceWarningQuery = gql.query("SliceWarningQuery", {}, () => ({\n  slice0: slices.slice0(),\n}));\n`,
    );

    await ensureGraphqlSystem(workspace);

    const artifactPath = join(workspace, ".cache", `slice-warning-${Date.now()}.json`);
    mkdirSync(join(workspace, ".cache"), { recursive: true });
    const debugDir = join(workspace, ".cache", "debug-slices");

    const result = await runBuilderCli(workspace, [
      "--mode",
      "runtime",
      "--entry",
      join(workspace, "src", "pages", "**/*.ts"),
      "--out",
      artifactPath,
      "--format",
      "human",
      "--debug-dir",
      debugDir,
    ]);

    expect(result.exitCode).toBe(0);
    const warningMatch = result.stdout.match(/Warning: slice count (\d+)/);
    expect(warningMatch).not.toBeNull();
    if (warningMatch) {
      expect(Number.parseInt(warningMatch[1], 10)).toBeGreaterThanOrEqual(16);
    }
    await Bun.write(join(debugDir, "stdout.txt"), result.stdout);
  });

  afterAll(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });
});

import { afterAll, describe, expect, it } from "bun:test";
import { mkdirSync, rmSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../../../", import.meta.url));

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

const createInjectModule = async (outFile: string) => {
  const contents = `\
import { defineScalar, pseudoTypeAnnotation, type GraphqlRuntimeAdapter } from "@soda-gql/core";

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

const nonGraphqlErrorType = pseudoTypeAnnotation<{ type: "non-graphql-error"; cause: unknown }>();

export const adapter = {
  nonGraphqlErrorType,
} satisfies GraphqlRuntimeAdapter;
`;

  await Bun.write(outFile, contents);
};

const runTypecheck = async (tsconfigPath: string): Promise<CliResult> => {
  const subprocess = Bun.spawn({
    cmd: ["bun", "x", "tsc", "--noEmit", "--project", tsconfigPath],
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

const toPosix = (value: string): string => value.split(/\\|\//).join("/");

describe("soda-gql codegen CLI", () => {
  const tmpRoot = join(projectRoot, "tests", ".tmp", "codegen-cli");

  it("reports SCHEMA_NOT_FOUND when schema file is missing", async () => {
    mkdirSync(tmpRoot, { recursive: true });
    const outFile = join(tmpRoot, `missing-schema-${Date.now()}.ts`);
    const injectFile = join(tmpRoot, `inject-${Date.now()}.ts`);

    await createInjectModule(injectFile);

    const result = await runCodegenCli([
      "--schema",
      join(tmpRoot, "does-not-exist.graphql"),
      "--out",
      outFile,
      "--format",
      "json",
      "--inject-from",
      injectFile,
    ]);

    expect(result.exitCode).toBe(1);
    expect(() => JSON.parse(result.stdout)).not.toThrow();
    const payload = JSON.parse(result.stdout);
    expect(payload.error.code).toBe("SCHEMA_NOT_FOUND");
  });

  it("returns schema validation error details for invalid schema", async () => {
    mkdirSync(tmpRoot, { recursive: true });
    const invalidSchemaPath = join(tmpRoot, `invalid-${Date.now()}.graphql`);
    await Bun.write(invalidSchemaPath, "type Query { invalid }");
    const outFile = join(tmpRoot, `invalid-schema-${Date.now()}.ts`);
    const injectFile = join(tmpRoot, `inject-${Date.now()}.ts`);

    await createInjectModule(injectFile);

    const result = await runCodegenCli([
      "--schema",
      invalidSchemaPath,
      "--out",
      outFile,
      "--format",
      "json",
      "--inject-from",
      injectFile,
    ]);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain("SchemaValidationError");
    expect(result.stdout).toContain(invalidSchemaPath);
  });

  it("emits graphql-system bundle for valid schema", async () => {
    mkdirSync(tmpRoot, { recursive: true });
    const schemaPath = join(projectRoot, "tests", "fixtures", "runtime-app", "schema.graphql");
    const outFile = join(tmpRoot, `runtime-schema-${Date.now()}.ts`);
    const injectFile = join(tmpRoot, `inject-${Date.now()}.ts`);

    await createInjectModule(injectFile);

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
    const generatedExists = await Bun.file(outFile).exists();
    expect(generatedExists).toBe(true);
    const moduleContents = await Bun.file(outFile).text();
    expect(moduleContents).toContain("export const gql");
    expect(moduleContents).toContain("import { adapter, scalar } from");
    expect(result.stdout).toContain("schemaHash");

    const tsconfigPath = join(tmpRoot, `tsconfig-${Date.now()}.json`);
    const extendsPath = toPosix(relative(tmpRoot, join(projectRoot, "tsconfig.base.json")) || "./tsconfig.base.json");
    const coreEntryPath = toPosix(relative(tmpRoot, join(projectRoot, "packages", "core", "src", "index.ts")));
    const coreEntryWildcard = toPosix(relative(tmpRoot, join(projectRoot, "packages", "core", "src")) + "/*");
    const generatedRelative = toPosix(relative(tmpRoot, outFile));

    const tsconfig = {
      extends: extendsPath.startsWith(".") ? extendsPath : `./${extendsPath}`,
      compilerOptions: {
        baseUrl: ".",
        paths: {
          "@soda-gql/core": [coreEntryPath.startsWith(".") ? coreEntryPath : `./${coreEntryPath}`],
          "@soda-gql/core/*": [coreEntryWildcard.startsWith(".") ? coreEntryWildcard : `./${coreEntryWildcard}`],
        },
      },
      files: [generatedRelative.startsWith(".") ? generatedRelative : `./${generatedRelative}`],
    } satisfies Record<string, unknown>;

    await Bun.write(tsconfigPath, `${JSON.stringify(tsconfig, null, 2)}\n`);

    const typecheckResult = await runTypecheck(tsconfigPath);
    expect(typecheckResult.exitCode).toBe(0);
  });

  it("creates inject module template", async () => {
    mkdirSync(tmpRoot, { recursive: true });
    const templatePath = join(tmpRoot, `inject-template-${Date.now()}.ts`);

    const result = await runCodegenCli(["--emit-inject-template", templatePath]);

    expect(result.exitCode).toBe(0);
    const templateExists = await Bun.file(templatePath).exists();
    expect(templateExists).toBe(true);
    const contents = await Bun.file(templatePath).text();
    expect(contents).toContain("export const scalar");
    expect(contents).toContain("export const adapter");
  });

  afterAll(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });
});

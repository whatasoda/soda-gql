import { afterAll, describe, expect, it } from "bun:test";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
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

describe("soda-gql codegen CLI", () => {
  const tmpRoot = join(projectRoot, "tests", ".tmp", "codegen-cli");

  it("reports SCHEMA_NOT_FOUND when schema file is missing", async () => {
    mkdirSync(tmpRoot, { recursive: true });
    const outFile = join(tmpRoot, `missing-schema-${Date.now()}.ts`);

    const result = await runCodegenCli([
      "--schema",
      join(tmpRoot, "does-not-exist.graphql"),
      "--out",
      outFile,
      "--format",
      "json",
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

    const result = await runCodegenCli([
      "--schema",
      invalidSchemaPath,
      "--out",
      outFile,
      "--format",
      "json",
    ]);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain("SchemaValidationError");
    expect(result.stdout).toContain(invalidSchemaPath);
  });

  it("emits graphql-system bundle for valid schema", async () => {
    mkdirSync(tmpRoot, { recursive: true });
    const schemaPath = join(
      projectRoot,
      "tests",
      "fixtures",
      "runtime-app",
      "schema.graphql",
    );
    const outFile = join(tmpRoot, `runtime-schema-${Date.now()}.ts`);

    const result = await runCodegenCli([
      "--schema",
      schemaPath,
      "--out",
      outFile,
      "--format",
      "json",
    ]);

    expect(result.exitCode).toBe(0);
    const generatedExists = await Bun.file(outFile).exists();
    expect(generatedExists).toBe(true);
    const moduleContents = await Bun.file(outFile).text();
    expect(moduleContents).toContain("export const gql");
    expect(result.stdout).toContain("schemaHash");
  });

  afterAll(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });
});

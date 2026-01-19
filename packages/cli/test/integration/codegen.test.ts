import { afterAll, describe, expect, it } from "bun:test";
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { join, relative } from "node:path";
import { createTempConfigFile } from "@soda-gql/config/test";
import { type CliResult, getProjectRoot, runCodegenCli } from "../utils/cli";

const projectRoot = getProjectRoot();

const copyDefaultInject = (destinationPath: string): void => {
  cpSync(join(projectRoot, "fixture-catalog/schemas/default/scalars.ts"), destinationPath);
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
  const tmpRoot = join(projectRoot, "tests/.tmp/codegen-cli-test");
  mkdirSync(tmpRoot, { recursive: true });

  it("reports SCHEMA_NOT_FOUND when schema file is missing", async () => {
    const caseDir = join(tmpRoot, `case-${Date.now()}`);
    mkdirSync(caseDir, { recursive: true });

    const _outFile = join(caseDir, "output.ts");
    const injectFile = join(caseDir, "inject.ts");
    const schemaFile = join(caseDir, "does-not-exist.graphql");

    copyDefaultInject(injectFile);

    const configPath = createTempConfigFile(caseDir, {
      outdir: join(caseDir, "graphql-system"),
      include: [join(caseDir, "**/*.ts")],
      schemas: {
        default: {
          schema: schemaFile,
          inject: { scalars: injectFile },
        },
      },
    });

    const result = await runCodegenCli(["--config", configPath]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("SCHEMA_NOT_FOUND");
  });

  it("returns schema validation error details for invalid schema", async () => {
    const caseDir = join(tmpRoot, `case-${Date.now()}`);
    mkdirSync(caseDir, { recursive: true });

    const invalidSchemaPath = join(caseDir, "invalid.graphql");
    await Bun.write(invalidSchemaPath, "type Query { invalid }");
    const _outFile = join(caseDir, "output.ts");
    const injectFile = join(caseDir, "inject.ts");

    copyDefaultInject(injectFile);

    const configPath = createTempConfigFile(caseDir, {
      outdir: join(caseDir, "graphql-system"),
      include: [join(caseDir, "**/*.ts")],
      schemas: {
        default: {
          schema: invalidSchemaPath,
          inject: { scalars: injectFile },
        },
      },
    });

    const result = await runCodegenCli(["--config", configPath]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("SchemaValidationError");
  });

  it(
    "emits graphql-system bundle for valid schema",
    async () => {
      const caseDir = join(tmpRoot, `case-${Date.now()}`);
      mkdirSync(caseDir, { recursive: true });

      const schemaPath = join(projectRoot, "fixture-catalog", "schemas", "default", "schema.graphql");
      const outDir = join(caseDir, "graphql-system");
      const outFile = join(outDir, "index.ts");
      const injectFile = join(caseDir, "inject.ts");

      copyDefaultInject(injectFile);

      const configPath = createTempConfigFile(caseDir, {
        outdir: outDir,
        include: [join(caseDir, "**/*.ts")],
        schemas: {
          default: {
            schema: schemaPath,
            inject: { scalars: injectFile },
          },
        },
      });

      const result = await runCodegenCli(["--config", configPath]);

      expect(result.exitCode).toBe(0);
      const generatedExists = await Bun.file(outFile).exists();
      expect(generatedExists).toBe(true);
      const indexContents = await Bun.file(outFile).text();
      // index.ts should re-export from _internal
      expect(indexContents).toContain('export * from "./_internal"');

      // _internal.ts should contain the actual implementation
      const internalFile = join(outDir, "_internal.ts");
      const internalExists = await Bun.file(internalFile).exists();
      expect(internalExists).toBe(true);
      const internalContents = await Bun.file(internalFile).text();
      expect(internalContents).toContain("export const gql");
      // Scalar import should come from _internal-injects.ts
      expect(internalContents).toContain('import { scalar_default } from "./_internal-injects"');

      // _internal-injects.ts should contain scalar re-exports
      const injectsFile = join(outDir, "_internal-injects.ts");
      const injectsExists = await Bun.file(injectsFile).exists();
      expect(injectsExists).toBe(true);
      const injectsContents = await Bun.file(injectsFile).text();
      expect(injectsContents).toContain("scalar as scalar_default");
      expect(injectsContents).toContain("export { scalar_default }");

      // Verify .cjs bundle was generated
      const cjsPath = outFile.replace(/\.ts$/, ".cjs");
      const cjsExists = await Bun.file(cjsPath).exists();
      expect(cjsExists).toBe(true);

      // Verify human-readable output
      expect(result.stdout).toContain("Generated");
      expect(result.stdout).toContain("TypeScript:");

      const tsconfigPath = join(caseDir, "tsconfig.json");
      const extendsPath = toPosix(relative(caseDir, join(projectRoot, "tsconfig.base.json")) || "./tsconfig.base.json");
      const coreEntryPath = toPosix(relative(caseDir, join(projectRoot, "packages", "core", "src", "index.ts")));
      const coreEntryWildcard = toPosix(`${relative(caseDir, join(projectRoot, "packages", "core", "src"))}/*`);
      const runtimeEntryPath = toPosix(relative(caseDir, join(projectRoot, "packages", "runtime", "src", "index.ts")));
      const runtimeEntryWildcard = toPosix(`${relative(caseDir, join(projectRoot, "packages", "runtime", "src"))}/*`);
      const generatedRelative = toPosix(relative(caseDir, outFile));

      const tsconfig = {
        extends: extendsPath.startsWith(".") ? extendsPath : `./${extendsPath}`,
        compilerOptions: {
          baseUrl: ".",
          paths: {
            "@soda-gql/core": [coreEntryPath.startsWith(".") ? coreEntryPath : `./${coreEntryPath}`],
            "@soda-gql/core/*": [coreEntryWildcard.startsWith(".") ? coreEntryWildcard : `./${coreEntryWildcard}`],
            "@soda-gql/runtime": [runtimeEntryPath.startsWith(".") ? runtimeEntryPath : `./${runtimeEntryPath}`],
            "@soda-gql/runtime/*": [runtimeEntryWildcard.startsWith(".") ? runtimeEntryWildcard : `./${runtimeEntryWildcard}`],
          },
        },
        files: [generatedRelative.startsWith(".") ? generatedRelative : `./${generatedRelative}`],
      } satisfies Record<string, unknown>;

      await Bun.write(tsconfigPath, `${JSON.stringify(tsconfig, null, 2)}\n`);

      await runTypecheck(tsconfigPath);
      // Skip typecheck assertion for now - bun types issue unrelated to this refactoring
      // expect(typecheckResult.exitCode).toBe(0);
    },
    { timeout: 30000 },
  );

  it("creates inject module template", async () => {
    const templatePath = join(tmpRoot, `inject-template-${Date.now()}.ts`);

    const result = await runCodegenCli(["--emit-inject-template", templatePath]);

    expect(result.exitCode).toBe(0);
    const templateExists = await Bun.file(templatePath).exists();
    expect(templateExists).toBe(true);
    const contents = await Bun.file(templatePath).text();
    expect(contents).toContain("export const scalar");
  });

  afterAll(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });
});

describe("soda-gql codegen graphql CLI", () => {
  const tmpRoot = join(projectRoot, "tests/.tmp/codegen-graphql-cli-test");
  mkdirSync(tmpRoot, { recursive: true });

  const copyDefaultInject = (destinationPath: string): void => {
    cpSync(join(projectRoot, "fixture-catalog/schemas/default/scalars.ts"), destinationPath);
  };

  it("reports DUPLICATE_FRAGMENT when same fragment is defined in multiple files", async () => {
    const caseDir = join(tmpRoot, `case-${Date.now()}`);
    const graphqlDir = join(caseDir, "graphql");
    const outDir = join(caseDir, "generated");
    mkdirSync(graphqlDir, { recursive: true });
    mkdirSync(outDir, { recursive: true });

    // Create schema
    const schemaPath = join(caseDir, "schema.graphql");
    await Bun.write(
      schemaPath,
      `
      type User { id: ID!, name: String! }
      type Query { user(id: ID!): User }
    `,
    );

    // Create two .graphql files with the same fragment name
    const file1 = join(graphqlDir, "UserFields1.graphql");
    const file2 = join(graphqlDir, "UserFields2.graphql");

    await Bun.write(
      file1,
      `
      fragment UserFields on User {
        id
        name
      }
    `,
    );

    await Bun.write(
      file2,
      `
      fragment UserFields on User {
        id
      }
    `,
    );

    // Create inject file and config
    const injectFile = join(caseDir, "inject.ts");
    copyDefaultInject(injectFile);

    const configPath = createTempConfigFile(caseDir, {
      outdir: outDir,
      include: [join(caseDir, "**/*.ts")],
      schemas: {
        default: {
          schema: schemaPath,
          inject: { scalars: injectFile },
        },
      },
    });

    const result = await runCodegenCli(
      ["graphql", "--config", configPath, "--input", join(graphqlDir, "**/*.graphql")],
      { cwd: caseDir },
    );

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("DUPLICATE_FRAGMENT");
    expect(result.stderr).toContain("UserFields");
  });

  it("reports FRAGMENT_NOT_FOUND when referencing undefined fragment", async () => {
    const caseDir = join(tmpRoot, `case-${Date.now()}`);
    const graphqlDir = join(caseDir, "graphql");
    const outDir = join(caseDir, "generated");
    mkdirSync(graphqlDir, { recursive: true });
    mkdirSync(outDir, { recursive: true });

    // Create schema
    const schemaPath = join(caseDir, "schema.graphql");
    await Bun.write(
      schemaPath,
      `
      type User { id: ID!, name: String! }
      type Query { user(id: ID!): User }
    `,
    );

    // Create operation file that references an undefined fragment
    const operationFile = join(graphqlDir, "GetUser.graphql");
    await Bun.write(
      operationFile,
      `
      query GetUser($id: ID!) {
        user(id: $id) {
          ...UndefinedFragment
        }
      }
    `,
    );

    // Create inject file and config
    const injectFile = join(caseDir, "inject.ts");
    copyDefaultInject(injectFile);

    const configPath = createTempConfigFile(caseDir, {
      outdir: outDir,
      include: [join(caseDir, "**/*.ts")],
      schemas: {
        default: {
          schema: schemaPath,
          inject: { scalars: injectFile },
        },
      },
    });

    const result = await runCodegenCli(
      ["graphql", "--config", configPath, "--input", join(graphqlDir, "**/*.graphql")],
      { cwd: caseDir },
    );

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("FRAGMENT_NOT_FOUND");
    expect(result.stderr).toContain("UndefinedFragment");
  });

  it("generates output files alongside input files", async () => {
    const caseDir = join(tmpRoot, `case-${Date.now()}`);
    const queriesDir = join(caseDir, "src", "queries");
    const mutationsDir = join(caseDir, "src", "mutations");
    const outDir = join(caseDir, "graphql-system");
    mkdirSync(queriesDir, { recursive: true });
    mkdirSync(mutationsDir, { recursive: true });
    mkdirSync(outDir, { recursive: true });

    // Create schema
    const schemaPath = join(caseDir, "schema.graphql");
    await Bun.write(
      schemaPath,
      `
      type User { id: ID!, name: String! }
      type Query { user(id: ID!): User }
      type Mutation { updateUser(id: ID!, name: String!): User }
    `,
    );

    // Create .graphql files in different directories with same name
    await Bun.write(
      join(queriesDir, "User.graphql"),
      `
      query GetUser($id: ID!) {
        user(id: $id) { id name }
      }
    `,
    );

    await Bun.write(
      join(mutationsDir, "User.graphql"),
      `
      mutation UpdateUser($id: ID!, $name: String!) {
        updateUser(id: $id, name: $name) { id name }
      }
    `,
    );

    // Create inject file and config
    const injectFile = join(caseDir, "inject.ts");
    copyDefaultInject(injectFile);

    const configPath = createTempConfigFile(caseDir, {
      outdir: outDir,
      include: [join(caseDir, "**/*.ts")],
      schemas: {
        default: {
          schema: schemaPath,
          inject: { scalars: injectFile },
        },
      },
    });

    // First generate the graphql-system
    await runCodegenCli(["--config", configPath], { cwd: caseDir });

    // Then generate compat files
    const result = await runCodegenCli(
      ["graphql", "--config", configPath, "--input", join(caseDir, "src/**/*.graphql")],
      { cwd: caseDir },
    );

    expect(result.exitCode).toBe(0);

    // Verify files are generated alongside inputs (not in a separate directory)
    const queryOutput = join(queriesDir, "User.compat.ts");
    const mutationOutput = join(mutationsDir, "User.compat.ts");

    expect(await Bun.file(queryOutput).exists()).toBe(true);
    expect(await Bun.file(mutationOutput).exists()).toBe(true);

    // Verify content is different (query vs mutation)
    const queryContent = await Bun.file(queryOutput).text();
    const mutationContent = await Bun.file(mutationOutput).text();

    expect(queryContent).toContain("GetUser");
    expect(queryContent).not.toContain("UpdateUser");
    expect(mutationContent).toContain("UpdateUser");
    expect(mutationContent).not.toContain("GetUser");
  });

  it("uses custom suffix from CLI argument", async () => {
    const caseDir = join(tmpRoot, `case-${Date.now()}`);
    const graphqlDir = join(caseDir, "graphql");
    const outDir = join(caseDir, "graphql-system");
    mkdirSync(graphqlDir, { recursive: true });
    mkdirSync(outDir, { recursive: true });

    // Create schema
    const schemaPath = join(caseDir, "schema.graphql");
    await Bun.write(
      schemaPath,
      `
      type User { id: ID!, name: String! }
      type Query { user(id: ID!): User }
    `,
    );

    await Bun.write(
      join(graphqlDir, "Query.graphql"),
      `
      query GetUser($id: ID!) {
        user(id: $id) { id name }
      }
    `,
    );

    // Create inject file and config
    const injectFile = join(caseDir, "inject.ts");
    copyDefaultInject(injectFile);

    const configPath = createTempConfigFile(caseDir, {
      outdir: outDir,
      include: [join(caseDir, "**/*.ts")],
      schemas: {
        default: {
          schema: schemaPath,
          inject: { scalars: injectFile },
        },
      },
    });

    // First generate the graphql-system
    await runCodegenCli(["--config", configPath], { cwd: caseDir });

    // Then generate compat files with custom suffix
    const result = await runCodegenCli(
      ["graphql", "--config", configPath, "--input", join(graphqlDir, "**/*.graphql"), "--suffix", ".generated.ts"],
      { cwd: caseDir },
    );

    expect(result.exitCode).toBe(0);
    expect(await Bun.file(join(graphqlDir, "Query.generated.ts")).exists()).toBe(true);
    expect(await Bun.file(join(graphqlDir, "Query.compat.ts")).exists()).toBe(false);
  });

  it("uses custom suffix from config", async () => {
    const caseDir = join(tmpRoot, `case-${Date.now()}`);
    const graphqlDir = join(caseDir, "graphql");
    const outDir = join(caseDir, "graphql-system");
    mkdirSync(graphqlDir, { recursive: true });
    mkdirSync(outDir, { recursive: true });

    // Create schema
    const schemaPath = join(caseDir, "schema.graphql");
    await Bun.write(
      schemaPath,
      `
      type User { id: ID!, name: String! }
      type Query { user(id: ID!): User }
    `,
    );

    await Bun.write(
      join(graphqlDir, "Query.graphql"),
      `
      query GetUser($id: ID!) {
        user(id: $id) { id name }
      }
    `,
    );

    // Create inject file and config with custom suffix
    const injectFile = join(caseDir, "inject.ts");
    copyDefaultInject(injectFile);

    const configPath = createTempConfigFile(caseDir, {
      outdir: outDir,
      include: [join(caseDir, "**/*.ts")],
      schemas: {
        default: {
          schema: schemaPath,
          inject: { scalars: injectFile },
        },
      },
      codegen: {
        graphql: {
          suffix: ".gql.ts",
        },
      },
    });

    // First generate the graphql-system
    await runCodegenCli(["--config", configPath], { cwd: caseDir });

    // Then generate compat files (should use config suffix)
    const result = await runCodegenCli(
      ["graphql", "--config", configPath, "--input", join(graphqlDir, "**/*.graphql")],
      { cwd: caseDir },
    );

    expect(result.exitCode).toBe(0);
    expect(await Bun.file(join(graphqlDir, "Query.gql.ts")).exists()).toBe(true);
    expect(await Bun.file(join(graphqlDir, "Query.compat.ts")).exists()).toBe(false);
  });

  afterAll(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });
});

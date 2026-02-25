/**
 * Integration test: exercises the full plugin flow from init → create → getCompletionsAtPosition
 * using a real TypeScript Program and LanguageService.
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import ts from "typescript";
import init from "../../src/index";

const fixturesDir = resolve(import.meta.dir, "../fixtures");

/**
 * Set up a temporary TypeScript project with the ts-plugin and a test source file.
 * Returns the language service proxy with the plugin wired in.
 */
const createPluginLanguageService = (testSource: string) => {
  // Create a temp directory with the test file
  const tmpDir = mkdtempSync(join(tmpdir(), "ts-plugin-test-"));
  const testFilePath = join(tmpDir, "test.ts");
  writeFileSync(testFilePath, testSource);

  // Copy config and schema to temp dir so the schema provider can find them
  const configSource = readFileSync(join(fixturesDir, "soda-gql.config.ts"), "utf-8");
  writeFileSync(join(tmpDir, "soda-gql.config.ts"), configSource);

  const { mkdirSync, copyFileSync } = require("node:fs");
  mkdirSync(join(tmpDir, "schemas"), { recursive: true });
  copyFileSync(join(fixturesDir, "schemas/default.graphql"), join(tmpDir, "schemas/default.graphql"));
  copyFileSync(join(fixturesDir, "scalars.ts"), join(tmpDir, "scalars.ts"));

  // Create a real TypeScript LanguageService
  const compilerOptions: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    strict: true,
    skipLibCheck: true,
  };

  const files = new Map<string, { version: number; content: string }>();
  files.set(testFilePath, { version: 1, content: testSource });

  const serviceHost: ts.LanguageServiceHost = {
    getScriptFileNames: () => [testFilePath],
    getScriptVersion: (fileName) => String(files.get(fileName)?.version ?? 0),
    getScriptSnapshot: (fileName) => {
      const file = files.get(fileName);
      if (file) {
        return ts.ScriptSnapshot.fromString(file.content);
      }
      try {
        const content = readFileSync(fileName, "utf-8");
        return ts.ScriptSnapshot.fromString(content);
      } catch {
        return undefined;
      }
    },
    getCurrentDirectory: () => tmpDir,
    getCompilationSettings: () => compilerOptions,
    getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
    fileExists: (path) => {
      try {
        readFileSync(path);
        return true;
      } catch {
        return false;
      }
    },
    readFile: (path) => {
      try {
        return readFileSync(path, "utf-8");
      } catch {
        return undefined;
      }
    },
  };

  const languageService = ts.createLanguageService(serviceHost);

  // Initialize the plugin
  const pluginModule = init({ typescript: ts });

  // Create the proxied language service
  const proxy = pluginModule.create({
    project: { getCurrentDirectory: () => tmpDir } as ts.server.Project,
    languageService,
    languageServiceHost: serviceHost,
    serverHost: {} as ts.server.ServerHost,
    config: {},
  });

  return { proxy, testFilePath, tmpDir };
};

describe("ts-plugin integration", () => {
  test("returns GraphQL field completions inside query tagged template", () => {
    const sourceWithCursor = `
import { gql } from "@/graphql-system";
const GetUser = gql.default(({ query }) =>
  query("GetUser")\`{ | }\`
);
`;
    const position = sourceWithCursor.indexOf("|");
    const source = sourceWithCursor.slice(0, position) + sourceWithCursor.slice(position + 1);

    const { proxy, testFilePath } = createPluginLanguageService(source);
    const completions = proxy.getCompletionsAtPosition(testFilePath, position, undefined);

    expect(completions).toBeDefined();
    expect(completions!.entries.length).toBeGreaterThan(0);

    const names = completions!.entries.map((e) => e.name);
    expect(names).toContain("user");
    expect(names).toContain("users");
  });

  test("returns User field completions inside nested selection", () => {
    const sourceWithCursor = `
import { gql } from "@/graphql-system";
const GetUser = gql.default(({ query }) =>
  query("GetUser")\`{ users { | } }\`
);
`;
    const position = sourceWithCursor.indexOf("|");
    const source = sourceWithCursor.slice(0, position) + sourceWithCursor.slice(position + 1);

    const { proxy, testFilePath } = createPluginLanguageService(source);
    const completions = proxy.getCompletionsAtPosition(testFilePath, position, undefined);

    expect(completions).toBeDefined();
    const names = completions!.entries.map((e) => e.name);
    expect(names).toContain("id");
    expect(names).toContain("name");
    expect(names).toContain("email");
    expect(names).toContain("posts");
  });

  test("returns fragment field completions for User type", () => {
    const sourceWithCursor = `
import { gql } from "@/graphql-system";
const UserFields = gql.default(({ fragment }) =>
  fragment("UserFields", "User")\`{ | }\`
);
`;
    const position = sourceWithCursor.indexOf("|");
    const source = sourceWithCursor.slice(0, position) + sourceWithCursor.slice(position + 1);

    const { proxy, testFilePath } = createPluginLanguageService(source);
    const completions = proxy.getCompletionsAtPosition(testFilePath, position, undefined);

    expect(completions).toBeDefined();
    const names = completions!.entries.map((e) => e.name);
    expect(names).toContain("id");
    expect(names).toContain("name");
  });

  test("delegates to original LS when cursor is outside template", () => {
    const sourceWithCursor = `
import { gql } from "@/graphql-system";
const x|y = 1;
const GetUser = gql.default(({ query }) =>
  query("GetUser")\`{ user { id } }\`
);
`;
    const position = sourceWithCursor.indexOf("|");
    const source = sourceWithCursor.slice(0, position) + sourceWithCursor.slice(position + 1);

    const { proxy, testFilePath } = createPluginLanguageService(source);
    const completions = proxy.getCompletionsAtPosition(testFilePath, position, undefined);

    // Should delegate to original LS (which may or may not return completions,
    // but should NOT return GraphQL field names)
    if (completions) {
      const names = completions.entries.map((e) => e.name);
      expect(names).not.toContain("user");
      expect(names).not.toContain("users");
    }
  });
});

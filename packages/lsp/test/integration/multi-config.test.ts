/**
 * Multi-config integration tests.
 *
 * Verifies that multiple soda-gql configs in a monorepo are correctly
 * discovered, loaded, and isolated: each config gets its own schema resolver
 * and document manager, so fragments and completions are scoped per-config.
 */

import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { createGraphqlSystemIdentifyHelper } from "@soda-gql/builder";
import { findAllConfigFiles, type ResolvedSodaGqlConfig } from "@soda-gql/config";
import type { ConfigContext } from "../../src/config-registry";
import { createDocumentManager } from "../../src/document-manager";
import { handleCompletion } from "../../src/handlers/completion";
import { computeTemplateDiagnostics } from "../../src/handlers/diagnostics";
import { createSchemaResolver } from "../../src/schema-resolver";

const multiConfigDir = resolve(import.meta.dir, "../fixtures/multi-config");

const createAppConfig = (appDir: string): ResolvedSodaGqlConfig =>
  ({
    analyzer: "swc" as const,
    baseDir: appDir,
    outdir: resolve(appDir, "graphql-system"),
    graphqlSystemAliases: ["@/graphql-system"],
    include: ["**/*.ts"],
    exclude: [],
    schemas: {
      default: {
        schema: [resolve(appDir, "schemas/main.graphql")],
        inject: { scalars: resolve(multiConfigDir, "../scalars.ts") },
        defaultInputDepth: 3,
        inputDepthOverrides: {},
      },
    },
    styles: { importExtension: false },
    codegen: { chunkSize: 100 },
    plugins: {},
  }) as ResolvedSodaGqlConfig;

const createConfigContext = (appDir: string): ConfigContext => {
  const config = createAppConfig(appDir);
  const helper = createGraphqlSystemIdentifyHelper(config);
  const schemaResolver = createSchemaResolver(config)._unsafeUnwrap();
  const documentManager = createDocumentManager(helper);

  return {
    configPath: resolve(appDir, "soda-gql.config.ts"),
    config,
    helper,
    schemaResolver,
    documentManager,
  };
};

describe("multi-config integration", () => {
  const appADir = resolve(multiConfigDir, "app-a");
  const appBDir = resolve(multiConfigDir, "app-b");

  describe("findAllConfigFiles discovery", () => {
    test("discovers config files in multi-config fixture (when they exist)", () => {
      // findAllConfigFiles scans for actual soda-gql.config.ts files on disk.
      // Since our test fixtures don't have real config files (we construct configs in-memory),
      // we verify the function works with the real project root instead.
      const projectRoot = resolve(import.meta.dir, "../../../..");
      const configs = findAllConfigFiles(projectRoot);

      // Should find at least the root config
      expect(configs.length).toBeGreaterThan(0);
      expect(configs.every((p) => p.includes("soda-gql.config"))).toBe(true);
    });
  });

  describe("schema isolation between configs", () => {
    const ctxA = createConfigContext(appADir);
    const ctxB = createConfigContext(appBDir);

    test("app-a schema has users field, not products", () => {
      const entry = ctxA.schemaResolver.getSchema("default");
      expect(entry).toBeDefined();

      const queryType = entry!.schema.getQueryType();
      expect(queryType).toBeDefined();

      const fields = queryType!.getFields();
      expect(fields.users).toBeDefined();
      expect(fields.products).toBeUndefined();
    });

    test("app-b schema has products field, not users", () => {
      const entry = ctxB.schemaResolver.getSchema("default");
      expect(entry).toBeDefined();

      const queryType = entry!.schema.getQueryType();
      expect(queryType).toBeDefined();

      const fields = queryType!.getFields();
      expect(fields.products).toBeDefined();
      expect(fields.users).toBeUndefined();
    });

    test("completion in app-a suggests users, not products", () => {
      const source = `import { gql } from "@/graphql-system";

export const GetUsers = gql.default(({ query }) => query("GetUsers")\`{ }\`);`;
      const uri = resolve(appADir, "get-users.ts");
      const state = ctxA.documentManager.update(uri, 1, source);

      const template = state.templates[0]!;
      const entry = ctxA.schemaResolver.getSchema("default")!;

      // Position cursor inside "query { }" — after the opening brace
      const cursorInContent = template.content.indexOf("{ ") + 2;
      const cursorInSource = template.contentRange.start + cursorInContent;
      const lines = source.slice(0, cursorInSource).split("\n");
      const tsPosition = { line: lines.length - 1, character: lines[lines.length - 1]!.length };

      const items = handleCompletion({
        template,
        schema: entry.schema,
        tsSource: source,
        tsPosition,
      });

      const labels = items.map((i) => i.label);
      expect(labels).toContain("users");
      expect(labels).toContain("user");
      expect(labels).not.toContain("products");
      expect(labels).not.toContain("product");
    });

    test("completion in app-b suggests products, not users", () => {
      const source = `import { gql } from "@/graphql-system";

export const GetProducts = gql.default(({ query }) => query("GetProducts")\`{ }\`);`;
      const uri = resolve(appBDir, "get-products.ts");
      const state = ctxB.documentManager.update(uri, 1, source);

      const template = state.templates[0]!;
      const entry = ctxB.schemaResolver.getSchema("default")!;

      const cursorInContent = template.content.indexOf("{ ") + 2;
      const cursorInSource = template.contentRange.start + cursorInContent;
      const lines = source.slice(0, cursorInSource).split("\n");
      const tsPosition = { line: lines.length - 1, character: lines[lines.length - 1]!.length };

      const items = handleCompletion({
        template,
        schema: entry.schema,
        tsSource: source,
        tsPosition,
      });

      const labels = items.map((i) => i.label);
      expect(labels).toContain("products");
      expect(labels).toContain("product");
      expect(labels).not.toContain("users");
      expect(labels).not.toContain("user");
    });
  });

  describe("fragment isolation between configs", () => {
    test("fragments defined in app-a are NOT visible in app-b", () => {
      const ctxA = createConfigContext(appADir);
      const ctxB = createConfigContext(appBDir);

      // Register a fragment in app-a
      const fragmentSource = `import { gql } from "@/graphql-system";

export const UserFields = gql.default(({ fragment }) => fragment("UserFields", "User")\`{ id name }\`);`;
      const fragmentUri = resolve(appADir, "user-fields.ts");
      ctxA.documentManager.update(fragmentUri, 1, fragmentSource);

      // Check that app-a has the fragment
      const appAFragments = ctxA.documentManager.getAllFragments("default");
      expect(appAFragments.length).toBe(1);
      expect(appAFragments[0]!.fragmentName).toBe("UserFields");

      // Check that app-b does NOT have the fragment
      const appBFragments = ctxB.documentManager.getAllFragments("default");
      expect(appBFragments.length).toBe(0);
    });

    test("using unknown fragment in app-b produces diagnostic error", () => {
      const ctxB = createConfigContext(appBDir);

      const querySource = `import { gql } from "@/graphql-system";

export const Bad = gql.default(({ query }) => query("Bad")\`{ products { ...ProductFields } }\`);`;
      const queryUri = resolve(appBDir, "bad-query.ts");
      const state = ctxB.documentManager.update(queryUri, 1, querySource);

      const entry = ctxB.schemaResolver.getSchema("default")!;
      const externalFragments = ctxB.documentManager.getExternalFragments(queryUri, "default").map((f) => f.definition);

      const diagnostics = state.templates.flatMap((template) => [
        ...computeTemplateDiagnostics({
          template,
          schema: entry.schema,
          tsSource: querySource,
          externalFragments,
        }),
      ]);

      // Should have a diagnostic about unknown fragment
      const unknownFragmentErrors = diagnostics.filter((d) => d.message.includes("Unknown fragment"));
      expect(unknownFragmentErrors.length).toBeGreaterThan(0);
    });
  });

  describe("same schema name 'default' in different configs", () => {
    test("each config resolves 'default' to its own schema independently", () => {
      const ctxA = createConfigContext(appADir);
      const ctxB = createConfigContext(appBDir);

      const entryA = ctxA.schemaResolver.getSchema("default");
      const entryB = ctxB.schemaResolver.getSchema("default");

      expect(entryA).toBeDefined();
      expect(entryB).toBeDefined();

      // Both have the same schema name "default" but different content
      expect(entryA!.name).toBe("default");
      expect(entryB!.name).toBe("default");

      // Different hashes prove different schema content
      expect(entryA!.hash).not.toBe(entryB!.hash);
    });
  });
});

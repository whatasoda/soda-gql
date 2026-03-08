import { describe, expect, it } from "bun:test";
import type { GraphqlSystemIdentifyHelper } from "@soda-gql/builder";
import { extractTemplatesFromSource } from "./template-extractor";

/**
 * Create a test helper that recognizes any import from "./graphql-system" as a gql import.
 */
const createTestHelper = (): GraphqlSystemIdentifyHelper => ({
  isGraphqlSystemFile: () => false,
  isGraphqlSystemImportSpecifier: ({ specifier }) => specifier === "./graphql-system" || specifier === "@/graphql-system",
  isInternalModuleFile: () => false,
});

describe("extractTemplatesFromSource", () => {
  const helper = createTestHelper();

  it("extracts a single query template", () => {
    const source = `
      import { gql } from "./graphql-system";
      export const GetUser = gql.default(({ query }) =>
        query\`query GetUser($id: ID!) { user(id: $id) { id name } }\`
      );
    `;

    const { templates } = extractTemplatesFromSource("/src/a.ts", source, helper);

    expect(templates).toHaveLength(1);
    expect(templates[0]!.schemaName).toBe("default");
    expect(templates[0]!.kind).toBe("query");
    expect(templates[0]!.content).toContain("query GetUser");
  });

  it("extracts fragment template", () => {
    const source = `
      import { gql } from "./graphql-system";
      export const UserFields = gql.default(({ fragment }) =>
        fragment\`fragment UserFields on User { id name email }\`()
      );
    `;

    const { templates } = extractTemplatesFromSource("/src/a.ts", source, helper);

    expect(templates).toHaveLength(1);
    expect(templates[0]!.kind).toBe("fragment");
    expect(templates[0]!.content).toContain("fragment UserFields on User");
  });

  it("extracts multiple templates from multi-schema source", () => {
    const source = `
      import { gql } from "./graphql-system";

      export const GetUser = gql.default(({ query }) =>
        query\`query GetUser { user { id } }\`
      );

      export const AdminQuery = gql.admin(({ query }) =>
        query\`query AdminList { admins { id role } }\`
      );
    `;

    const { templates } = extractTemplatesFromSource("/src/a.ts", source, helper);

    expect(templates).toHaveLength(2);
    expect(templates[0]!.schemaName).toBe("default");
    expect(templates[1]!.schemaName).toBe("admin");
  });

  it("extracts template with metadata chaining", () => {
    const source = `
      import { gql } from "./graphql-system";
      export const GetUser = gql.default(({ query }) =>
        query\`query GetUser { user { id } }\`({ metadata: { cache: 60 } })
      );
    `;

    const { templates } = extractTemplatesFromSource("/src/a.ts", source, helper);

    expect(templates).toHaveLength(1);
    expect(templates[0]!.kind).toBe("query");
    expect(templates[0]!.content).toContain("query GetUser");
  });

  it("extracts from block body with return statement", () => {
    const source = `
      import { gql } from "./graphql-system";
      export const GetUser = gql.default(({ query }) => {
        return query\`query GetUser { user { id } }\`;
      });
    `;

    const { templates } = extractTemplatesFromSource("/src/a.ts", source, helper);

    expect(templates).toHaveLength(1);
    expect(templates[0]!.kind).toBe("query");
  });

  it("returns empty for files without gql imports", () => {
    const source = `
      import { something } from "./other-module";
      export const foo = something();
    `;

    const { templates } = extractTemplatesFromSource("/src/a.ts", source, helper);

    expect(templates).toHaveLength(0);
  });

  it("returns empty for invalid TypeScript", () => {
    const source = "this is not valid typescript {{{";

    const { templates, warnings } = extractTemplatesFromSource("/src/a.ts", source, helper);

    expect(templates).toHaveLength(0);
    // No warning because file doesn't contain "gql"
    expect(warnings).toHaveLength(0);
  });

  it("warns when gql-containing file fails to parse", () => {
    const source = "import { gql } from './graphql-system'; this is not valid {{{";

    const { templates, warnings } = extractTemplatesFromSource("/src/bad.ts", source, helper);

    expect(templates).toHaveLength(0);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("/src/bad.ts");
  });

  it("skips templates with interpolation expressions", () => {
    const source = `
      import { gql } from "./graphql-system";
      export const GetUser = gql.default(({ query }) =>
        query\`query GetUser { \${someField} }\`
      );
    `;

    const { templates } = extractTemplatesFromSource("/src/a.ts", source, helper);

    expect(templates).toHaveLength(0);
  });

  it("extracts mutation and subscription kinds", () => {
    const source = `
      import { gql } from "./graphql-system";
      export const CreateUser = gql.default(({ mutation }) =>
        mutation\`mutation CreateUser($input: CreateUserInput!) { createUser(input: $input) { id } }\`
      );
      export const OnUser = gql.default(({ subscription }) =>
        subscription\`subscription OnUserCreated { userCreated { id } }\`
      );
    `;

    const { templates } = extractTemplatesFromSource("/src/a.ts", source, helper);

    expect(templates).toHaveLength(2);
    expect(templates[0]!.kind).toBe("mutation");
    expect(templates[1]!.kind).toBe("subscription");
  });

  it("extracts templates from method-chained gql calls", () => {
    const source = `
      import { gql } from "./graphql-system";
      export const GetUser = gql.default(({ query }) =>
        query\`query GetUser { user { id } }\`
      ).attach("module", "/src/a.ts");
    `;

    const { templates } = extractTemplatesFromSource("/src/a.ts", source, helper);

    expect(templates).toHaveLength(1);
    expect(templates[0]!.kind).toBe("query");
  });

  it("handles tsx file extension", () => {
    const source = `
      import { gql } from "./graphql-system";
      const Component = () => <div />;
      export const GetUser = gql.default(({ query }) =>
        query\`query GetUser { user { id } }\`
      );
    `;

    const { templates } = extractTemplatesFromSource("/src/component.tsx", source, helper);

    expect(templates).toHaveLength(1);
  });

  it("handles alias import specifier", () => {
    const source = `
      import { gql } from "@/graphql-system";
      export const GetUser = gql.default(({ query }) =>
        query\`query GetUser { user { id } }\`
      );
    `;

    const { templates } = extractTemplatesFromSource("/src/a.ts", source, helper);

    expect(templates).toHaveLength(1);
  });

  describe("curried syntax (new API)", () => {
    it("extracts curried query template", () => {
      const source = `
        import { gql } from "./graphql-system";
        export const GetUser = gql.default(({ query }) =>
          query("GetUser")\`($id: ID!) { user(id: $id) { id name } }\`
        );
      `;

      const { templates } = extractTemplatesFromSource("/src/a.ts", source, helper);

      expect(templates).toHaveLength(1);
      expect(templates[0]!.schemaName).toBe("default");
      expect(templates[0]!.kind).toBe("query");
      expect(templates[0]!.elementName).toBe("GetUser");
      expect(templates[0]!.typeName).toBeUndefined();
      expect(templates[0]!.content).toContain("user(id: $id)");
    });

    it("extracts curried fragment template with type name", () => {
      const source = `
        import { gql } from "./graphql-system";
        export const UserFields = gql.default(({ fragment }) =>
          fragment("UserFields", "User")\`{ id name email }\`()
        );
      `;

      const { templates } = extractTemplatesFromSource("/src/a.ts", source, helper);

      expect(templates).toHaveLength(1);
      expect(templates[0]!.kind).toBe("fragment");
      expect(templates[0]!.elementName).toBe("UserFields");
      expect(templates[0]!.typeName).toBe("User");
      expect(templates[0]!.content).toContain("id name email");
    });

    it("extracts curried mutation and subscription", () => {
      const source = `
        import { gql } from "./graphql-system";
        export const CreateUser = gql.default(({ mutation }) =>
          mutation("CreateUser")\`($input: CreateUserInput!) { createUser(input: $input) { id } }\`
        );
        export const OnUser = gql.default(({ subscription }) =>
          subscription("OnUserCreated")\`{ userCreated { id } }\`
        );
      `;

      const { templates } = extractTemplatesFromSource("/src/a.ts", source, helper);

      expect(templates).toHaveLength(2);
      expect(templates[0]!.kind).toBe("mutation");
      expect(templates[0]!.elementName).toBe("CreateUser");
      expect(templates[1]!.kind).toBe("subscription");
      expect(templates[1]!.elementName).toBe("OnUserCreated");
    });

    it("handles curried template with metadata chaining", () => {
      const source = `
        import { gql } from "./graphql-system";
        export const GetUser = gql.default(({ query }) =>
          query("GetUser")\`{ user { id } }\`({ metadata: { cache: 60 } })
        );
      `;

      const { templates } = extractTemplatesFromSource("/src/a.ts", source, helper);

      expect(templates).toHaveLength(1);
      expect(templates[0]!.elementName).toBe("GetUser");
    });

    it("handles curried template with interpolation (fragment spread)", () => {
      const source = `
        import { gql } from "./graphql-system";
        export const GetUser = gql.default(({ query }) =>
          query("GetUser")\`{ user(id: "1") { ...\${userFields} } }\`
        );
      `;

      const { templates } = extractTemplatesFromSource("/src/a.ts", source, helper);

      expect(templates).toHaveLength(1);
      expect(templates[0]!.elementName).toBe("GetUser");
      // Interpolation replaced with placeholder
      expect(templates[0]!.content).toContain("__FRAG_SPREAD_0__");
    });

    it("old-syntax interpolation is still skipped", () => {
      const source = `
        import { gql } from "./graphql-system";
        export const GetUser = gql.default(({ query }) =>
          query\`query GetUser { \${someField} }\`
        );
      `;

      const { templates } = extractTemplatesFromSource("/src/a.ts", source, helper);

      expect(templates).toHaveLength(0);
    });
  });
});

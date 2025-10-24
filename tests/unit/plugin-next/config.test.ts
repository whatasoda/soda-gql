/**
 * Unit tests for @soda-gql/plugin-next configuration wrapper
 */

import { describe, expect, it } from "bun:test";
import { withSodaGql } from "@soda-gql/plugin-next";

describe("withSodaGql", () => {
  it("should add soda-gql swc plugin to empty config", () => {
    const result = withSodaGql({}, { configPath: "./soda-gql.config.ts" });

    expect(result.experimental?.swcPlugins).toBeDefined();
    expect(result.experimental?.swcPlugins).toHaveLength(1);
    expect(result.experimental?.swcPlugins?.[0]).toEqual(["@soda-gql/plugin-swc", { configPath: "./soda-gql.config.ts" }]);
  });

  it("should preserve existing Next.js config options", () => {
    const result = withSodaGql(
      {
        reactStrictMode: true,
        swcMinify: true,
        images: {
          domains: ["example.com"],
        },
      },
      { configPath: "./soda-gql.config.ts" },
    );

    expect(result.reactStrictMode).toBe(true);
    expect(result.swcMinify).toBe(true);
    expect(result.images).toEqual({ domains: ["example.com"] });
  });

  it("should preserve existing SWC plugins", () => {
    const result = withSodaGql(
      {
        experimental: {
          swcPlugins: [["@swc/plugin-styled-components", { displayName: true }]],
        },
      },
      { configPath: "./soda-gql.config.ts" },
    );

    expect(result.experimental?.swcPlugins).toHaveLength(2);
    expect(result.experimental?.swcPlugins?.[0]).toEqual(["@soda-gql/plugin-swc", { configPath: "./soda-gql.config.ts" }]);
    expect(result.experimental?.swcPlugins?.[1]).toEqual(["@swc/plugin-styled-components", { displayName: true }]);
  });

  it("should preserve other experimental options", () => {
    const result = withSodaGql(
      {
        experimental: {
          serverActions: true,
          serverComponentsExternalPackages: ["some-package"],
        },
      },
      { configPath: "./soda-gql.config.ts" },
    );

    expect(result.experimental?.serverActions).toBe(true);
    expect(result.experimental?.serverComponentsExternalPackages).toEqual(["some-package"]);
  });

  it("should work with default options", () => {
    const result = withSodaGql();

    expect(result.experimental?.swcPlugins).toBeDefined();
    expect(result.experimental?.swcPlugins).toHaveLength(1);
    expect(result.experimental?.swcPlugins?.[0]).toEqual(["@soda-gql/plugin-swc", {}]);
  });

  it("should support enabled/disabled flag", () => {
    const result = withSodaGql({}, { enabled: false });

    expect(result.experimental?.swcPlugins).toBeDefined();
    expect(result.experimental?.swcPlugins?.[0]).toEqual(["@soda-gql/plugin-swc", { enabled: false }]);
  });
});

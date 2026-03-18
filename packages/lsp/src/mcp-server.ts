/**
 * MCP server: exposes soda-gql GraphQL intelligence as MCP tools for Claude Code.
 * @module
 */

import { readFileSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { findAllConfigFiles } from "@soda-gql/config";
import { z } from "zod";
import { type ConfigRegistry, createConfigRegistry } from "./config-registry";

/** Start the MCP server with soda-gql tools. Blocks until the transport closes. */
export const startMcpServer = async (): Promise<void> => {
  const server = new McpServer({ name: "soda-gql", version: "0.14.1" });

  // Lazy-initialized registry (created on first tool call)
  let registry: ConfigRegistry | undefined;

  const ensureInitialized = (): ConfigRegistry => {
    if (registry) return registry;
    const cwd = process.cwd();
    const configPaths = findAllConfigFiles(cwd);
    if (configPaths.length === 0) {
      throw new Error(`No soda-gql config found in ${cwd}`);
    }
    const result = createConfigRegistry(configPaths);
    if (result.isErr()) {
      throw new Error(`Config initialization failed: ${result.error.message}`);
    }
    registry = result.value;
    return registry;
  };

  // eslint-disable-next-line -- MCP SDK tool() triggers TS2589 with Zod v4; runtime works correctly
  server.tool(
    "soda-gql-symbols",
    "List GraphQL fragments and operations defined in a TypeScript file, with type information (fragment type conditions, operation kinds, variable declarations). Returns JSON array.",
    { filePath: z.string().describe("Absolute path to a .ts or .tsx file") },
    // @ts-expect-error TS2589: Type instantiation depth limit with Zod v4 + MCP SDK generics
    async ({ filePath }: { filePath: string }) => {
      try {
        const reg = ensureInitialized();
        const ctx = reg.resolveForUri(filePath);
        if (!ctx) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: `No soda-gql config covers ${filePath}` }) }],
            isError: true,
          };
        }

        const source = readFileSync(filePath, "utf-8");
        const state = ctx.documentManager.update(filePath, 1, source);

        const symbols = state.templates
          .filter((t) => t.elementName)
          .map((t) => ({
            name: t.elementName!,
            kind: t.kind,
            typeName: t.typeName,
            schemaName: t.schemaName,
            variables: extractVariablesFromContent(t.content),
            line: computeLineFromOffset(source, t.contentRange.start),
          }));

        return { content: [{ type: "text" as const, text: JSON.stringify(symbols, null, 2) }] };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: String(error) }) }],
          isError: true,
        };
      }
    },
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
};

/** Extract variable declaration from template content (e.g., "($id: ID!)"). */
const extractVariablesFromContent = (content: string): string | undefined => {
  const match = content.match(/^\s*\(([^)]+)\)/);
  return match ? `(${match[1]})` : undefined;
};

/** Compute 1-based line number from a byte offset in source. */
const computeLineFromOffset = (source: string, offset: number): number => {
  let line = 1;
  for (let i = 0; i < offset && i < source.length; i++) {
    if (source[i] === "\n") line++;
  }
  return line;
};

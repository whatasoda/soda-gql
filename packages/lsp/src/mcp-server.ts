/**
 * MCP server: exposes soda-gql GraphQL intelligence as MCP tools for Claude Code.
 * @module
 */

import { readFileSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { findAllConfigFiles } from "@soda-gql/config";
import { err, ok, type Result } from "neverthrow";
import { z } from "zod";
import { type ConfigRegistry, createConfigRegistry } from "./config-registry";
import type { LspError } from "./errors";

type McpTextContent = { type: "text"; text: string };
type McpToolResult = { content: McpTextContent[]; isError?: boolean };

const errorResult = (message: string): McpToolResult => ({
  content: [{ type: "text", text: JSON.stringify({ error: message }) }],
  isError: true,
});

/** Start the MCP server with soda-gql tools. Blocks until the transport closes. */
export const startMcpServer = async (): Promise<void> => {
  const server = new McpServer({ name: "soda-gql", version: "0.14.1" });

  // Lazy-initialized registry (created on first tool call)
  let registry: ConfigRegistry | undefined;

  const ensureInitialized = (): Result<ConfigRegistry, LspError> => {
    if (registry) return ok(registry);
    const cwd = process.cwd();
    const configPaths = findAllConfigFiles(cwd);
    if (configPaths.length === 0) {
      return err({ code: "CONFIG_LOAD_FAILED", message: `No soda-gql config found in ${cwd}` } as LspError);
    }
    const result = createConfigRegistry(configPaths);
    if (result.isOk()) {
      registry = result.value;
    }
    return result;
  };

  // eslint-disable-next-line -- MCP SDK tool() triggers TS2589 with Zod v4; runtime works correctly
  server.tool(
    "soda-gql-symbols",
    "List GraphQL fragments and operations defined in a TypeScript file, with type information (fragment type conditions, operation kinds, variable declarations). Returns JSON array.",
    { filePath: z.string().describe("Absolute path to a .ts or .tsx file") },
    // @ts-expect-error TS2589: Type instantiation depth limit with Zod v4 + MCP SDK generics
    async ({ filePath }: { filePath: string }): Promise<McpToolResult> => {
      const regResult = ensureInitialized();
      if (regResult.isErr()) return errorResult(regResult.error.message);

      const ctx = regResult.value.resolveForUri(filePath);
      if (!ctx) return errorResult(`No soda-gql config covers ${filePath}`);

      let source: string;
      try {
        source = readFileSync(filePath, "utf-8");
      } catch (e) {
        return errorResult(`Failed to read file: ${e instanceof Error ? e.message : String(e)}`);
      }

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

      return { content: [{ type: "text", text: JSON.stringify(symbols, null, 2) }] };
    },
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
};

/** Extract variable declaration from template content (e.g., "($id: ID!)"). */
export const extractVariablesFromContent = (content: string): string | undefined => {
  const match = content.match(/^\s*\(([^)]+)\)/);
  return match ? `(${match[1]})` : undefined;
};

/** Compute 1-based line number from a byte offset in source. */
export const computeLineFromOffset = (source: string, offset: number): number => {
  let line = 1;
  for (let i = 0; i < offset && i < source.length; i++) {
    if (source[i] === "\n") line++;
  }
  return line;
};

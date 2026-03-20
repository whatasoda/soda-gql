/**
 * MCP server: exposes soda-gql GraphQL intelligence as MCP tools for Claude Code.
 * @module
 */

import { readFileSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { resolveEntryPaths } from "@soda-gql/builder";
import { findAllConfigFiles } from "@soda-gql/config";
import {
  type GraphQLNamedType,
  type GraphQLSchema,
  isEnumType,
  isInputObjectType,
  isInterfaceType,
  isObjectType,
  isScalarType,
  isUnionType,
} from "graphql";
import { err, ok, type Result } from "neverthrow";
import { z } from "zod";
import type { ConfigContext, ConfigRegistry } from "./config-registry";
import { createConfigRegistry } from "./config-registry";
import { collectRawDiagnostics } from "./diagnostics-collector";
import type { LspError } from "./errors";
import type { DocumentState } from "./types";

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

  let indexed = false;
  const ensureWorkspaceIndexed = (reg: ConfigRegistry): void => {
    if (indexed) return;
    indexed = true;
    for (const ctx of reg.getAllContexts()) {
      const filesResult = resolveEntryPaths(ctx.config.include, ctx.config.exclude);
      if (filesResult.isErr()) continue;
      for (const filePath of filesResult.value) {
        if (ctx.documentManager.get(filePath)) continue;
        try {
          const source = readFileSync(filePath, "utf-8");
          ctx.documentManager.update(filePath, 1, source);
        } catch { /* skip unreadable files */ }
      }
    }
  };

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
    "soda-gql-diagnostics",
    "Validate GraphQL templates and field selections in a TypeScript file against the schema. Returns JSON array of diagnostics with message, line, column, and severity.",
    { filePath: z.string().describe("Absolute path to a .ts or .tsx file") },
    // @ts-expect-error TS2589: Type instantiation depth limit with Zod v4 + MCP SDK generics
    async ({ filePath }: { filePath: string }): Promise<McpToolResult> => {
      const regResult = ensureInitialized();
      if (regResult.isErr()) return errorResult(regResult.error.message);
      ensureWorkspaceIndexed(regResult.value);

      const ctx = regResult.value.resolveForUri(filePath);
      if (!ctx) return errorResult(`No soda-gql config covers ${filePath}`);

      let source: string;
      try {
        source = readFileSync(filePath, "utf-8");
      } catch (e) {
        return errorResult(`Failed to read file: ${e instanceof Error ? e.message : String(e)}`);
      }

      const state = ctx.documentManager.update(filePath, 1, source);
      const diagnostics = collectDiagnostics(state, ctx);
      return { content: [{ type: "text", text: JSON.stringify(diagnostics, null, 2) }] };
    },
  );

  // eslint-disable-next-line -- MCP SDK tool() triggers TS2589 with Zod v4; runtime works correctly
  server.tool(
    "soda-gql-schema",
    "Introspect GraphQL schema types. With typeName: returns fields, args, and types for that type (depth-1). Without typeName: returns all type names and kinds. Use filePath to select config context in multi-config projects.",
    {
      typeName: z.string().optional().describe("GraphQL type name (e.g. 'User'). Omit to list all types."),
      schemaName: z.string().optional().describe("Schema name for multi-schema projects."),
      filePath: z.string().optional().describe("File path to determine config context. Omit for single-config projects."),
    },
    async ({
      typeName,
      schemaName,
      filePath,
    }: { typeName?: string; schemaName?: string; filePath?: string }): Promise<McpToolResult> => {
      const regResult = ensureInitialized();
      if (regResult.isErr()) return errorResult(regResult.error.message);

      const ctx = filePath ? regResult.value.resolveForUri(filePath) : regResult.value.getAllContexts()[0];
      if (!ctx) return errorResult("No soda-gql config context found");

      const targetSchemaName = schemaName ?? ctx.schemaResolver.getSchemaNames()[0];
      if (!targetSchemaName) return errorResult("No schema available");
      const entry = ctx.schemaResolver.getSchema(targetSchemaName);
      if (!entry) return errorResult(`Schema '${targetSchemaName}' not found`);

      if (typeName) {
        const result = introspectType(entry.schema, typeName);
        if (!result) return errorResult(`Type '${typeName}' not found in schema`);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
      return { content: [{ type: "text", text: JSON.stringify(listTypes(entry.schema), null, 2) }] };
    },
  );

  // eslint-disable-next-line -- MCP SDK tool() triggers TS2589 with Zod v4; runtime works correctly
  server.tool(
    "soda-gql-symbols",
    "List GraphQL fragments and operations defined in a TypeScript file, with type information (fragment type conditions, operation kinds, variable declarations). Returns JSON array.",
    { filePath: z.string().describe("Absolute path to a .ts or .tsx file") },
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

/** Collect diagnostics and map to JSON-serializable format. */
type DiagnosticResult = { message: string; line: number; column: number; severity: string };

export const collectDiagnostics = (state: DocumentState, ctx: ConfigContext): DiagnosticResult[] => {
  const diagnostics = collectRawDiagnostics(state, ctx);
  return [...diagnostics].map((d) => ({
    message: d.message,
    line: d.range.start.line + 1,
    column: d.range.start.character + 1,
    severity: diagnosticSeverityToString(d.severity),
  }));
};

export const diagnosticSeverityToString = (severity: number | undefined): string => {
  switch (severity) {
    case 1:
      return "Error";
    case 2:
      return "Warning";
    case 3:
      return "Information";
    case 4:
      return "Hint";
    default:
      return "Error";
  }
};

/** Introspect a single GraphQL type (depth-1). */
export const introspectType = (schema: GraphQLSchema, typeName: string) => {
  const type = schema.getType(typeName);
  if (!type) return undefined;

  if (isObjectType(type) || isInterfaceType(type)) {
    const fields = Object.values(type.getFields()).map((f) => ({
      name: f.name,
      type: f.type.toString(),
      args: f.args.map((a) => ({ name: a.name, type: a.type.toString() })),
    }));
    return { name: type.name, kind: isObjectType(type) ? "OBJECT" : "INTERFACE", fields };
  }
  if (isUnionType(type)) {
    return { name: type.name, kind: "UNION", members: type.getTypes().map((t) => ({ name: t.name })) };
  }
  if (isEnumType(type)) {
    return { name: type.name, kind: "ENUM", values: type.getValues().map((v) => ({ name: v.name })) };
  }
  if (isInputObjectType(type)) {
    const fields = Object.values(type.getFields()).map((f) => ({
      name: f.name,
      type: f.type.toString(),
    }));
    return { name: type.name, kind: "INPUT_OBJECT", fields };
  }
  if (isScalarType(type)) {
    return { name: type.name, kind: "SCALAR" };
  }
  return undefined;
};

/** List all user-defined types in a schema. */
export const listTypes = (schema: GraphQLSchema) => {
  const typeMap = schema.getTypeMap();
  const types = Object.values(typeMap)
    .filter((t) => !t.name.startsWith("__"))
    .map((t) => ({ name: t.name, kind: getTypeKind(t) }));
  return { types };
};

const getTypeKind = (type: GraphQLNamedType): string => {
  if (isObjectType(type)) return "OBJECT";
  if (isInterfaceType(type)) return "INTERFACE";
  if (isUnionType(type)) return "UNION";
  if (isEnumType(type)) return "ENUM";
  if (isInputObjectType(type)) return "INPUT_OBJECT";
  if (isScalarType(type)) return "SCALAR";
  return "UNKNOWN";
};

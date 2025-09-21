#!/usr/bin/env bun
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  buildSchema,
  type GraphQLArgument,
  type GraphQLField,
  type GraphQLNamedType,
  type GraphQLSchema,
  type GraphQLType,
  isEnumType,
  isInputObjectType,
  isInterfaceType,
  isListType,
  isNonNullType,
  isObjectType,
  isScalarType,
  isUnionType,
  printSchema,
} from "graphql";
import { err, ok, type Result } from "neverthrow";

export type CodegenFormat = "json" | "human";

export type CodegenOptions = {
  readonly schemaPath: string;
  readonly outPath: string;
  readonly format: CodegenFormat;
};

export type CodegenError =
  | {
      readonly code: "SCHEMA_NOT_FOUND";
      readonly message: string;
      readonly schemaPath: string;
    }
  | {
      readonly code: "SCHEMA_INVALID";
      readonly message: string;
      readonly schemaPath: string;
    }
  | {
      readonly code: "EMIT_FAILED";
      readonly message: string;
      readonly outPath: string;
    };

type CodegenSuccess = {
  readonly schemaHash: string;
  readonly outPath: string;
  readonly objects: number;
  readonly enums: number;
  readonly inputs: number;
  readonly unions: number;
};

const builtinScalars = new Map<string, string>([
  ["ID", "string"],
  ["String", "string"],
  ["Int", "number"],
  ["Float", "number"],
  ["Boolean", "boolean"],
]);

const formatForGraphqlType = (type: GraphQLType): string => {
  if (isNonNullType(type)) {
    const innerFormat = formatForGraphqlType(type.ofType);
    return innerFormat.startsWith("?") ? innerFormat.replace("?", "!") : `!${innerFormat}`;
  }

  if (isListType(type)) {
    const inner = type.ofType;
    const itemFlag = isNonNullType(inner) ? "!" : "?";
    return `?[]${itemFlag}`;
  }

  return "?";
};

const unwrapNamedType = (type: GraphQLType): GraphQLNamedType => {
  let current: GraphQLType = type;
  while (isNonNullType(current) || isListType(current)) {
    current = (current as { ofType: GraphQLType }).ofType;
  }
  return current as GraphQLNamedType;
};

const renderFieldType = (type: GraphQLType): string => {
  const format = formatForGraphqlType(type);
  const named = unwrapNamedType(type);

  if (isScalarType(named)) {
    return `unsafeRef.scalar("${named.name}", "${format}")`;
  }

  if (isEnumType(named)) {
    return `unsafeRef.enum("${named.name}", "${format}")`;
  }

  if (isUnionType(named)) {
    return `unsafeRef.union("${named.name}", "${format}")`;
  }

  if (isInputObjectType(named)) {
    return `unsafeRef.input("${named.name}", "${format}")`;
  }

  return `unsafeRef.object("${named.name}", "${format}")`;
};

const renderArgumentMap = (args: readonly GraphQLArgument[]): string => {
  const entries = args.map((arg) => `${arg.name}: ${renderFieldType(arg.type)}`);

  if (entries.length === 0) {
    return "{}";
  }

  return `{
    ${entries.join(",\n    ")}
  }`;
};

const renderFieldMap = (fields: Record<string, GraphQLField<unknown, unknown>>): string => {
  const lines = Object.keys(fields)
    .map((fieldName) => {
      const field = fields[fieldName];
      if (!field) {
        return null;
      }

      return `${fieldName}: {
      arguments: ${renderArgumentMap(field.args)},
      type: ${renderFieldType(field.type)},
    }`;
    })
    .filter((line): line is string => line !== null);

  if (lines.length === 0) {
    return "{}";
  }

  return `{
    ${lines.join(",\n    ")}
  }`;
};

const renderObjectDefinition = (schema: GraphQLSchema, typeName: string): string => {
  const type = schema.getType(typeName);
  if (!type || !isObjectType(type)) {
    return "";
  }

  const fields = renderFieldMap(type.getFields());

  return `...define("${type.name}").object(${fields})`;
};

const renderInputDefinition = (schema: GraphQLSchema, typeName: string): string => {
  const type = schema.getType(typeName);
  if (!type || !isInputObjectType(type)) {
    return "";
  }

  const entries = Object.keys(type.getFields()).map((fieldName) => {
    const field = type.getFields()[fieldName];
    return `${fieldName}: ${renderFieldType(field.type)}`;
  });

  const body =
    entries.length === 0
      ? "{}"
      : `{
    ${entries.join(",\n    ")}
  }`;

  return `...define("${type.name}").input(${body})`;
};

const renderEnumDefinition = (schema: GraphQLSchema, typeName: string): string => {
  const type = schema.getType(typeName);
  if (!type || !isEnumType(type)) {
    return "";
  }

  const values = type
    .getValues()
    .map((value) => `${value.name}: true`)
    .join(", ");
  return `...define("${type.name}").enum({ ${values} })`;
};

const renderUnionDefinition = (schema: GraphQLSchema, typeName: string): string => {
  const type = schema.getType(typeName);
  if (!type || !isUnionType(type)) {
    return "";
  }

  const values = type
    .getTypes()
    .map((member) => `${member.name}: true`)
    .join(", ");

  return `...define("${type.name}").union({ ${values} })`;
};

const renderScalarDefinition = (typeName: string): string => {
  const tsType = builtinScalars.get(typeName) ?? "string";
  return `...define("${typeName}").scalar<${tsType}>()`;
};

const collectObjectTypeNames = (schema: GraphQLSchema): string[] =>
  Object.keys(schema.getTypeMap())
    .filter((name) => !name.startsWith("__"))
    .filter((name) => {
      const type = schema.getType(name);
      return type !== undefined && isObjectType(type) && !isInterfaceType(type);
    })
    .sort();

const collectInputTypeNames = (schema: GraphQLSchema): string[] =>
  Object.keys(schema.getTypeMap())
    .filter((name) => !name.startsWith("__"))
    .filter((name) => {
      const type = schema.getType(name);
      return type !== undefined && isInputObjectType(type);
    })
    .sort();

const collectEnumTypeNames = (schema: GraphQLSchema): string[] =>
  Object.keys(schema.getTypeMap())
    .filter((name) => !name.startsWith("__"))
    .filter((name) => {
      const type = schema.getType(name);
      return type !== undefined && isEnumType(type);
    })
    .sort();

const collectUnionTypeNames = (schema: GraphQLSchema): string[] =>
  Object.keys(schema.getTypeMap())
    .filter((name) => !name.startsWith("__"))
    .filter((name) => {
      const type = schema.getType(name);
      return type !== undefined && isUnionType(type);
    })
    .sort();

const collectScalarNames = (schema: GraphQLSchema): string[] =>
  Object.keys(schema.getTypeMap())
    .filter((name) => !name.startsWith("__"))
    .filter((name) => {
      const type = schema.getType(name);
      return type !== undefined && isScalarType(type);
    })
    .sort();

const generateRuntimeModule = (schema: GraphQLSchema): string => {
  const scalarDefinitions = collectScalarNames(schema)
    .filter((name) => !builtinScalars.has(name))
    .map((name) => renderScalarDefinition(name));

  const objectTypeNames = collectObjectTypeNames(schema);
  const enumTypeNames = collectEnumTypeNames(schema);
  const inputTypeNames = collectInputTypeNames(schema);
  const unionTypeNames = collectUnionTypeNames(schema);

  const scalarBlock = `{
    ${Array.from(builtinScalars.keys())
      .map((name) => renderScalarDefinition(name))
      .concat(scalarDefinitions)
      .join(",\n    ")}
  }`;

  const enumBlock =
    enumTypeNames.length === 0
      ? "{}"
      : `{
    ${enumTypeNames.map((name) => renderEnumDefinition(schema, name)).join(",\n    ")}
  }`;

  const inputBlock =
    inputTypeNames.length === 0
      ? "{}"
      : `{
    ${inputTypeNames.map((name) => renderInputDefinition(schema, name)).join(",\n    ")}
  }`;

  const objectBlock =
    objectTypeNames.length === 0
      ? "{}"
      : `{
    ${objectTypeNames.map((name) => renderObjectDefinition(schema, name)).join(",\n    ")}
  }`;

  const unionBlock =
    unionTypeNames.length === 0
      ? "{}"
      : `{
    ${unionTypeNames.map((name) => renderUnionDefinition(schema, name)).join(",\n    ")}
  }`;

  const queryType = schema.getQueryType()?.name ?? "Query";
  const mutationType = schema.getMutationType()?.name ?? "Mutation";
  const subscriptionType = schema.getSubscriptionType()?.name ?? "Subscription";

  return `import { createGql } from "@soda-gql/core";
import { define } from "@soda-gql/core/types/schema";
import { createRefFactories, unsafeRef } from "@soda-gql/core/types/type-ref";
import type { GraphqlAdapter } from "@soda-gql/core/types/adapter";

const schema = {
  schema: {
    query: "${queryType}",
    mutation: "${mutationType}",
    subscription: "${subscriptionType}",
  },
  scalar: ${scalarBlock},
  enum: ${enumBlock},
  input: ${inputBlock},
  object: ${objectBlock},
  union: ${unionBlock},
} as const;

const adapter: GraphqlAdapter = {
  createError: (raw) => raw,
};

export const gql = createGql({
  schema,
  adapter,
});

export { schema };
export type GeneratedSchema = typeof schema;
`;
};

const parseArgs = (argv: readonly string[]): Result<CodegenOptions, CodegenError> => {
  const args = [...argv];
  let schemaPath: string | undefined;
  let outPath: string | undefined;
  let format: CodegenFormat = "human";

  while (args.length > 0) {
    const current = args.shift();
    if (!current) {
      break;
    }

    if (current === "--schema") {
      const value = args.shift();
      if (!value) {
        return err({
          code: "SCHEMA_INVALID",
          message: "Missing value for --schema",
          schemaPath: "",
        });
      }
      schemaPath = value;
      continue;
    }

    if (current === "--out") {
      const value = args.shift();
      if (!value) {
        return err({
          code: "EMIT_FAILED",
          message: "Missing value for --out",
          outPath: "",
        });
      }
      outPath = value;
      continue;
    }

    if (current === "--format") {
      const value = args.shift();
      if (value !== "json" && value !== "human") {
        return err({
          code: "SCHEMA_INVALID",
          message: `Unsupported format: ${value}`,
          schemaPath: schemaPath ?? "",
        });
      }
      format = value;
    }
  }

  if (!schemaPath) {
    return err({
      code: "SCHEMA_NOT_FOUND",
      message: "Schema path not provided",
      schemaPath: "",
    });
  }

  if (!outPath) {
    return err({
      code: "EMIT_FAILED",
      message: "Output path not provided",
      outPath: "",
    });
  }

  return ok({ schemaPath, outPath, format });
};

const loadSchema = (schemaPath: string): Result<GraphQLSchema, CodegenError> => {
  if (!existsSync(schemaPath)) {
    return err({
      code: "SCHEMA_NOT_FOUND",
      message: `Schema file not found at ${schemaPath}`,
      schemaPath,
    });
  }

  try {
    const schemaSource = readFileSync(schemaPath, "utf8");
    const schema = buildSchema(schemaSource);
    return ok(schema);
  } catch (error) {
    return err({
      code: "SCHEMA_INVALID",
      message: `SchemaValidationError: ${(error as Error).message}`,
      schemaPath,
    });
  }
};

const ensureDirectory = (filePath: string) => {
  const directory = dirname(filePath);
  mkdirSync(directory, { recursive: true });
};

const writeModule = (outPath: string, content: string): Result<void, CodegenError> => {
  try {
    ensureDirectory(outPath);
    writeFileSync(outPath, content);
    return ok(undefined);
  } catch (error) {
    return err({
      code: "EMIT_FAILED",
      message: (error as Error).message,
      outPath,
    });
  }
};

const hashSchema = (schema: GraphQLSchema): string => createHash("sha256").update(printSchema(schema)).digest("hex");

export const runCodegen = (options: CodegenOptions): Result<CodegenSuccess, CodegenError> =>
  loadSchema(resolve(options.schemaPath)).andThen((schema) => {
    const moduleContents = generateRuntimeModule(schema);
    const writeResult = writeModule(resolve(options.outPath), moduleContents);
    if (writeResult.isErr()) {
      return err(writeResult.error);
    }

    return ok<CodegenSuccess, CodegenError>({
      schemaHash: hashSchema(schema),
      outPath: resolve(options.outPath),
      objects: collectObjectTypeNames(schema).length,
      enums: collectEnumTypeNames(schema).length,
      inputs: collectInputTypeNames(schema).length,
      unions: collectUnionTypeNames(schema).length,
    });
  });

const outputJson = (payload: unknown) => {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
};

const outputHuman = (message: string) => {
  process.stdout.write(`${message}\n`);
};

export const runCodegenCli = (argv: readonly string[]): number => {
  const parsed = parseArgs(argv);

  if (parsed.isErr()) {
    const error = parsed.error;
    if (parsed.error.code === "SCHEMA_NOT_FOUND" || parsed.error.code === "SCHEMA_INVALID") {
      outputJson({ error });
      return 1;
    }

    outputJson({ error });
    return 1;
  }

  const result = runCodegen(parsed.value);

  if (result.isErr()) {
    const error = result.error;
    if (parsed.value.format === "json") {
      outputJson({ error });
    } else {
      outputHuman(`${error.code}: ${error.message}`);
    }

    return 1;
  }

  const success = result.value;
  if (parsed.value.format === "json") {
    outputJson(success);
  } else {
    outputHuman(`Generated ${success.objects} objects → ${success.outPath}`);
  }

  return 0;
};

if (import.meta.main) {
  const exitCode = runCodegenCli(Bun.argv.slice(2));
  process.exit(exitCode);
}

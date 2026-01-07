/**
 * Prebuilt types emitter.
 *
 * Generates TypeScript type definitions for PrebuiltTypes registry
 * from field selection data and schema.
 *
 * @module
 */

import { writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import type { AnyGraphqlSchema, InputTypeSpecifiers, TypeFormatters } from "@soda-gql/core";
import { calculateFieldsType, generateInputObjectType, generateInputType, generateInputTypeFromSpecifiers } from "@soda-gql/core";
import { Kind, type TypeNode, type VariableDefinitionNode } from "graphql";
import { err, ok, type Result } from "neverthrow";
import { type BuilderError, builderErrors } from "../errors";
import type { FieldSelectionsMap } from "./extractor";

/**
 * Options for emitting prebuilt types.
 */
export type PrebuiltTypesEmitterOptions = {
  /**
   * Schema definitions per schema name.
   * These come from the codegen output.
   */
  readonly schemas: Record<string, AnyGraphqlSchema>;
  /**
   * Field selections extracted from the builder.
   */
  readonly fieldSelections: FieldSelectionsMap;
  /**
   * Output directory (where prebuilt/types.ts should be written).
   * This should be the same as config.outdir.
   */
  readonly outdir: string;
  /**
   * Inject configuration per schema.
   * Maps schema name to inject file paths (absolute paths).
   */
  readonly injects: Record<string, { readonly scalars: string }>;
};

type PrebuiltTypeEntry = {
  readonly key: string;
  readonly inputType: string;
  readonly outputType: string;
};

type SchemaGroup = {
  fragments: PrebuiltTypeEntry[];
  operations: PrebuiltTypeEntry[];
  inputObjects: Set<string>;
};

/**
 * Group field selections by schema.
 * Uses the schema label to group selections.
 */
const groupBySchema = (
  fieldSelections: FieldSelectionsMap,
  schemas: Record<string, AnyGraphqlSchema>,
): Map<string, SchemaGroup> => {
  const grouped = new Map<string, SchemaGroup>();

  // Initialize groups for each schema
  for (const schemaName of Object.keys(schemas)) {
    grouped.set(schemaName, { fragments: [], operations: [], inputObjects: new Set() });
  }

  // For now, assume single schema named "default"
  // In the future, this could be extended to support multi-schema setups
  const defaultSchemaName = Object.keys(schemas)[0];
  if (!defaultSchemaName) {
    return grouped;
  }

  const schema = schemas[defaultSchemaName];
  if (!schema) {
    return grouped;
  }

  const group = grouped.get(defaultSchemaName);
  if (!group) {
    return grouped;
  }

  // Create formatters for schema-specific type names
  const outputFormatters: TypeFormatters = {
    scalarOutput: (name) => `ScalarOutput_${defaultSchemaName}<"${name}">`,
  };
  const inputFormatters: TypeFormatters = {
    scalarInput: (name) => `ScalarInput_${defaultSchemaName}<"${name}">`,
    inputObject: (name) => `Input_${defaultSchemaName}_${name}`,
  };

  for (const [_canonicalId, selection] of fieldSelections) {
    if (selection.type === "fragment") {
      // Skip fragments without keys (they can't be looked up)
      if (!selection.key) {
        continue;
      }

      try {
        // Collect input objects used in fragment variables
        const usedInputObjects = collectUsedInputObjectsFromSpecifiers(schema, selection.variableDefinitions);
        for (const inputName of usedInputObjects) {
          group.inputObjects.add(inputName);
        }

        // Generate output type with schema-specific scalar names
        const outputType = calculateFieldsType(schema, selection.fields, outputFormatters);

        // Generate input type from variableDefinitions with schema-specific names
        const hasVariables = Object.keys(selection.variableDefinitions).length > 0;
        const inputType = hasVariables
          ? generateInputTypeFromSpecifiers(schema, selection.variableDefinitions, { formatters: inputFormatters })
          : "void";

        group.fragments.push({
          key: selection.key,
          inputType,
          outputType,
        });
      } catch (error) {
        console.warn(
          `[prebuilt] Failed to calculate type for fragment "${selection.key}": ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    } else if (selection.type === "operation") {
      try {
        // Collect input objects used in this operation
        const usedInputObjects = collectUsedInputObjects(schema, selection.variableDefinitions);
        for (const inputName of usedInputObjects) {
          group.inputObjects.add(inputName);
        }

        // Generate output type with schema-specific scalar names
        const outputType = calculateFieldsType(schema, selection.fields, outputFormatters);

        // Generate input type with schema-specific scalar and input object names
        const inputType = generateInputType(schema, selection.variableDefinitions, inputFormatters);

        group.operations.push({
          key: selection.operationName,
          inputType,
          outputType,
        });
      } catch (error) {
        console.warn(
          `[prebuilt] Failed to calculate type for operation "${selection.operationName}": ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  return grouped;
};

/**
 * Calculate relative import path from one file to another.
 */
const toImportSpecifier = (from: string, to: string): string => {
  const fromDir = dirname(from);
  let relativePath = relative(fromDir, to);
  // Ensure starts with ./
  if (!relativePath.startsWith(".")) {
    relativePath = `./${relativePath}`;
  }
  // Remove .ts extension
  return relativePath.replace(/\.ts$/, "");
};

/**
 * Extract input object names from a GraphQL TypeNode.
 */
const extractInputObjectsFromType = (schema: AnyGraphqlSchema, typeNode: TypeNode, inputObjects: Set<string>): void => {
  switch (typeNode.kind) {
    case Kind.NON_NULL_TYPE:
      extractInputObjectsFromType(schema, typeNode.type, inputObjects);
      break;
    case Kind.LIST_TYPE:
      extractInputObjectsFromType(schema, typeNode.type, inputObjects);
      break;
    case Kind.NAMED_TYPE: {
      const name = typeNode.name.value;
      // Check if it's an input object (not a scalar or enum)
      if (!schema.scalar[name] && !schema.enum[name] && schema.input[name]) {
        inputObjects.add(name);
      }
      break;
    }
  }
};

/**
 * Collect all input object types used in variable definitions.
 * Recursively collects nested input objects from the schema.
 */
const collectUsedInputObjects = (
  schema: AnyGraphqlSchema,
  variableDefinitions: readonly VariableDefinitionNode[],
): Set<string> => {
  const inputObjects = new Set<string>();

  // First pass: collect direct references from variable definitions
  for (const varDef of variableDefinitions) {
    extractInputObjectsFromType(schema, varDef.type, inputObjects);
  }

  // Second pass: recursively collect nested input objects
  const collectNested = (inputName: string, seen: Set<string>): void => {
    if (seen.has(inputName)) {
      return;
    }
    seen.add(inputName);

    const inputDef = schema.input[inputName];
    if (!inputDef) {
      return;
    }

    for (const field of Object.values(inputDef.fields)) {
      if (field.kind === "input" && !inputObjects.has(field.name)) {
        inputObjects.add(field.name);
        collectNested(field.name, seen);
      }
    }
  };

  // Recursively collect from each initially found input
  const initialInputs = Array.from(inputObjects);
  for (const inputName of initialInputs) {
    collectNested(inputName, new Set());
  }

  return inputObjects;
};

/**
 * Collect all input object types used in InputTypeSpecifiers.
 * Recursively collects nested input objects from the schema.
 */
const collectUsedInputObjectsFromSpecifiers = (schema: AnyGraphqlSchema, specifiers: InputTypeSpecifiers): Set<string> => {
  const inputObjects = new Set<string>();

  // First pass: collect direct references from specifiers
  for (const specifier of Object.values(specifiers)) {
    if (specifier.kind === "input" && schema.input[specifier.name]) {
      inputObjects.add(specifier.name);
    }
  }

  // Second pass: recursively collect nested input objects
  const collectNested = (inputName: string, seen: Set<string>): void => {
    if (seen.has(inputName)) {
      return;
    }
    seen.add(inputName);

    const inputDef = schema.input[inputName];
    if (!inputDef) {
      return;
    }

    for (const field of Object.values(inputDef.fields)) {
      if (field.kind === "input" && !inputObjects.has(field.name)) {
        inputObjects.add(field.name);
        collectNested(field.name, seen);
      }
    }
  };

  // Recursively collect from each initially found input
  const initialInputs = Array.from(inputObjects);
  for (const inputName of initialInputs) {
    collectNested(inputName, new Set());
  }

  return inputObjects;
};

/**
 * Generate type definitions for input objects.
 */
const generateInputObjectTypeDefinitions = (schema: AnyGraphqlSchema, schemaName: string, inputNames: Set<string>): string[] => {
  const lines: string[] = [];

  // Get depth config from schema
  const defaultDepth = (schema as { __defaultInputDepth?: number }).__defaultInputDepth ?? 3;
  const depthOverrides = (schema as { __inputDepthOverrides?: Record<string, number> }).__inputDepthOverrides ?? {};

  // Create formatters for schema-specific type names
  const formatters: TypeFormatters = {
    scalarInput: (name) => `ScalarInput_${schemaName}<"${name}">`,
    inputObject: (name) => `Input_${schemaName}_${name}`,
  };

  // Sort for deterministic output
  const sortedNames = Array.from(inputNames).sort();

  for (const inputName of sortedNames) {
    const typeString = generateInputObjectType(schema, inputName, {
      defaultDepth,
      depthOverrides,
      formatters,
    });

    lines.push(`type Input_${schemaName}_${inputName} = ${typeString};`);
  }

  return lines;
};

/**
 * Generate the TypeScript code for prebuilt types.
 */
const generateTypesCode = (
  grouped: Map<string, SchemaGroup>,
  schemas: Record<string, AnyGraphqlSchema>,
  injects: Record<string, { readonly scalars: string }>,
  outdir: string,
): string => {
  const typesFilePath = join(outdir, "prebuilt", "types.ts");

  const lines: string[] = [
    "/**",
    " * Prebuilt type registry.",
    " *",
    " * This file is auto-generated by @soda-gql/builder.",
    " * Do not edit manually.",
    " *",
    " * @module",
    " * @generated",
    " */",
    "",
    'import type { PrebuiltTypeRegistry } from "@soda-gql/core";',
  ];

  // Generate imports from inject files
  for (const [schemaName, inject] of Object.entries(injects)) {
    const relativePath = toImportSpecifier(typesFilePath, inject.scalars);
    lines.push(`import type { scalar as scalar_${schemaName} } from "${relativePath}";`);
  }

  lines.push("");

  // Generate ScalarInput and ScalarOutput helper types
  for (const schemaName of Object.keys(injects)) {
    lines.push(
      `type ScalarInput_${schemaName}<T extends keyof typeof scalar_${schemaName}> = ` +
        `typeof scalar_${schemaName}[T]["$type"]["input"];`,
    );
    lines.push(
      `type ScalarOutput_${schemaName}<T extends keyof typeof scalar_${schemaName}> = ` +
        `typeof scalar_${schemaName}[T]["$type"]["output"];`,
    );
  }

  lines.push("");

  for (const [schemaName, { fragments, operations, inputObjects }] of grouped) {
    const schema = schemas[schemaName];

    // Generate input object type definitions if there are any
    if (inputObjects.size > 0 && schema) {
      lines.push("// Input object types");
      const inputTypeLines = generateInputObjectTypeDefinitions(schema, schemaName, inputObjects);
      lines.push(...inputTypeLines);
      lines.push("");
    }

    // Generate fragments type
    const fragmentEntries = fragments
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((f) => `    readonly "${f.key}": { readonly input: ${f.inputType}; readonly output: ${f.outputType} };`);

    // Generate operations type
    const operationEntries = operations
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((o) => `    readonly "${o.key}": { readonly input: ${o.inputType}; readonly output: ${o.outputType} };`);

    lines.push(`export type PrebuiltTypes_${schemaName} = {`);
    lines.push("  readonly fragments: {");
    if (fragmentEntries.length > 0) {
      lines.push(...fragmentEntries);
    }
    lines.push("  };");
    lines.push("  readonly operations: {");
    if (operationEntries.length > 0) {
      lines.push(...operationEntries);
    }
    lines.push("  };");
    lines.push("} satisfies PrebuiltTypeRegistry;");
    lines.push("");
  }

  return lines.join("\n");
};

/**
 * Emit prebuilt types to the prebuilt/types.ts file.
 *
 * @param options - Emitter options including schemas, field selections, and output directory
 * @returns Result indicating success or failure
 */
export const emitPrebuiltTypes = async (
  options: PrebuiltTypesEmitterOptions,
): Promise<Result<{ path: string }, BuilderError>> => {
  const { schemas, fieldSelections, outdir, injects } = options;

  // Group selections by schema
  const grouped = groupBySchema(fieldSelections, schemas);

  // Generate the types code
  const code = generateTypesCode(grouped, schemas, injects, outdir);

  // Write to prebuilt/types.ts
  const typesPath = join(outdir, "prebuilt", "types.ts");

  try {
    await writeFile(typesPath, code, "utf-8");
    return ok({ path: typesPath });
  } catch (error) {
    return err(
      builderErrors.writeFailed(
        typesPath,
        `Failed to write prebuilt types: ${error instanceof Error ? error.message : String(error)}`,
        error,
      ),
    );
  }
};

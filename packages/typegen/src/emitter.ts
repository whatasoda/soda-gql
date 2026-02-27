/**
 * Prebuilt types emitter.
 *
 * Generates TypeScript type definitions for PrebuiltTypes registry
 * from field selection data and schema.
 *
 * ## Error Handling Strategy
 *
 * The emitter uses a partial failure approach for type calculation errors:
 *
 * **Recoverable errors** (result in warnings, element skipped):
 * - Type calculation failures (e.g., `calculateFieldsType` throws)
 * - Input type generation failures (e.g., `generateInputType` throws)
 * - These are caught per-element, logged as warnings, and the element is omitted
 *
 * **Fatal errors** (result in error result):
 * - `SCHEMA_NOT_FOUND`: Selection references non-existent schema
 * - `WRITE_FAILED`: Cannot write output file to disk
 *
 * This allows builds to succeed with partial type coverage when some elements
 * have issues, while providing visibility into problems via warnings.
 *
 * @module
 */

import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { type BuilderError, builderErrors, type FieldSelectionsMap } from "@soda-gql/builder";
import type { AnyGraphqlSchema, InputTypeSpecifiers, TypeFormatters } from "@soda-gql/core";
import {
  calculateFieldsType,
  generateInputObjectType,
  generateInputType,
  generateInputTypeFromVarDefs,
  parseInputSpecifier,
} from "@soda-gql/core";
import { Kind, type TypeNode, type VariableDefinitionNode } from "graphql";
import { err, ok, type Result } from "neverthrow";
import type { TypegenError } from "./errors";

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
   * Output directory (where types.prebuilt.ts should be written).
   * This should be the same as config.outdir.
   */
  readonly outdir: string;
  /**
   * Relative import path to _internal-injects.ts from types.prebuilt.ts.
   * Example: "./_internal-injects"
   */
  readonly injectsModulePath: string;
};

type PrebuiltFragmentEntry = {
  readonly key: string;
  readonly typename: string;
  readonly inputType: string;
  readonly outputType: string;
};

type PrebuiltOperationEntry = {
  readonly key: string;
  readonly inputType: string;
  readonly outputType: string;
};

type SchemaGroup = {
  fragments: PrebuiltFragmentEntry[];
  operations: PrebuiltOperationEntry[];
  inputObjects: Set<string>;
};

type GroupBySchemaResult = {
  readonly grouped: Map<string, SchemaGroup>;
  readonly warnings: string[];
};

/**
 * Group field selections by schema.
 * Uses the schemaLabel from each selection to group them correctly.
 *
 * Fragments without a 'key' property are skipped (not included in PrebuiltTypes)
 * and a warning is added. This allows projects to use fragments without keys
 * while still generating prebuilt types for those that have keys.
 *
 * @returns Result containing grouped selections and warnings, or error if schema not found
 */
const groupBySchema = (
  fieldSelections: FieldSelectionsMap,
  schemas: Record<string, AnyGraphqlSchema>,
): Result<GroupBySchemaResult, BuilderError | TypegenError> => {
  const grouped = new Map<string, SchemaGroup>();
  const warnings: string[] = [];

  // Initialize groups for each schema
  for (const schemaName of Object.keys(schemas)) {
    grouped.set(schemaName, { fragments: [], operations: [], inputObjects: new Set() });
  }

  for (const [canonicalId, selection] of fieldSelections) {
    // Use schemaLabel to determine which schema this selection belongs to
    const schemaName = selection.schemaLabel;
    const schema = schemas[schemaName];
    const group = grouped.get(schemaName);

    if (!schema || !group) {
      return err(builderErrors.schemaNotFound(schemaName, canonicalId));
    }

    // Create formatters for schema-specific type names
    const outputFormatters: TypeFormatters = {
      scalarOutput: (name) => `ScalarOutput_${schemaName}<"${name}">`,
    };
    const inputFormatters: TypeFormatters = {
      scalarInput: (name) => `ScalarInput_${schemaName}<"${name}">`,
      inputObject: (name) => `Input_${schemaName}_${name}`,
    };

    if (selection.type === "fragment") {
      // Skip fragments without keys (they won't be included in PrebuiltTypes)
      if (!selection.key) {
        warnings.push(`[prebuilt] Fragment "${canonicalId}" skipped: missing 'key' property`);
        continue;
      }

      try {
        // Collect input objects used in fragment variables
        const usedInputObjects = collectUsedInputObjectsFromVarDefs(schema, selection.variableDefinitions);
        for (const inputName of usedInputObjects) {
          group.inputObjects.add(inputName);
        }

        // Generate output type with schema-specific scalar names
        const outputType = calculateFieldsType(schema, selection.fields, outputFormatters, selection.typename);

        // Generate input type from variableDefinitions with schema-specific names
        const hasVariables = Object.keys(selection.variableDefinitions).length > 0;
        const inputType = hasVariables
          ? generateInputTypeFromVarDefs(schema, selection.variableDefinitions, { formatters: inputFormatters })
          : "void";

        group.fragments.push({
          key: selection.key,
          typename: selection.typename,
          inputType,
          outputType,
        });
      } catch (error) {
        warnings.push(
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
        // Get the root type name from schema operations (Query, Mutation, Subscription)
        const rootTypeName = schema.operations[selection.operationType as keyof typeof schema.operations];
        const outputType = calculateFieldsType(schema, selection.fields, outputFormatters, rootTypeName ?? undefined);

        // Generate input type with schema-specific scalar and input object names
        const inputType = generateInputType(schema, selection.variableDefinitions, inputFormatters);

        group.operations.push({
          key: selection.operationName,
          inputType,
          outputType,
        });
      } catch (error) {
        warnings.push(
          `[prebuilt] Failed to calculate type for operation "${selection.operationName}": ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  return ok({ grouped, warnings });
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
 * Recursively collect nested input objects from schema definitions.
 * Takes a set of initial input names and expands to include all nested inputs.
 */
const collectNestedInputObjects = (schema: AnyGraphqlSchema, initialInputNames: Set<string>): Set<string> => {
  const inputObjects = new Set(initialInputNames);

  const collectNested = (inputName: string, seen: Set<string>): void => {
    if (seen.has(inputName)) {
      return;
    }
    seen.add(inputName);

    const inputDef = schema.input[inputName];
    if (!inputDef) {
      return;
    }

    for (const fieldSpec of Object.values(inputDef.fields)) {
      const parsed = parseInputSpecifier(fieldSpec);
      if (parsed.kind === "input" && !inputObjects.has(parsed.name)) {
        inputObjects.add(parsed.name);
        collectNested(parsed.name, seen);
      }
    }
  };

  for (const inputName of Array.from(initialInputNames)) {
    collectNested(inputName, new Set());
  }

  return inputObjects;
};

/**
 * Collect all input object types used in variable definitions.
 * Recursively collects nested input objects from the schema.
 */
const collectUsedInputObjects = (
  schema: AnyGraphqlSchema,
  variableDefinitions: readonly VariableDefinitionNode[],
): Set<string> => {
  const directInputs = new Set<string>();
  for (const varDef of variableDefinitions) {
    extractInputObjectsFromType(schema, varDef.type, directInputs);
  }
  return collectNestedInputObjects(schema, directInputs);
};

/**
 * Collect all input object types used in InputTypeSpecifiers.
 * Recursively collects nested input objects from the schema.
 */
const _collectUsedInputObjectsFromSpecifiers = (schema: AnyGraphqlSchema, specifiers: InputTypeSpecifiers): Set<string> => {
  const directInputs = new Set<string>();
  for (const specStr of Object.values(specifiers)) {
    const parsed = parseInputSpecifier(specStr);
    if (parsed.kind === "input" && schema.input[parsed.name]) {
      directInputs.add(parsed.name);
    }
  }
  return collectNestedInputObjects(schema, directInputs);
};

/**
 * Collect all input object types used in VariableDefinitions (VarSpecifier objects).
 * Used for fragment variable definitions.
 */
const collectUsedInputObjectsFromVarDefs = (
  schema: AnyGraphqlSchema,
  varDefs: Record<string, { kind: string; name: string }>,
): Set<string> => {
  const directInputs = new Set<string>();
  for (const varSpec of Object.values(varDefs)) {
    if (varSpec.kind === "input" && schema.input[varSpec.name]) {
      directInputs.add(varSpec.name);
    }
  }
  return collectNestedInputObjects(schema, directInputs);
};

/**
 * Generate type definitions for input objects.
 */
const generateInputObjectTypeDefinitions = (schema: AnyGraphqlSchema, schemaName: string, inputNames: Set<string>): string[] => {
  const lines: string[] = [];

  // Get depth config from schema (optional properties defined in AnyGraphqlSchema)
  const defaultDepth = schema.__defaultInputDepth ?? 3;
  const depthOverrides = schema.__inputDepthOverrides ?? {};

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

    lines.push(`export type Input_${schemaName}_${inputName} = ${typeString};`);
  }

  return lines;
};

/**
 * Generate the TypeScript code for prebuilt types.
 */
const generateTypesCode = (
  grouped: Map<string, SchemaGroup>,
  schemas: Record<string, AnyGraphqlSchema>,
  injectsModulePath: string,
): string => {
  const schemaNames = Object.keys(schemas);

  const lines: string[] = [
    "/**",
    " * Prebuilt type registry.",
    " *",
    " * This file is auto-generated by @soda-gql/typegen.",
    " * Do not edit manually.",
    " *",
    " * @module",
    " * @generated",
    " */",
    "",
    'import type { PrebuiltTypeRegistry } from "@soda-gql/core";',
  ];

  // Generate import from _internal-injects.ts
  const scalarImports = schemaNames.map((name) => `scalar_${name}`).join(", ");
  lines.push(`import type { ${scalarImports} } from "${injectsModulePath}";`);

  lines.push("");

  // Generate ScalarInput and ScalarOutput helper types
  for (const schemaName of schemaNames) {
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

    // Generate fragments type (deduplicate by key — last occurrence wins)
    const deduplicatedFragments = new Map<string, PrebuiltFragmentEntry>();
    for (const f of fragments) {
      deduplicatedFragments.set(f.key, f);
    }
    const fragmentEntries = Array.from(deduplicatedFragments.values())
      .sort((a, b) => a.key.localeCompare(b.key))
      .map(
        (f) =>
          `    readonly "${f.key}": { readonly typename: "${f.typename}"; readonly input: ${f.inputType}; readonly output: ${f.outputType} };`,
      );

    // Generate operations type (deduplicate by key — last occurrence wins)
    const deduplicatedOperations = new Map<string, PrebuiltOperationEntry>();
    for (const o of operations) {
      deduplicatedOperations.set(o.key, o);
    }
    const operationEntries = Array.from(deduplicatedOperations.values())
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
    lines.push("};");
    lines.push("");
  }

  return lines.join("\n");
};

/**
 * Result of emitting prebuilt types.
 */
export type PrebuiltTypesEmitResult = {
  readonly path: string;
  readonly warnings: readonly string[];
};

/**
 * Emit prebuilt types to the types.prebuilt.ts file.
 *
 * This function uses a partial failure strategy: if type calculation fails for
 * individual elements (e.g., due to invalid field selections or missing schema
 * types), those elements are skipped and warnings are collected rather than
 * failing the entire emission. This allows builds to succeed even when some
 * elements have issues, while still reporting problems via warnings.
 *
 * @param options - Emitter options including schemas, field selections, and output directory
 * @returns Result containing output path and warnings, or error if a hard failure occurs
 *
 * @example
 * ```typescript
 * const result = await emitPrebuiltTypes({
 *   schemas: { mySchema: schema },
 *   fieldSelections,
 *   outdir: "./generated",
 *   injects: { mySchema: { scalars: "./scalars.ts" } },
 * });
 *
 * if (result.isOk()) {
 *   console.log(`Generated: ${result.value.path}`);
 *   if (result.value.warnings.length > 0) {
 *     console.warn("Warnings:", result.value.warnings);
 *   }
 * }
 * ```
 */
export const emitPrebuiltTypes = async (
  options: PrebuiltTypesEmitterOptions,
): Promise<Result<PrebuiltTypesEmitResult, BuilderError | TypegenError>> => {
  const { schemas, fieldSelections, outdir, injectsModulePath } = options;

  // Group selections by schema
  const groupResult = groupBySchema(fieldSelections, schemas);
  if (groupResult.isErr()) {
    return err(groupResult.error);
  }
  const { grouped, warnings } = groupResult.value;

  // Generate the types code
  const code = generateTypesCode(grouped, schemas, injectsModulePath);

  // Write to types.prebuilt.ts
  const typesPath = join(outdir, "types.prebuilt.ts");

  try {
    await writeFile(typesPath, code, "utf-8");
    return ok({ path: typesPath, warnings });
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

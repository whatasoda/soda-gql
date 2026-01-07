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
import type { AnyGraphqlSchema } from "@soda-gql/core";
import { calculateFieldsType, generateInputType } from "@soda-gql/core";
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

/**
 * Group field selections by schema.
 * Uses the schema label to group selections.
 */
const groupBySchema = (
  fieldSelections: FieldSelectionsMap,
  schemas: Record<string, AnyGraphqlSchema>,
): Map<string, { fragments: PrebuiltTypeEntry[]; operations: PrebuiltTypeEntry[] }> => {
  const grouped = new Map<string, { fragments: PrebuiltTypeEntry[]; operations: PrebuiltTypeEntry[] }>();

  // Initialize groups for each schema
  for (const schemaName of Object.keys(schemas)) {
    grouped.set(schemaName, { fragments: [], operations: [] });
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

  for (const [_canonicalId, selection] of fieldSelections) {
    if (selection.type === "fragment") {
      // Skip fragments without keys (they can't be looked up)
      if (!selection.key) {
        continue;
      }

      try {
        const outputType = calculateFieldsType(schema, selection.fields);
        // Replace generic ScalarOutput with schema-specific version
        const finalOutputType = outputType.replace(/ScalarOutput<"([^"]+)">/g, `ScalarOutput_${defaultSchemaName}<"$1">`);
        group.fragments.push({
          key: selection.key,
          inputType: "void", // Fragments input is variables, simplified to void for now
          outputType: finalOutputType,
        });
      } catch (error) {
        console.warn(
          `[prebuilt] Failed to calculate type for fragment "${selection.key}": ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    } else if (selection.type === "operation") {
      try {
        const outputType = calculateFieldsType(schema, selection.fields);
        const inputType = generateInputType(schema, selection.variableDefinitions);
        // Replace generic ScalarOutput with schema-specific version
        const finalOutputType = outputType.replace(/ScalarOutput<"([^"]+)">/g, `ScalarOutput_${defaultSchemaName}<"$1">`);
        const finalInputType = inputType.replace(/ScalarOutput<"([^"]+)">/g, `ScalarOutput_${defaultSchemaName}<"$1">`);
        group.operations.push({
          key: selection.operationName,
          inputType: finalInputType,
          outputType: finalOutputType,
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
 * Generate the TypeScript code for prebuilt types.
 */
const generateTypesCode = (
  grouped: Map<string, { fragments: PrebuiltTypeEntry[]; operations: PrebuiltTypeEntry[] }>,
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

  // Generate ScalarOutput helper types
  for (const schemaName of Object.keys(injects)) {
    lines.push(
      `type ScalarOutput_${schemaName}<T extends keyof typeof scalar_${schemaName}> = ` +
        `typeof scalar_${schemaName}[T]["$type"]["output"];`,
    );
  }

  lines.push("");

  for (const [schemaName, { fragments, operations }] of grouped) {
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
  const code = generateTypesCode(grouped, injects, outdir);

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

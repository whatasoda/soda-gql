/**
 * Converts extracted tagged template GraphQL content into FieldSelectionData.
 *
 * Takes the output of template-extractor and produces FieldSelectionData entries
 * compatible with the emitter pipeline. Uses the shared field-building utilities
 * from core to produce AnyFieldsExtended from GraphQL AST.
 *
 * @module
 */

import type { FieldSelectionData, FieldSelectionsMap } from "@soda-gql/builder";
import type { CanonicalId } from "@soda-gql/common";
import {
  type AnyGraphqlSchema,
  buildFieldsFromSelectionSet,
  createSchemaIndexFromSchema,
  extractFragmentVariables,
  preprocessFragmentArgs,
} from "@soda-gql/core";
import { Kind, parse as parseGraphql } from "graphql";
import type { ExtractedTemplate } from "./template-extractor";

/** Result of converting templates to field selections. */
export type TemplateConversionResult = {
  readonly selections: FieldSelectionsMap;
  readonly warnings: readonly string[];
};

/**
 * Convert extracted templates into field selections for the emitter.
 *
 * @param templates - Templates extracted from source files, keyed by file path
 * @param schemas - Loaded schema objects keyed by schema name
 * @returns Map of canonical IDs to field selection data, plus any warnings
 */
export const convertTemplatesToSelections = (
  templates: ReadonlyMap<string, readonly ExtractedTemplate[]>,
  schemas: Record<string, AnyGraphqlSchema>,
): TemplateConversionResult => {
  const selections = new Map<CanonicalId, FieldSelectionData>();
  const warnings: string[] = [];

  // Build schema indexes once per schema
  const schemaIndexes = new Map(Object.entries(schemas).map(([name, schema]) => [name, createSchemaIndexFromSchema(schema)]));

  for (const [filePath, fileTemplates] of templates) {
    for (const template of fileTemplates) {
      const schema = schemas[template.schemaName];
      if (!schema) {
        warnings.push(`[typegen-template] Unknown schema "${template.schemaName}" in ${filePath}`);
        continue;
      }

      const schemaIndex = schemaIndexes.get(template.schemaName);
      if (!schemaIndex) {
        continue;
      }

      try {
        if (template.kind === "fragment") {
          const selection = convertFragmentTemplate(template, schema, filePath);
          if (selection) {
            selections.set(selection.id, selection.data);
          }
        } else {
          const selection = convertOperationTemplate(template, schema, filePath);
          if (selection) {
            selections.set(selection.id, selection.data);
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        warnings.push(`[typegen-template] Failed to process ${template.kind} in ${filePath}: ${message}`);
      }
    }
  }

  return { selections, warnings };
};

/**
 * Reconstruct full GraphQL source from an extracted template.
 * For curried syntax (new), prepends the definition header from tag call arguments.
 * For old syntax, returns content as-is.
 */
const reconstructGraphql = (template: ExtractedTemplate): string => {
  if (template.elementName) {
    if (template.kind === "fragment" && template.typeName) {
      return `fragment ${template.elementName} on ${template.typeName} ${template.content}`;
    }
    return `${template.kind} ${template.elementName} ${template.content}`;
  }
  return template.content;
};

/**
 * Convert a fragment template into FieldSelectionData.
 */
const convertFragmentTemplate = (
  template: ExtractedTemplate,
  schema: AnyGraphqlSchema,
  filePath: string,
): { id: CanonicalId; data: FieldSelectionData } | null => {
  const schemaIndex = createSchemaIndexFromSchema(schema);
  const graphqlSource = reconstructGraphql(template);

  // Extract variable definitions from Fragment Arguments syntax
  const variableDefinitions = extractFragmentVariables(graphqlSource, schemaIndex);

  // Preprocess to strip Fragment Arguments
  const { preprocessed } = preprocessFragmentArgs(graphqlSource);

  const document = parseGraphql(preprocessed);
  const fragDef = document.definitions.find((d) => d.kind === Kind.FRAGMENT_DEFINITION);
  if (!fragDef || fragDef.kind !== Kind.FRAGMENT_DEFINITION) {
    return null;
  }

  const fragmentName = fragDef.name.value;
  const onType = fragDef.typeCondition.name.value;

  // Build fields from selection set
  const fields = buildFieldsFromSelectionSet(fragDef.selectionSet, schema, onType);

  // Generate a canonical ID from file path + fragment name
  const id = `${filePath}::${fragmentName}` as CanonicalId;

  return {
    id,
    data: {
      type: "fragment",
      schemaLabel: schema.label,
      key: fragmentName,
      typename: onType,
      fields,
      variableDefinitions,
    },
  };
};

/**
 * Convert an operation template into FieldSelectionData.
 */
const convertOperationTemplate = (
  template: ExtractedTemplate,
  schema: AnyGraphqlSchema,
  filePath: string,
): { id: CanonicalId; data: FieldSelectionData } | null => {
  const graphqlSource = reconstructGraphql(template);
  const document = parseGraphql(graphqlSource);
  const opDef = document.definitions.find((d) => d.kind === Kind.OPERATION_DEFINITION);
  if (!opDef || opDef.kind !== Kind.OPERATION_DEFINITION) {
    return null;
  }

  const operationName = opDef.name?.value ?? "Anonymous";
  const operationType = opDef.operation;

  // Determine root type name based on operation type
  const rootTypeName = getRootTypeName(schema, operationType);

  // Build fields from selection set
  const fields = buildFieldsFromSelectionSet(opDef.selectionSet, schema, rootTypeName);

  // Variable definitions from the operation AST
  const variableDefinitions = opDef.variableDefinitions ?? [];

  // Generate a canonical ID from file path + operation name
  const id = `${filePath}::${operationName}` as CanonicalId;

  return {
    id,
    data: {
      type: "operation",
      schemaLabel: schema.label,
      operationName,
      operationType,
      fields,
      variableDefinitions: [...variableDefinitions],
    },
  };
};

/**
 * Get the root type name for an operation type from the schema.
 */
const getRootTypeName = (schema: AnyGraphqlSchema, operationType: string): string => {
  switch (operationType) {
    case "query":
      return schema.operations.query ?? "Query";
    case "mutation":
      return schema.operations.mutation ?? "Mutation";
    case "subscription":
      return schema.operations.subscription ?? "Subscription";
    default:
      return "Query";
  }
};

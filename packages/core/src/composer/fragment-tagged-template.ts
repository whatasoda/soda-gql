/**
 * Fragment tagged template function for creating GraphQL fragments from template literals.
 * Supports Fragment Arguments RFC syntax for parameterized fragments.
 * @module
 */

import { Kind, parse as parseGraphql, type SelectionSetNode } from "graphql";
import { buildVarSpecifiers, createSchemaIndexFromSchema, preprocessFragmentArgs } from "../graphql";
import type { SchemaIndex } from "../graphql/schema-index";
import { Fragment } from "../types/element";
import type { AnyFragment } from "../types/element/fragment";
import type { AnyFieldsExtended } from "../types/fragment";
import type { AnyGraphqlSchema } from "../types/schema";
import type { VariableDefinitions } from "../types/type-foundation";
import { createFieldFactories } from "./fields-builder";
import { recordFragmentUsage } from "./fragment-usage-context";
import { createVarAssignments } from "./input";
import type { TemplateResult, TemplateResultMetadataOptions } from "./operation-tagged-template";

/** Tagged template function type for fragments. */
export type FragmentTaggedTemplateFunction = (strings: TemplateStringsArray, ...values: never[]) => TemplateResult<AnyFragment>;

/**
 * Extract the argument list text from a fragment definition with Fragment Arguments syntax.
 * Returns the text between parens in `fragment Name(...) on Type`, or null if no args.
 */
function extractFragmentArgText(rawSource: string): string | null {
  const match = /\bfragment\s+\w+\s*\(/.exec(rawSource);
  if (!match) return null;

  const openIndex = match.index + match[0].length - 1;
  let depth = 1;
  for (let i = openIndex + 1; i < rawSource.length; i++) {
    if (rawSource[i] === "(") depth++;
    else if (rawSource[i] === ")") {
      depth--;
      if (depth === 0) {
        const afterParen = rawSource.slice(i + 1).trimStart();
        if (afterParen.startsWith("on")) {
          return rawSource.slice(openIndex + 1, i);
        }
        return null;
      }
    }
  }
  return null;
}

/**
 * Extract variable definitions from Fragment Arguments syntax.
 * Wraps the argument list in a synthetic query to parse with graphql-js.
 */
export function extractFragmentVariables(rawSource: string, schemaIndex: SchemaIndex): VariableDefinitions {
  const argText = extractFragmentArgText(rawSource);
  if (!argText?.trim()) return {};

  const syntheticQuery = `query _Synthetic(${argText}) { __typename }`;

  let syntheticDoc;
  try {
    syntheticDoc = parseGraphql(syntheticQuery);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse fragment argument definitions: ${message}`);
  }

  const opDef = syntheticDoc.definitions[0];
  if (!opDef || opDef.kind !== Kind.OPERATION_DEFINITION) {
    return {};
  }

  const varDefNodes = opDef.variableDefinitions ?? [];
  // BuiltVarSpecifier is structurally compatible at runtime; cast needed because
  // BuiltVarSpecifier.defaultValue uses `unknown` while VarSpecifier uses `ConstValue`
  return buildVarSpecifiers(varDefNodes, schemaIndex) as VariableDefinitions;
}

/**
 * Builds field selections from a GraphQL AST SelectionSet by driving field factories.
 * Converts parsed AST selections into the AnyFieldsExtended format that the document builder expects.
 * Also used by typegen for static field extraction from tagged templates.
 */
export function buildFieldsFromSelectionSet(
  selectionSet: SelectionSetNode,
  schema: AnyGraphqlSchema,
  typeName: string,
): AnyFieldsExtended {
  const f = createFieldFactories(schema, typeName);
  const result: Record<string, unknown> = {};

  for (const selection of selectionSet.selections) {
    if (selection.kind === Kind.FIELD) {
      const fieldName = selection.name.value;
      const alias = selection.alias?.value ?? fieldName;
      // __typename is an implicit introspection field on all object types
      if (fieldName === "__typename") {
        result[alias] = true;
        continue;
      }

      const factory = (f as Record<string, ((...args: unknown[]) => unknown) | undefined>)[fieldName];

      if (!factory) {
        throw new Error(`Field "${fieldName}" is not defined on type "${typeName}"`);
      }

      // Build args from AST arguments
      const args = buildArgsFromASTArguments(selection.arguments ?? []);
      const extras = alias !== fieldName ? { alias } : undefined;

      if (selection.selectionSet) {
        // Object field — factory returns a curried function
        const curried = factory(args, extras);
        if (typeof curried === "function") {
          // Drive nested builder with recursive field building
          const nestedFields = buildFieldsFromSelectionSet(
            selection.selectionSet,
            schema,
            resolveFieldTypeName(schema, typeName, fieldName),
          );
          const fieldResult = (curried as (nest: unknown) => Record<string, unknown>)(
            ({ f: nestedFactories }: { f: unknown }) => {
              // Ignore the provided factories; use pre-built fields
              void nestedFactories;
              return nestedFields;
            },
          );
          Object.assign(result, fieldResult);
        } else {
          Object.assign(result, curried);
        }
      } else {
        // Scalar/enum field — factory returns the field selection directly
        const fieldResult = factory(args, extras);
        if (typeof fieldResult === "function") {
          // Object field used without selection set — just call with empty builder
          const emptyResult = (fieldResult as (nest: unknown) => Record<string, unknown>)(() => ({}));
          Object.assign(result, emptyResult);
        } else {
          Object.assign(result, fieldResult);
        }
      }
    }
    // InlineFragment and FragmentSpread nodes are not supported in tagged template fragments
  }

  return result as AnyFieldsExtended;
}

/**
 * Build a simple args object from GraphQL AST argument nodes.
 * Extracts literal values from the AST for passing to field factories.
 */
function buildArgsFromASTArguments(
  args: readonly {
    readonly name: { readonly value: string };
    readonly value: { readonly kind: string; readonly value?: unknown };
  }[],
): Record<string, unknown> {
  if (args.length === 0) return {};
  const result: Record<string, unknown> = {};
  for (const arg of args) {
    result[arg.name.value] = extractASTValue(arg.value);
  }
  return result;
}

/**
 * Extract a runtime value from a GraphQL AST ValueNode.
 */
function extractASTValue(node: {
  readonly kind: string;
  readonly value?: unknown;
  readonly values?: readonly unknown[];
  readonly fields?: readonly { readonly name: { readonly value: string }; readonly value: unknown }[];
}): unknown {
  switch (node.kind) {
    case Kind.STRING:
    case Kind.INT:
    case Kind.FLOAT:
    case Kind.BOOLEAN:
    case Kind.ENUM:
      return node.value;
    case Kind.NULL:
      return null;
    case Kind.LIST:
      return (node.values as readonly { kind: string; value?: unknown }[])?.map(extractASTValue) ?? [];
    case Kind.OBJECT:
      return Object.fromEntries(
        (node.fields ?? []).map((f) => [f.name.value, extractASTValue(f.value as { kind: string; value?: unknown })]),
      );
    case Kind.VARIABLE:
      // Variable references in fragments are handled by the variable system
      return `$${(node as unknown as { name: { value: string } }).name.value}`;
    default:
      return undefined;
  }
}

/**
 * Resolve the output type name for a field on a given type.
 * Looks up the field's type specifier in the schema and extracts the type name.
 * Handles both string specifiers ("o|Avatar|?") and object specifiers ({ spec: "o|Avatar|?" }).
 */
function resolveFieldTypeName(schema: AnyGraphqlSchema, typeName: string, fieldName: string): string {
  const typeDef = schema.object[typeName];
  if (!typeDef) {
    throw new Error(`Type "${typeName}" is not defined in schema objects`);
  }
  const fieldDef = typeDef.fields[fieldName] as string | { spec: string } | undefined;
  if (!fieldDef) {
    throw new Error(`Field "${fieldName}" is not defined on type "${typeName}"`);
  }
  const specStr = typeof fieldDef === "string" ? fieldDef : fieldDef.spec;
  const parts = specStr.split("|");
  return parts[1] ?? typeName;
}

/**
 * Creates a tagged template function for fragments.
 *
 * @param schema - The GraphQL schema definition
 */
export function createFragmentTaggedTemplate<TSchema extends AnyGraphqlSchema>(schema: TSchema): FragmentTaggedTemplateFunction {
  const schemaIndex = createSchemaIndexFromSchema(schema);

  return (strings: TemplateStringsArray, ...values: never[]): TemplateResult<AnyFragment> => {
    if (values.length > 0) {
      throw new Error("Tagged templates must not contain interpolated expressions");
    }

    const rawSource = strings[0]!;

    // Extract variables from Fragment Arguments syntax before preprocessing
    const varSpecifiers = extractFragmentVariables(rawSource, schemaIndex);

    // Preprocess to strip Fragment Arguments syntax
    const { preprocessed } = preprocessFragmentArgs(rawSource);

    // Parse the preprocessed GraphQL
    let document;
    try {
      document = parseGraphql(preprocessed);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`GraphQL parse error in tagged template: ${message}`);
    }

    // Validate exactly one fragment definition
    const fragmentDefs = document.definitions.filter((def) => def.kind === Kind.FRAGMENT_DEFINITION);
    if (fragmentDefs.length === 0) {
      throw new Error("Expected a fragment definition, found none");
    }
    if (fragmentDefs.length > 1) {
      throw new Error(`Expected exactly one fragment definition, found ${fragmentDefs.length}`);
    }

    const fragNode = fragmentDefs[0]!;
    if (fragNode.kind !== Kind.FRAGMENT_DEFINITION) {
      throw new Error("Unexpected definition kind");
    }

    const fragmentName = fragNode.name.value;
    const onType = fragNode.typeCondition.name.value;

    // Validate onType exists in schema
    if (!(onType in schema.object)) {
      throw new Error(`Type "${onType}" is not defined in schema objects`);
    }

    return (options?: TemplateResultMetadataOptions): AnyFragment => {
      // biome-ignore lint/suspicious/noExplicitAny: Tagged template fragments bypass full type inference
      return Fragment.create(() => ({
        typename: onType,
        key: fragmentName,
        schemaLabel: schema.label,
        variableDefinitions: varSpecifiers,
        spread: (variables) => {
          const $ = createVarAssignments(varSpecifiers, variables);
          void $; // Variable assignments reserved for future Fragment Arguments support

          recordFragmentUsage({
            metadataBuilder: options?.metadata ? () => options.metadata : null,
            path: null,
          });

          return buildFieldsFromSelectionSet(fragNode.selectionSet, schema, onType);
        },
      })) as any;
    };
  };
}

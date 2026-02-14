/**
 * Fragment tagged template function for creating GraphQL fragments from template literals.
 * Supports Fragment Arguments RFC syntax for parameterized fragments.
 * @module
 */

import { parse as parseGraphql, Kind } from "graphql";
import { Fragment } from "../types/element";
import type { AnyGraphqlSchema } from "../types/schema";
import type { VariableDefinitions } from "../types/type-foundation";
import type { AnyFragment } from "../types/element/fragment";
import { buildVarSpecifiers, createSchemaIndexFromSchema, preprocessFragmentArgs } from "../graphql";
import type { SchemaIndex } from "../graphql/schema-index";
import type { TemplateResult, TemplateResultMetadataOptions } from "./operation-tagged-template";

/** Tagged template function type for fragments. */
export type FragmentTaggedTemplateFunction = (
  strings: TemplateStringsArray,
  ...values: never[]
) => TemplateResult<AnyFragment>;

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
function extractFragmentVariables(
  rawSource: string,
  schemaIndex: SchemaIndex,
): VariableDefinitions {
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
 * Creates a tagged template function for fragments.
 *
 * @param schema - The GraphQL schema definition
 */
export function createFragmentTaggedTemplate<TSchema extends AnyGraphqlSchema>(
  schema: TSchema,
): FragmentTaggedTemplateFunction {
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

    return (_options?: TemplateResultMetadataOptions): AnyFragment => {
      // biome-ignore lint/suspicious/noExplicitAny: Tagged template fragments bypass full type inference
      return Fragment.create(() => ({
        typename: onType,
        key: fragmentName,
        schemaLabel: schema.label,
        variableDefinitions: varSpecifiers,
        spread: () => ({}) as never,
      })) as any;
    };
  };
}

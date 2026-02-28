/**
 * Fragment tagged template function for creating GraphQL fragments from template literals.
 * Supports Fragment Arguments RFC syntax for parameterized fragments.
 * @module
 */

import { Kind, parse as parseGraphql, type SelectionSetNode } from "graphql";
import { buildVarSpecifiers, createSchemaIndexFromSchema, preprocessFragmentArgs } from "../graphql";
import { findMatchingParen } from "../graphql/fragment-args-preprocessor";
import type { SchemaIndex } from "../graphql/schema-index";
import { Fragment } from "../types/element";
import type { AnyFragment } from "../types/element/fragment";
import type { AnyFieldsExtended } from "../types/fragment";
import type { AnyGraphqlSchema } from "../types/schema";
import type { AnyVarRef, VariableDefinitions } from "../types/type-foundation";
import { createVarRefFromVariable } from "../types/type-foundation/var-ref";
import { parseOutputField } from "../utils/deferred-specifier-parser";
import { createFieldFactories } from "./fields-builder";
import { recordFragmentUsage } from "./fragment-usage-context";
import { createVarAssignments } from "./input";
import { mergeVariableDefinitions } from "./merge-variable-definitions";
import type { FragmentTemplateMetadataOptions, TemplateResult } from "./operation-tagged-template";

/** Tagged template function type for fragments. */
export type FragmentTaggedTemplateFunction = (
  strings: TemplateStringsArray,
  ...values: (AnyFragment | ((ctx: { $: Readonly<Record<string, AnyVarRef>> }) => AnyFieldsExtended))[]
) => TemplateResult<AnyFragment>;

/**
 * Extract the argument list text from a fragment definition with Fragment Arguments syntax.
 * Returns the text between parens in `fragment Name(...) on Type`, or null if no args.
 */
function extractFragmentArgText(rawSource: string): string | null {
  const match = /\bfragment\s+\w+\s*\(/.exec(rawSource);
  if (!match) return null;

  const openIndex = match.index + match[0].length - 1;
  const closeIndex = findMatchingParen(rawSource, openIndex);
  if (closeIndex === -1) return null;

  const afterParen = rawSource.slice(closeIndex + 1).trimStart();
  if (afterParen.startsWith("on")) {
    return rawSource.slice(openIndex + 1, closeIndex);
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

  let syntheticDoc: import("graphql").DocumentNode;
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
  varAssignments?: Readonly<Record<string, AnyVarRef>>,
  interpolationMap?: ReadonlyMap<string, AnyFragment | ((ctx: { $: Readonly<Record<string, AnyVarRef>> }) => AnyFieldsExtended)>,
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
      const args = buildArgsFromASTArguments(selection.arguments ?? [], varAssignments);
      const extras = alias !== fieldName ? { alias } : undefined;

      if (selection.selectionSet) {
        // Object/union field — factory returns a curried function
        const curried = factory(args, extras);
        if (typeof curried === "function") {
          // Detect union type via field specifier
          const typeDef = schema.object[typeName];
          const fieldSpec = typeDef?.fields[fieldName] as import("../types/type-foundation").DeferredOutputField;
          const parsedType = parseOutputField(fieldSpec);

          if (parsedType.kind === "union") {
            // Union field: collect InlineFragmentNodes, build NestedUnionFieldsBuilder input
            const unionInput: Record<string, unknown> = {};
            let hasTypename = false;
            const unsupportedSelections: string[] = [];

            for (const sel of selection.selectionSet.selections) {
              if (sel.kind === Kind.INLINE_FRAGMENT) {
                if (sel.directives?.length) {
                  throw new Error("Directives on inline fragments are not supported in tagged templates");
                }
                if (!sel.typeCondition) {
                  throw new Error("Inline fragments without type conditions are not supported in tagged templates");
                }
                const memberName = sel.typeCondition.name.value;
                // Validate member is part of the union
                const unionDef = schema.union[parsedType.name];
                if (!unionDef?.types[memberName]) {
                  throw new Error(
                    `Type "${memberName}" is not a member of union "${parsedType.name}" in tagged template inline fragment`,
                  );
                }
                if (memberName in unionInput) {
                  throw new Error(
                    `Duplicate inline fragment for union member "${memberName}" in tagged template. ` +
                      `Merge selections into a single "... on ${memberName} { ... }" block.`,
                  );
                }
                const memberFields = buildFieldsFromSelectionSet(
                  sel.selectionSet,
                  schema,
                  memberName,
                  varAssignments,
                  interpolationMap,
                );
                unionInput[memberName] = ({ f: _f }: { f: unknown }) => memberFields;
              } else if (sel.kind === Kind.FIELD && sel.name.value === "__typename") {
                if (sel.alias) {
                  throw new Error(
                    `Aliases on __typename in union selections are not supported in tagged templates. ` +
                      `Use "__typename" without an alias.`,
                  );
                }
                if (sel.directives?.length) {
                  throw new Error(
                    `Directives on __typename in union selections are not supported in tagged templates.`,
                  );
                }
                hasTypename = true;
              } else {
                // Track unsupported selections for deferred error reporting
                const desc = sel.kind === Kind.FIELD ? `Field "${sel.name.value}"` : "Fragment spread";
                unsupportedSelections.push(desc);
              }
            }

            // Post-loop validation
            const hasInlineFragments = Object.keys(unionInput).length > 0;

            if (unsupportedSelections.length > 0) {
              if (hasInlineFragments) {
                // Unsupported selections alongside real inline fragments
                throw new Error(
                  `${unsupportedSelections[0]} alongside inline fragments in union selection is not supported in tagged templates. Use per-member inline fragments instead.`,
                );
              }
              // No inline fragments at all — require them
              throw new Error(
                `Union field "${fieldName}" requires at least __typename or inline fragment syntax (... on Type { fields }) in tagged templates`,
              );
            }

            // Must have at least __typename or an inline fragment
            if (!hasInlineFragments && !hasTypename) {
              throw new Error(
                `Union field "${fieldName}" requires at least __typename or inline fragment syntax (... on Type { fields }) in tagged templates`,
              );
            }

            if (hasTypename) {
              (unionInput as Record<string, unknown>).__typename = true;
            }

            const fieldResult = (curried as (nest: unknown) => Record<string, unknown>)(unionInput);
            Object.assign(result, fieldResult);
          } else {
            // Object field: existing path
            const nestedFields = buildFieldsFromSelectionSet(
              selection.selectionSet,
              schema,
              resolveFieldTypeName(schema, typeName, fieldName),
              varAssignments,
              interpolationMap,
            );
            const fieldResult = (curried as (nest: unknown) => Record<string, unknown>)(
              ({ f: nestedFactories }: { f: unknown }) => {
                // Ignore the provided factories; use pre-built fields
                void nestedFactories;
                return nestedFields;
              },
            );
            Object.assign(result, fieldResult);
          }
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
    } else if (selection.kind === Kind.FRAGMENT_SPREAD) {
      // Handle fragment spread: ...FragmentName
      const fragmentName = selection.name.value;

      // Check interpolation map for interpolated fragments
      if (interpolationMap?.has(fragmentName)) {
        const interpolatedValue = interpolationMap.get(fragmentName);
        if (!interpolatedValue) {
          throw new Error(`Interpolation placeholder "${fragmentName}" has no value`);
        }

        let spreadFields: AnyFieldsExtended;
        if (interpolatedValue instanceof Fragment) {
          // Direct fragment interpolation: ...${frag}
          spreadFields = interpolatedValue.spread(varAssignments as never);
        } else {
          // Callback interpolation: ...${($) => frag.spread(args)}
          if (!varAssignments) {
            throw new Error(`Callback interpolation requires variable context`);
          }
          spreadFields = interpolatedValue({ $: varAssignments });
        }
        Object.assign(result, spreadFields);
      } else {
        // Fragment spread without interpolation - must use interpolation syntax
        throw new Error(
          `Fragment spread "...${fragmentName}" in tagged template must use interpolation syntax. ` +
            `Use \`...@\${fragment}\` instead of \`...FragmentName\`.`,
        );
      }
    } else if (selection.kind === Kind.INLINE_FRAGMENT) {
      throw new Error(
        "Inline fragments (... on Type) at the top level are not supported in tagged templates. " +
          "Use inline fragments only inside union field selections.",
      );
    }
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
  varAssignments?: Readonly<Record<string, AnyVarRef>>,
): Record<string, unknown> {
  if (args.length === 0) return {};
  const result: Record<string, unknown> = {};
  for (const arg of args) {
    result[arg.name.value] = extractASTValue(arg.value, varAssignments);
  }
  return result;
}

/**
 * Extract a runtime value from a GraphQL AST ValueNode.
 */
function extractASTValue(
  node: {
    readonly kind: string;
    readonly value?: unknown;
    readonly values?: readonly unknown[];
    readonly fields?: readonly { readonly name: { readonly value: string }; readonly value: unknown }[];
  },
  varAssignments?: Readonly<Record<string, AnyVarRef>>,
): unknown {
  switch (node.kind) {
    case Kind.INT:
      return Number.parseInt(node.value as string, 10);
    case Kind.FLOAT:
      return Number.parseFloat(node.value as string);
    case Kind.STRING:
    case Kind.BOOLEAN:
    case Kind.ENUM:
      return node.value;
    case Kind.NULL:
      return null;
    case Kind.LIST:
      return (node.values as readonly { kind: string; value?: unknown }[])?.map((v) => extractASTValue(v, varAssignments)) ?? [];
    case Kind.OBJECT:
      return Object.fromEntries(
        (node.fields ?? []).map((f) => [
          f.name.value,
          extractASTValue(f.value as { kind: string; value?: unknown }, varAssignments),
        ]),
      );
    case Kind.VARIABLE: {
      const varName = (node as unknown as { name: { value: string } }).name.value;
      if (varAssignments && varName in varAssignments) {
        // biome-ignore lint/style/noNonNullAssertion: Checked with `in` operator above
        return varAssignments[varName]!;
      }
      return createVarRefFromVariable(varName);
    }
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

/** Curried fragment function type: fragment("name", "type")`{ fields }` */
export type CurriedFragmentFunction = (name: string, typeName: string) => FragmentTaggedTemplateFunction;

/**
 * Construct a synthetic GraphQL fragment source from JS arguments and template body.
 * Handles optional variable declarations: `($var: Type!) { fields }` or `{ fields }`.
 */
function buildSyntheticFragmentSource(name: string, typeName: string, body: string): string {
  const trimmed = body.trim();
  if (trimmed.startsWith("(")) {
    // Has variable declarations — find the matching closing paren
    const closeIndex = findMatchingParen(trimmed, 0);
    if (closeIndex === -1) {
      throw new Error("Unmatched parenthesis in fragment variable declarations");
    }
    const varDecls = trimmed.slice(0, closeIndex + 1);
    const selectionSet = trimmed.slice(closeIndex + 1).trim();
    return `fragment ${name}${varDecls} on ${typeName} ${selectionSet}`;
  }
  return `fragment ${name} on ${typeName} ${trimmed}`;
}

/**
 * Creates a curried tagged template function for fragments.
 * New API: `fragment("name", "type")\`{ fields }\`` returns TemplateResult<AnyFragment>.
 *
 * @param schema - The GraphQL schema definition
 */
export function createFragmentTaggedTemplate<TSchema extends AnyGraphqlSchema>(schema: TSchema): CurriedFragmentFunction {
  const schemaIndex = createSchemaIndexFromSchema(schema);

  return (fragmentName: string, onType: string): FragmentTaggedTemplateFunction => {
    // Validate onType exists in schema at curried call time
    if (!(onType in schema.object)) {
      throw new Error(`Type "${onType}" is not defined in schema objects`);
    }

    return (
      strings: TemplateStringsArray,
      ...values: (AnyFragment | ((ctx: { $: Readonly<Record<string, AnyVarRef>> }) => AnyFieldsExtended))[]
    ): TemplateResult<AnyFragment> => {
      // Validate interpolated values are fragments or callbacks
      for (let i = 0; i < values.length; i++) {
        const value = values[i];
        if (!(value instanceof Fragment) && typeof value !== "function") {
          throw new Error(
            `Tagged templates only accept Fragment instances or callback functions as interpolated values. ` +
              `Received ${typeof value} at position ${i}.`,
          );
        }
      }

      // Build template body with placeholders for interpolations
      let body = strings[0] ?? "";
      const interpolationMap = new Map<
        string,
        AnyFragment | ((ctx: { $: Readonly<Record<string, AnyVarRef>> }) => AnyFieldsExtended)
      >();

      for (let i = 0; i < values.length; i++) {
        const placeholderName = `__INTERPOLATION_${i}__`;
        interpolationMap.set(
          placeholderName,
          values[i] as AnyFragment | ((ctx: { $: Readonly<Record<string, AnyVarRef>> }) => AnyFieldsExtended),
        );
        body += placeholderName + (strings[i + 1] ?? "");
      }

      // Construct synthetic GraphQL source from JS args and template body
      const rawSource = buildSyntheticFragmentSource(fragmentName, onType, body);

      // Extract variables from Fragment Arguments syntax
      let varSpecifiers = extractFragmentVariables(rawSource, schemaIndex);

      // Merge variable definitions from interpolated fragments
      varSpecifiers = mergeVariableDefinitions(varSpecifiers, interpolationMap);

      // Preprocess to strip Fragment Arguments syntax
      const { preprocessed } = preprocessFragmentArgs(rawSource);

      // Parse the preprocessed GraphQL
      let document: import("graphql").DocumentNode;
      try {
        document = parseGraphql(preprocessed);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`GraphQL parse error in tagged template: ${message}`);
      }

      // Extract the fragment definition (synthesized source guarantees exactly one)
      const fragmentDefs = document.definitions.filter((def) => def.kind === Kind.FRAGMENT_DEFINITION);
      if (fragmentDefs.length !== 1) {
        throw new Error(`Internal error: expected exactly one fragment definition in synthesized source`);
      }

      // biome-ignore lint/style/noNonNullAssertion: Length checked above
      const fragNode = fragmentDefs[0]!;
      if (fragNode.kind !== Kind.FRAGMENT_DEFINITION) {
        throw new Error("Unexpected definition kind");
      }

      return (options?: FragmentTemplateMetadataOptions): AnyFragment => {
        return Fragment.create<TSchema, typeof onType, typeof varSpecifiers, AnyFieldsExtended>(() => ({
          typename: onType,
          key: fragmentName,
          schemaLabel: schema.label,
          variableDefinitions: varSpecifiers,
          // biome-ignore lint/suspicious/noExplicitAny: Runtime-only spread needs dynamic variable types
          spread: (variables: any) => {
            const $ = createVarAssignments(varSpecifiers, variables);

            // Handle metadata - can be static value or callback
            let metadataBuilder: (() => unknown | Promise<unknown>) | null = null;
            if (options?.metadata !== undefined) {
              const metadata = options.metadata;
              if (typeof metadata === "function") {
                metadataBuilder = () => (metadata as (ctx: { $: unknown }) => unknown | Promise<unknown>)({ $ });
              } else {
                metadataBuilder = () => metadata;
              }
            }

            recordFragmentUsage({
              metadataBuilder,
              path: null,
            });

            return buildFieldsFromSelectionSet(
              fragNode.selectionSet,
              schema,
              onType,
              $ as Readonly<Record<string, AnyVarRef>>,
              interpolationMap,
            );
          },
          // biome-ignore lint/suspicious/noExplicitAny: Tagged template fragments bypass full type inference
        })) as any;
      };
    };
  };
}

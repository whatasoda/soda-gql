/**
 * Builds GraphQL AST nodes from field selections.
 *
 * Converts the type-safe field selection DSL into GraphQL AST,
 * producing a TypedDocumentNode for use with GraphQL clients.
 *
 * @module
 */

import type { TypedDocumentNode } from "@graphql-typed-document-node/core";
import {
  type ArgumentNode,
  type ConstObjectFieldNode,
  type ConstValueNode,
  type DirectiveNode,
  type DocumentNode,
  type FieldNode,
  type InlineFragmentNode,
  Kind,
  type NamedTypeNode,
  type ObjectFieldNode,
  OperationTypeNode,
  type SelectionNode,
  type TypeNode,
  type ValueNode,
  type VariableDefinitionNode,
} from "graphql";
import {
  type AnyAssignableInput,
  type AnyAssignableInputValue,
  type AnyDirectiveAttachments,
  type AnyFieldSelection,
  type AnyFieldsExtended,
  type AnyFieldValue,
  type AnyUnionSelection,
  type InferFieldsExtended,
  type ScalarShorthand,
  VarRef,
} from "../types/fragment";
import type { AnyGraphqlSchema, ConstAssignableInputFromVarDefs, OperationType } from "../types/schema";
import type {
  ConstValue,
  DeferredInputSpecifier,
  InputTypeSpecifiers,
  TypeModifier,
  VariableDefinitions,
} from "../types/type-foundation";
import { type AnyDirectiveRef, type DirectiveLocation, DirectiveRef } from "../types/type-foundation/directive-ref";
import { type ParsedInputSpecifier, parseInputSpecifier, parseOutputField } from "../utils/deferred-specifier-parser";

/**
 * Context for determining if a value should be output as an enum.
 * Contains the schema for looking up nested input types and the current type specifier.
 */
export type EnumLookup = {
  schema: AnyGraphqlSchema;
  /** Parsed type specifier for the current value. null means enum detection is skipped. */
  typeSpecifier: ParsedInputSpecifier | null;
};

/**
 * Converts an assignable input value to a GraphQL AST ValueNode.
 *
 * Handles primitives, arrays, objects, and variable references.
 * Returns null for undefined values (field is omitted).
 *
 * @param value - The value to convert
 * @param enumLookup - Context for enum detection. String values will be output
 *                     as Kind.ENUM if typeSpecifier indicates an enum type.
 */
export const buildArgumentValue = (value: AnyAssignableInputValue, enumLookup: EnumLookup): ValueNode | null => {
  if (value === undefined) {
    return null;
  }

  if (value === null) {
    return {
      kind: Kind.NULL,
    };
  }

  if (value instanceof VarRef) {
    const inner = VarRef.getInner(value);
    if (inner.type === "variable") {
      return {
        kind: Kind.VARIABLE,
        name: { kind: Kind.NAME, value: inner.name },
      };
    }

    if (inner.type === "nested-value") {
      // Recursively process the nested value
      // This handles VarRefs inside the nested structure
      return buildArgumentValue(inner.value as AnyAssignableInputValue, enumLookup);
    }

    throw new Error(`Unknown var ref type: ${inner satisfies never}`);
  }

  if (Array.isArray(value)) {
    // For list types, the inner type specifier remains the same (e.g., [Status!]! uses Status for each item)
    return {
      kind: Kind.LIST,
      values: value.map((item) => buildArgumentValue(item, enumLookup)).filter((item) => item !== null),
    };
  }

  if (typeof value === "object") {
    return {
      kind: Kind.OBJECT,
      fields: Object.entries(value)
        .map(([key, fieldValue]): ObjectFieldNode | null => {
          // Look up field type in nested InputObject for enum detection
          let fieldTypeSpecifier: ParsedInputSpecifier | null = null;
          if (enumLookup.typeSpecifier?.kind === "input") {
            const inputDef = enumLookup.schema.input[enumLookup.typeSpecifier.name];
            const fieldSpec = inputDef?.fields[key];
            fieldTypeSpecifier = fieldSpec ? parseInputSpecifier(fieldSpec) : null;
          }

          const valueNode = buildArgumentValue(fieldValue, {
            schema: enumLookup.schema,
            typeSpecifier: fieldTypeSpecifier,
          });
          return valueNode
            ? {
                kind: Kind.OBJECT_FIELD,
                name: { kind: Kind.NAME, value: key },
                value: valueNode,
              }
            : null;
        })
        .filter((item) => item !== null),
    };
  }

  if (typeof value === "string") {
    // Output as Kind.ENUM if the type specifier indicates this is an enum type
    if (enumLookup.typeSpecifier?.kind === "enum") {
      return {
        kind: Kind.ENUM,
        value,
      };
    }
    return {
      kind: Kind.STRING,
      value,
    };
  }

  if (typeof value === "number") {
    // Distinguish between INT and FLOAT
    const isFloat = !Number.isInteger(value) || value.toString().includes(".");
    return {
      kind: isFloat ? Kind.FLOAT : Kind.INT,
      value: value.toString(),
    };
  }

  if (typeof value === "boolean") {
    return {
      kind: Kind.BOOLEAN,
      value,
    };
  }

  throw new Error(`Unknown value type: ${typeof (value satisfies never)}`);
};

const buildArguments = (
  args: AnyAssignableInput,
  argumentSpecifiers: InputTypeSpecifiers,
  schema: AnyGraphqlSchema,
): ArgumentNode[] =>
  Object.entries(args ?? {})
    .map(([name, value]): ArgumentNode | null => {
      const specifierStr = argumentSpecifiers[name];
      const typeSpecifier = specifierStr ? parseInputSpecifier(specifierStr) : null;
      const valueNode = buildArgumentValue(value, { schema, typeSpecifier });
      return valueNode
        ? {
            kind: Kind.ARGUMENT,
            name: { kind: Kind.NAME, value: name },
            value: valueNode,
          }
        : null;
    })
    .filter((item) => item !== null);

/**
 * Build arguments from directive argument specifiers (deferred string format).
 * Uses parseInputSpecifier to convert deferred strings to structured format.
 */
const buildDirectiveArguments = (
  args: AnyAssignableInput,
  argumentSpecifiers: Readonly<Record<string, DeferredInputSpecifier>> | undefined,
  schema: AnyGraphqlSchema,
): ArgumentNode[] =>
  Object.entries(args ?? {})
    .map(([name, value]): ArgumentNode | null => {
      const spec = argumentSpecifiers?.[name];
      const typeSpecifier = spec ? parseInputSpecifier(spec) : null;
      const valueNode = buildArgumentValue(value, { schema, typeSpecifier });
      return valueNode
        ? {
            kind: Kind.ARGUMENT,
            name: { kind: Kind.NAME, value: name },
            value: valueNode,
          }
        : null;
    })
    .filter((item) => item !== null);

/**
 * Validates that a directive can be used at the specified location.
 *
 * @param directive - The directive reference to validate
 * @param expectedLocation - The location where the directive is being used
 * @throws Error if the directive is not valid at the specified location
 */
const validateDirectiveLocation = (directive: AnyDirectiveRef, expectedLocation: DirectiveLocation): void => {
  const inner = DirectiveRef.getInner(directive);
  if (!inner.locations.includes(expectedLocation)) {
    throw new Error(
      `Directive @${inner.name} cannot be used on ${expectedLocation}. ` + `Valid locations: ${inner.locations.join(", ")}`,
    );
  }
};

/**
 * Builds DirectiveNode array from field directives.
 *
 * Filters for DirectiveRef instances, validates their locations,
 * and converts them to GraphQL AST DirectiveNode objects.
 *
 * @param directives - Array of directive references (or unknown values)
 * @param location - The location context for validation
 * @param schema - The schema for type lookups
 * @returns Array of DirectiveNode for the GraphQL AST
 *
 * Uses argument specifiers from DirectiveRef (when available via createTypedDirectiveMethod)
 * to properly output enum arguments as Kind.ENUM instead of Kind.STRING.
 */
const buildDirectives = (
  directives: AnyDirectiveAttachments,
  location: DirectiveLocation,
  schema: AnyGraphqlSchema,
): DirectiveNode[] => {
  return directives
    .filter((d): d is AnyDirectiveRef => d instanceof DirectiveRef)
    .map((directive) => {
      validateDirectiveLocation(directive, location);
      const inner = DirectiveRef.getInner(directive);

      return {
        kind: Kind.DIRECTIVE as const,
        name: { kind: Kind.NAME as const, value: inner.name },
        arguments: buildDirectiveArguments(inner.arguments as AnyAssignableInput, inner.argumentSpecs, schema),
      };
    });
};

/**
 * Check if value is shorthand (true) vs factory return (AnyFieldSelection).
 * Used for field selection shorthand syntax support.
 */
const isShorthand = (value: AnyFieldValue): value is ScalarShorthand => {
  return value === true;
};

/**
 * Expand shorthand to AnyFieldSelection using schema type info.
 * Used at document build time to convert `true` to full field selection.
 *
 * @param schema - The GraphQL schema
 * @param typeName - The parent object type name
 * @param fieldName - The field name to select
 */
const expandShorthand = (schema: AnyGraphqlSchema, typeName: string, fieldName: string): AnyFieldSelection => {
  const typeDef = schema.object[typeName];
  if (!typeDef) {
    throw new Error(`Type "${typeName}" not found in schema`);
  }

  const fieldSpec = typeDef.fields[fieldName];
  if (!fieldSpec) {
    throw new Error(`Field "${fieldName}" not found on type "${typeName}"`);
  }

  return {
    parent: typeName,
    field: fieldName,
    type: fieldSpec,
    args: {},
    directives: [],
    object: null,
    union: null,
  };
};

const buildUnionSelection = (union: AnyUnionSelection, schema: AnyGraphqlSchema): SelectionNode[] => {
  const { selections, __typename: hasTypenameFlag } = union;

  const inlineFragments: InlineFragmentNode[] = Object.entries(selections)
    .map(([typeName, object]): InlineFragmentNode | null => {
      // Skip undefined values and non-object values (shouldn't happen but guard against it)
      if (!object || typeof object !== "object") {
        return null;
      }
      return {
        kind: Kind.INLINE_FRAGMENT,
        typeCondition: {
          kind: Kind.NAMED_TYPE,
          name: { kind: Kind.NAME, value: typeName },
        },
        selectionSet: {
          kind: Kind.SELECTION_SET,
          selections: buildField(object, schema, typeName),
        },
      };
    })
    .filter((item) => item !== null);

  if (hasTypenameFlag) {
    const typenameField: FieldNode = {
      kind: Kind.FIELD,
      name: { kind: Kind.NAME, value: "__typename" },
    };
    return [typenameField, ...inlineFragments];
  }

  return inlineFragments;
};

/**
 * Builds field nodes from extended fields map.
 * Supports both shorthand (true) and factory (AnyFieldSelection) syntax.
 *
 * @param fields - Field selections (shorthand or factory)
 * @param schema - The GraphQL schema
 * @param typeName - Parent type name (required for shorthand expansion)
 */
const buildField = (fields: AnyFieldsExtended, schema: AnyGraphqlSchema, typeName?: string): FieldNode[] =>
  Object.entries(fields).map(([alias, value]): FieldNode => {
    // __typename is an implicit introspection field on all object types
    if (alias === "__typename" && isShorthand(value)) {
      return {
        kind: Kind.FIELD,
        name: { kind: Kind.NAME, value: "__typename" },
      };
    }
    // Expand shorthand to AnyFieldSelection if needed
    const selection = isShorthand(value) ? expandShorthand(schema, typeName!, alias) : value;

    const { args, field, object, union, directives, type } = selection;
    const parsedType = parseOutputField(type);
    const builtDirectives = buildDirectives(directives, "FIELD", schema);
    return {
      kind: Kind.FIELD,
      name: { kind: Kind.NAME, value: field },
      alias: alias !== field ? { kind: Kind.NAME, value: alias } : undefined,
      arguments: buildArguments(args, parsedType.arguments as InputTypeSpecifiers, schema),
      directives: builtDirectives.length > 0 ? builtDirectives : undefined,
      selectionSet: object
        ? {
            kind: Kind.SELECTION_SET,
            selections: buildField(object, schema, parsedType.name),
          }
        : union
          ? {
              kind: Kind.SELECTION_SET,
              selections: buildUnionSelection(union, schema),
            }
          : undefined,
    };
  });

/**
 * Converts a constant value to a GraphQL AST ConstValueNode.
 *
 * Unlike `buildArgumentValue`, this only handles literal values
 * (no variable references). Used for default values.
 *
 * @param value - The constant value to convert
 * @param enumLookup - Context for enum detection. String values will be output
 *                     as Kind.ENUM if typeSpecifier indicates an enum type.
 */
export const buildConstValueNode = (value: ConstValue, enumLookup: EnumLookup): ConstValueNode | null => {
  if (value === undefined) {
    return null;
  }

  if (value === null) {
    return { kind: Kind.NULL };
  }

  if (Array.isArray(value)) {
    // For list types, the inner type specifier remains the same
    return {
      kind: Kind.LIST,
      values: value.map((item) => buildConstValueNode(item, enumLookup)).filter((item) => item !== null),
    };
  }

  if (typeof value === "object") {
    return {
      kind: Kind.OBJECT,
      fields: Object.entries(value)
        .map(([key, fieldValue]): ConstObjectFieldNode | null => {
          // Look up field type in nested InputObject for enum detection
          let fieldTypeSpecifier: ParsedInputSpecifier | null = null;
          if (enumLookup.typeSpecifier?.kind === "input") {
            const inputDef = enumLookup.schema.input[enumLookup.typeSpecifier.name];
            const fieldSpec = inputDef?.fields[key];
            fieldTypeSpecifier = fieldSpec ? parseInputSpecifier(fieldSpec) : null;
          }

          const valueNode = buildConstValueNode(fieldValue, {
            schema: enumLookup.schema,
            typeSpecifier: fieldTypeSpecifier,
          });
          return valueNode
            ? {
                kind: Kind.OBJECT_FIELD,
                name: { kind: Kind.NAME, value: key },
                value: valueNode,
              }
            : null;
        })
        .filter((item) => item !== null),
    };
  }

  if (typeof value === "string") {
    // Output as Kind.ENUM if the type specifier indicates this is an enum type
    if (enumLookup.typeSpecifier?.kind === "enum") {
      return { kind: Kind.ENUM, value };
    }
    return { kind: Kind.STRING, value };
  }

  if (typeof value === "boolean") {
    return { kind: Kind.BOOLEAN, value };
  }

  if (typeof value === "number") {
    // Distinguish between INT and FLOAT
    const isFloat = !Number.isInteger(value) || value.toString().includes(".");
    return { kind: isFloat ? Kind.FLOAT : Kind.INT, value: value.toString() };
  }

  throw new Error(`Unknown value type: ${typeof (value satisfies never)}`);
};

/**
 * Wraps a named type with modifiers (non-null, list).
 *
 * Modifier format: starts with `?` (nullable) or `!` (non-null),
 * followed by `[]?` or `[]!` pairs for lists.
 *
 * @example
 * - `"!"` → `String!`
 * - `"?"` → `String`
 * - `"![]!"` → `[String!]!`
 * - `"?[]?"` → `[String]`
 */
export const buildWithTypeModifier = (modifier: TypeModifier, buildType: () => NamedTypeNode): TypeNode => {
  const baseType = buildType();

  if (modifier === "?") {
    return baseType;
  }

  if (modifier === "!") {
    return { kind: Kind.NON_NULL_TYPE, type: baseType };
  }

  // Validate modifier format: must start with ? or !, followed by []? or []! pairs
  // Valid patterns: "?", "!", "?[]?", "?[]!", "![]?", "![]!", "?[]?[]?", etc.
  const validModifierPattern = /^[?!](\[\][?!])*$/;
  if (!validModifierPattern.test(modifier)) {
    throw new Error(`Unknown modifier: ${modifier}`);
  }

  // New format: starts with inner type modifier (? or !), then []? or []! pairs
  // e.g., "?[]?" = nullable list of nullable, "![]!" = non-null list of non-null
  let curr: Readonly<{ modifier: string; type: TypeNode }> = {
    modifier,
    type: baseType,
  };

  while (curr.modifier.length > 0) {
    // Handle inner type modifier (? or !)
    if (curr.modifier.startsWith("?")) {
      // Nullable inner type - type stays as-is
      curr = {
        modifier: curr.modifier.slice(1),
        type: curr.type,
      };
      continue;
    }

    if (curr.modifier.startsWith("!")) {
      // Non-null inner type
      curr = {
        modifier: curr.modifier.slice(1),
        type: curr.type.kind === Kind.NON_NULL_TYPE ? curr.type : { kind: Kind.NON_NULL_TYPE, type: curr.type },
      };
      continue;
    }

    // Handle list modifiers ([]? or []!)
    if (curr.modifier.startsWith("[]?")) {
      // Nullable list
      curr = {
        modifier: curr.modifier.slice(3),
        type: { kind: Kind.LIST_TYPE, type: curr.type },
      };
      continue;
    }

    if (curr.modifier.startsWith("[]!")) {
      // Non-null list
      curr = {
        modifier: curr.modifier.slice(3),
        type: {
          kind: Kind.NON_NULL_TYPE,
          type: { kind: Kind.LIST_TYPE, type: curr.type },
        },
      };
      continue;
    }

    throw new Error(`Unknown modifier: ${curr.modifier}`);
  }

  return curr.type;
};

/**
 * VarSpecifier shape from $var() at runtime.
 * Operation variables use structured objects, not deferred strings.
 */
export type AnyVarSpecifier = {
  kind: "scalar" | "enum" | "input";
  name: string;
  modifier: TypeModifier;
  defaultValue: null | { default: ConstValue };
  directives: Record<string, unknown>;
};

// VariableDefinitions is imported from type-foundation

const buildVariables = (variables: Record<string, AnyVarSpecifier>, schema: AnyGraphqlSchema): VariableDefinitionNode[] => {
  return Object.entries(variables).map(([name, varSpec]): VariableDefinitionNode => {
    // Build default value if present
    let defaultValue: ConstValueNode | undefined;
    if (varSpec.defaultValue) {
      // Convert VarSpecifier to ParsedInputSpecifier format for enum lookup
      const parsedSpec: ParsedInputSpecifier = {
        kind: varSpec.kind,
        name: varSpec.name,
        modifier: varSpec.modifier,
        hasDefault: true,
      };
      const enumLookup: EnumLookup = { schema, typeSpecifier: parsedSpec };
      const constValue = buildConstValueNode(varSpec.defaultValue.default, enumLookup);
      defaultValue = constValue ?? undefined;
    }

    return {
      kind: Kind.VARIABLE_DEFINITION,
      variable: { kind: Kind.VARIABLE, name: { kind: Kind.NAME, value: name } },
      defaultValue,
      type: buildWithTypeModifier(varSpec.modifier, () => ({
        kind: Kind.NAMED_TYPE,
        name: { kind: Kind.NAME, value: varSpec.name },
      })),
    };
  });
};

/**
 * Converts an operation type string to a GraphQL AST OperationTypeNode.
 */
export const buildOperationTypeNode = (operation: OperationType): OperationTypeNode => {
  switch (operation) {
    case "query":
      return OperationTypeNode.QUERY;
    case "mutation":
      return OperationTypeNode.MUTATION;
    case "subscription":
      return OperationTypeNode.SUBSCRIPTION;
    default:
      throw new Error(`Unknown operation type: ${operation}`);
  }
};

/**
 * Builds a TypedDocumentNode from operation options.
 *
 * This is the main entry point for converting field selections into
 * a GraphQL document AST. The result can be used with any GraphQL
 * client that supports TypedDocumentNode.
 *
 * @param options - Operation configuration (name, type, variables, fields, schema)
 * @returns TypedDocumentNode with inferred input/output types
 */
export const buildDocument = <
  TSchema extends AnyGraphqlSchema,
  TTypeName extends keyof TSchema["object"] & string,
  TFields extends AnyFieldsExtended,
  TVarDefinitions extends VariableDefinitions,
>(options: {
  operationName: string;
  operationType: OperationType;
  operationTypeName: TTypeName;
  variables: TVarDefinitions;
  fields: TFields;
  schema: TSchema;
}): TypedDocumentNode<
  InferFieldsExtended<TSchema, TTypeName, TFields>,
  ConstAssignableInputFromVarDefs<TSchema, TVarDefinitions>
> => {
  const { operationName, operationType, operationTypeName, variables, fields, schema } = options;
  return {
    kind: Kind.DOCUMENT,
    definitions: [
      {
        kind: Kind.OPERATION_DEFINITION,
        operation: buildOperationTypeNode(operationType),
        name: { kind: Kind.NAME, value: operationName },
        variableDefinitions: buildVariables(variables, schema),
        // directives: directives || [],
        selectionSet: {
          kind: Kind.SELECTION_SET,
          selections: buildField(fields, schema, operationTypeName),
        },
      },
    ],
  } satisfies DocumentNode as TypedDocumentNode<
    InferFieldsExtended<TSchema, TTypeName, TFields>,
    ConstAssignableInputFromVarDefs<TSchema, TVarDefinitions>
  >;
};

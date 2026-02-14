/**
 * SchemaIndex type and factory for building a schema index from a GraphQL DocumentNode.
 * Extracted from packages/codegen/src/generator.ts for shared use.
 * @module
 */

import type {
  ConstDirectiveNode,
  DocumentNode,
  EnumValueDefinitionNode,
  FieldDefinitionNode,
  InputValueDefinitionNode,
  NamedTypeNode,
  SchemaDefinitionNode,
  SchemaExtensionNode,
} from "graphql";
import { Kind } from "graphql";

export type OperationTypeNames = {
  query?: string;
  mutation?: string;
  subscription?: string;
};

export type ObjectRecord = {
  readonly name: string;
  readonly fields: Map<string, FieldDefinitionNode>;
  directives: ConstDirectiveNode[];
};

export type InputRecord = {
  readonly name: string;
  readonly fields: Map<string, InputValueDefinitionNode>;
  directives: ConstDirectiveNode[];
};

export type EnumRecord = {
  readonly name: string;
  readonly values: Map<string, EnumValueDefinitionNode>;
  directives: ConstDirectiveNode[];
};

export type UnionRecord = {
  readonly name: string;
  readonly members: Map<string, NamedTypeNode>;
  directives: ConstDirectiveNode[];
};

export type ScalarRecord = {
  readonly name: string;
  directives: ConstDirectiveNode[];
};

export type DirectiveRecord = {
  readonly name: string;
  readonly locations: readonly string[];
  readonly args: Map<string, InputValueDefinitionNode>;
  readonly isRepeatable: boolean;
};

export type SchemaIndex = {
  readonly objects: Map<string, ObjectRecord>;
  readonly inputs: Map<string, InputRecord>;
  readonly enums: Map<string, EnumRecord>;
  readonly unions: Map<string, UnionRecord>;
  readonly scalars: Map<string, ScalarRecord>;
  readonly directives: Map<string, DirectiveRecord>;
  readonly operationTypes: OperationTypeNames;
};

const ensureRecord = <T>(collection: Map<string, T>, key: string, factory: (name: string) => T): T => {
  const existing = collection.get(key);
  if (existing) {
    return existing;
  }
  const created = factory(key);
  collection.set(key, created);
  return created;
};

const addObjectFields = (
  target: Map<string, FieldDefinitionNode>,
  fields: readonly FieldDefinitionNode[] | undefined,
): void => {
  if (!fields) return;
  for (const field of fields) {
    target.set(field.name.value, field);
  }
};

const addInputFields = (
  target: Map<string, InputValueDefinitionNode>,
  fields: readonly InputValueDefinitionNode[] | undefined,
): void => {
  if (!fields) return;
  for (const field of fields) {
    target.set(field.name.value, field);
  }
};

const addEnumValues = (
  target: Map<string, EnumValueDefinitionNode>,
  values: readonly EnumValueDefinitionNode[] | undefined,
): void => {
  if (!values) return;
  for (const value of values) {
    target.set(value.name.value, value);
  }
};

const addUnionMembers = (target: Map<string, NamedTypeNode>, members: readonly NamedTypeNode[] | undefined): void => {
  if (!members) return;
  for (const member of members) {
    target.set(member.name.value, member);
  }
};

const mergeDirectives = (
  existing: ConstDirectiveNode[] | undefined,
  incoming: readonly ConstDirectiveNode[] | undefined,
  precedence: "definition" | "extension",
): ConstDirectiveNode[] => {
  const current = existing ?? [];
  const next = incoming ? Array.from(incoming) : [];
  return precedence === "definition" ? [...next, ...current] : [...current, ...next];
};

const updateOperationTypes = (
  operationTypes: OperationTypeNames,
  definition: SchemaDefinitionNode | SchemaExtensionNode,
): void => {
  for (const operation of definition.operationTypes ?? []) {
    const typeName = operation.type.name.value;
    switch (operation.operation) {
      case "query":
        operationTypes.query = typeName;
        break;
      case "mutation":
        operationTypes.mutation = typeName;
        break;
      case "subscription":
        operationTypes.subscription = typeName;
        break;
      default:
        break;
    }
  }
};

const addDirectiveArgs = (
  target: Map<string, InputValueDefinitionNode>,
  args: readonly InputValueDefinitionNode[] | undefined,
): void => {
  if (!args) return;
  for (const arg of args) {
    target.set(arg.name.value, arg);
  }
};

/** Build a schema index from a parsed GraphQL schema document. */
export const createSchemaIndex = (document: DocumentNode): SchemaIndex => {
  const objects = new Map<string, ObjectRecord>();
  const inputs = new Map<string, InputRecord>();
  const enums = new Map<string, EnumRecord>();
  const unions = new Map<string, UnionRecord>();
  const scalars = new Map<string, ScalarRecord>();
  const directives = new Map<string, DirectiveRecord>();
  const operationTypes: OperationTypeNames = {};

  for (const definition of document.definitions) {
    switch (definition.kind) {
      case Kind.OBJECT_TYPE_DEFINITION:
      case Kind.OBJECT_TYPE_EXTENSION: {
        const precedence = definition.kind === Kind.OBJECT_TYPE_DEFINITION ? "definition" : "extension";
        const record = ensureRecord(objects, definition.name.value, (name) => ({
          name,
          fields: new Map<string, FieldDefinitionNode>(),
          directives: [],
        }));
        addObjectFields(record.fields, definition.fields);
        record.directives = mergeDirectives(record.directives, definition.directives, precedence);
        break;
      }
      case Kind.INPUT_OBJECT_TYPE_DEFINITION:
      case Kind.INPUT_OBJECT_TYPE_EXTENSION: {
        const precedence = definition.kind === Kind.INPUT_OBJECT_TYPE_DEFINITION ? "definition" : "extension";
        const record = ensureRecord(inputs, definition.name.value, (name) => ({
          name,
          fields: new Map<string, InputValueDefinitionNode>(),
          directives: [],
        }));
        addInputFields(record.fields, definition.fields);
        record.directives = mergeDirectives(record.directives, definition.directives, precedence);
        break;
      }
      case Kind.ENUM_TYPE_DEFINITION:
      case Kind.ENUM_TYPE_EXTENSION: {
        const precedence = definition.kind === Kind.ENUM_TYPE_DEFINITION ? "definition" : "extension";
        const record = ensureRecord(enums, definition.name.value, (name) => ({
          name,
          values: new Map<string, EnumValueDefinitionNode>(),
          directives: [],
        }));
        addEnumValues(record.values, definition.values);
        record.directives = mergeDirectives(record.directives, definition.directives, precedence);
        break;
      }
      case Kind.UNION_TYPE_DEFINITION:
      case Kind.UNION_TYPE_EXTENSION: {
        const precedence = definition.kind === Kind.UNION_TYPE_DEFINITION ? "definition" : "extension";
        const record = ensureRecord(unions, definition.name.value, (name) => ({
          name,
          members: new Map<string, NamedTypeNode>(),
          directives: [],
        }));
        addUnionMembers(record.members, definition.types);
        record.directives = mergeDirectives(record.directives, definition.directives, precedence);
        break;
      }
      case Kind.SCALAR_TYPE_DEFINITION:
      case Kind.SCALAR_TYPE_EXTENSION: {
        const precedence = definition.kind === Kind.SCALAR_TYPE_DEFINITION ? "definition" : "extension";
        const record = ensureRecord(scalars, definition.name.value, (name) => ({
          name,
          directives: [],
        }));
        record.directives = mergeDirectives(record.directives, definition.directives, precedence);
        break;
      }
      case Kind.DIRECTIVE_DEFINITION: {
        const name = definition.name.value;
        if (name === "skip" || name === "include" || name === "deprecated" || name === "specifiedBy") {
          break;
        }
        const args = new Map<string, InputValueDefinitionNode>();
        addDirectiveArgs(args, definition.arguments);
        directives.set(name, {
          name,
          locations: definition.locations.map((loc) => loc.value),
          args,
          isRepeatable: definition.repeatable,
        });
        break;
      }
      case Kind.SCHEMA_DEFINITION:
      case Kind.SCHEMA_EXTENSION:
        updateOperationTypes(operationTypes, definition);
        break;
      default:
        break;
    }
  }

  if (!operationTypes.query && objects.has("Query")) {
    operationTypes.query = "Query";
  }
  if (!operationTypes.mutation && objects.has("Mutation")) {
    operationTypes.mutation = "Mutation";
  }
  if (!operationTypes.subscription && objects.has("Subscription")) {
    operationTypes.subscription = "Subscription";
  }

  return {
    objects,
    inputs,
    enums,
    unions,
    scalars,
    directives,
    operationTypes,
  };
};

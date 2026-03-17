/**
 * Resolves untyped ExtractedFieldTree against a GraphQL schema
 * to produce TypedFieldTree with full type context.
 * @module
 */

import type { ExtractedFieldTree, FieldCallNode, OperationKind, UnionBranchNode } from "@soda-gql/common/template-extraction";
import {
  type GraphQLField,
  type GraphQLNamedType,
  type GraphQLSchema,
  GraphQLUnionType,
  getNamedType,
  isObjectType,
} from "graphql";

/** A field node resolved against the schema. */
export type TypedFieldNode = {
  readonly fieldName: string;
  readonly fieldNameSpan: { readonly start: number; readonly end: number };
  readonly callSpan: { readonly start: number; readonly end: number };
  readonly parentTypeName: string;
  /** null if field not found in schema */
  readonly fieldTypeName: string | null;
  readonly fieldTypeKind: "object" | "union" | "scalar" | "enum" | null;
  readonly nested: TypedFieldNested | null;
};

export type TypedFieldNested =
  | {
      readonly kind: "object";
      readonly span: { readonly start: number; readonly end: number };
      readonly children: readonly TypedFieldNode[];
    }
  | {
      readonly kind: "union";
      readonly span: { readonly start: number; readonly end: number };
      readonly branches: readonly TypedUnionBranch[];
    };

export type TypedUnionBranch = {
  readonly typeName: string;
  readonly typeNameSpan: { readonly start: number; readonly end: number };
  readonly branchSpan: { readonly start: number; readonly end: number };
  /** Whether typeName is a valid member of the parent union type. */
  readonly valid: boolean;
  readonly children: readonly TypedFieldNode[];
};

export type TypedFieldTree = {
  readonly schemaName: string;
  readonly rootTypeName: string;
  readonly rootSpan: { readonly start: number; readonly end: number };
  readonly children: readonly TypedFieldNode[];
};

export type FieldTreeLookupResult =
  | { readonly kind: "field"; readonly node: TypedFieldNode }
  | { readonly kind: "unionMember"; readonly branch: TypedUnionBranch; readonly parentNode: TypedFieldNode };

/** Get the root type name for an operation kind from the schema. */
const getRootTypeName = (schema: GraphQLSchema, kind: OperationKind): string | null => {
  switch (kind) {
    case "query":
      return schema.getQueryType()?.name ?? null;
    case "mutation":
      return schema.getMutationType()?.name ?? null;
    case "subscription":
      return schema.getSubscriptionType()?.name ?? null;
    default:
      return null;
  }
};

/** Classify a GraphQL named type into a kind string. */
const classifyType = (namedType: GraphQLNamedType): "object" | "union" | "scalar" | "enum" => {
  if (isObjectType(namedType)) return "object";
  if (namedType instanceof GraphQLUnionType) return "union";
  if ("getValues" in namedType) return "enum";
  return "scalar";
};

/** Resolve a single field from a parent object type. */
const resolveField = (
  schema: GraphQLSchema,
  parentTypeName: string,
  fieldName: string,
): { fieldDef: GraphQLField<unknown, unknown>; namedType: GraphQLNamedType } | null => {
  const parentType = schema.getType(parentTypeName);
  if (!parentType || !isObjectType(parentType)) return null;

  const fields = parentType.getFields();
  const fieldDef = fields[fieldName];
  if (!fieldDef) return null;

  const namedType = getNamedType(fieldDef.type);
  if (!namedType) return null;

  return { fieldDef, namedType };
};

/** Resolve untyped FieldCallNode children into typed nodes. */
const resolveChildren = (
  schema: GraphQLSchema,
  parentTypeName: string,
  children: readonly FieldCallNode[],
): readonly TypedFieldNode[] => {
  return children.map((child) => resolveNode(schema, parentTypeName, child));
};

/** Resolve a single FieldCallNode into a TypedFieldNode. */
const resolveNode = (schema: GraphQLSchema, parentTypeName: string, node: FieldCallNode): TypedFieldNode => {
  const resolved = resolveField(schema, parentTypeName, node.fieldName);

  const fieldTypeName = resolved?.namedType.name ?? null;
  const fieldTypeKind = resolved ? classifyType(resolved.namedType) : null;

  let nested: TypedFieldNested | null = null;
  if (node.nested) {
    if (node.nested.kind === "object" && fieldTypeName) {
      nested = {
        kind: "object",
        span: node.nested.span,
        children: resolveChildren(schema, fieldTypeName, node.nested.children),
      };
    } else if (node.nested.kind === "union") {
      nested = resolveUnionNested(schema, resolved?.namedType ?? null, node.nested);
    }
  }

  return {
    fieldName: node.fieldName,
    fieldNameSpan: node.fieldNameSpan,
    callSpan: node.callSpan,
    parentTypeName,
    fieldTypeName,
    fieldTypeKind,
    nested,
  };
};

/** Resolve union branches against a union type. */
const resolveUnionNested = (
  schema: GraphQLSchema,
  unionType: GraphQLNamedType | null,
  nested: {
    readonly kind: "union";
    readonly span: { readonly start: number; readonly end: number };
    readonly branches: readonly UnionBranchNode[];
  },
): TypedFieldNested => {
  const memberNames = new Set<string>();
  if (unionType instanceof GraphQLUnionType) {
    for (const member of unionType.getTypes()) {
      memberNames.add(member.name);
    }
  }

  const branches: TypedUnionBranch[] = nested.branches.map((branch) => ({
    typeName: branch.typeName,
    typeNameSpan: branch.typeNameSpan,
    branchSpan: branch.branchSpan,
    valid: memberNames.has(branch.typeName),
    children: resolveChildren(schema, branch.typeName, branch.children),
  }));

  return { kind: "union", span: nested.span, branches };
};

/**
 * Resolve an ExtractedFieldTree against a GraphQL schema.
 * Returns null if the operation kind has no corresponding root type.
 */
export const resolveFieldTree = (tree: ExtractedFieldTree, schema: GraphQLSchema): TypedFieldTree | null => {
  const rootTypeName = getRootTypeName(schema, tree.kind);
  if (!rootTypeName) return null;

  return {
    schemaName: tree.schemaName,
    rootTypeName,
    rootSpan: tree.rootSpan,
    children: resolveChildren(schema, rootTypeName, tree.children),
  };
};

/**
 * Find the TypedFieldNode or TypedUnionBranch at a given offset.
 * Searches fieldNameSpan for field matches and typeNameSpan for union member matches.
 */
export const findNodeAtOffset = (tree: TypedFieldTree, offset: number): FieldTreeLookupResult | null => {
  return findInChildren(tree.children, offset, null);
};

const findInChildren = (
  children: readonly TypedFieldNode[],
  offset: number,
  _parentForUnion: TypedFieldNode | null,
): FieldTreeLookupResult | null => {
  for (const node of children) {
    // Check if offset is within the field name string literal
    if (offset >= node.fieldNameSpan.start && offset <= node.fieldNameSpan.end) {
      return { kind: "field", node };
    }

    // Recurse into nested structure
    if (node.nested) {
      if (node.nested.kind === "object") {
        const result = findInChildren(node.nested.children, offset, null);
        if (result) return result;
      } else if (node.nested.kind === "union") {
        for (const branch of node.nested.branches) {
          // Check union member type name
          if (offset >= branch.typeNameSpan.start && offset <= branch.typeNameSpan.end) {
            return { kind: "unionMember", branch, parentNode: node };
          }
          // Recurse into branch children
          const result = findInChildren(branch.children, offset, node);
          if (result) return result;
        }
      }
    }
  }
  return null;
};

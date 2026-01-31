/**
 * Schema type reachability analysis.
 *
 * Determines which types are reachable from root types (Query/Mutation/Subscription)
 * to specified target types (e.g., fragment onType values from .graphql files).
 * Produces a CompiledFilter for use with existing buildExclusionSet.
 *
 * @module
 */

import { type DocumentNode, Kind, type TypeNode } from "graphql";

import { createSchemaIndex } from "./generator";
import type { FilterContext } from "./type-filter";

type TypeGraph = {
  readonly forward: ReadonlyMap<string, ReadonlySet<string>>;
  readonly reverse: ReadonlyMap<string, ReadonlySet<string>>;
};

const extractNamedType = (typeNode: TypeNode): string => {
  switch (typeNode.kind) {
    case Kind.NAMED_TYPE:
      return typeNode.name.value;
    case Kind.LIST_TYPE:
      return extractNamedType(typeNode.type);
    case Kind.NON_NULL_TYPE:
      return extractNamedType(typeNode.type);
  }
};

const addEdge = (graph: Map<string, Set<string>>, from: string, to: string): void => {
  let edges = graph.get(from);
  if (!edges) {
    edges = new Set();
    graph.set(from, edges);
  }
  edges.add(to);
};

const buildTypeGraph = (document: DocumentNode): { graph: TypeGraph; schema: ReturnType<typeof createSchemaIndex> } => {
  const schema = createSchemaIndex(document);
  const forward = new Map<string, Set<string>>();
  const reverse = new Map<string, Set<string>>();

  const addBidirectional = (from: string, to: string): void => {
    addEdge(forward, from, to);
    addEdge(reverse, to, from);
  };

  // Object types: fields return types + field argument types
  for (const [typeName, record] of schema.objects) {
    for (const field of record.fields.values()) {
      const returnType = extractNamedType(field.type);
      addBidirectional(typeName, returnType);

      if (field.arguments) {
        for (const arg of field.arguments) {
          const argType = extractNamedType(arg.type);
          addBidirectional(typeName, argType);
        }
      }
    }
  }

  // Input types: field types
  for (const [typeName, record] of schema.inputs) {
    for (const field of record.fields.values()) {
      const fieldType = extractNamedType(field.type);
      addBidirectional(typeName, fieldType);
    }
  }

  // Union types: member types
  for (const [typeName, record] of schema.unions) {
    for (const memberName of record.members.keys()) {
      addBidirectional(typeName, memberName);
    }
  }

  return {
    graph: { forward, reverse },
    schema,
  };
};

/**
 * BFS traversal collecting all reachable nodes from seeds.
 */
const bfs = (adjacency: ReadonlyMap<string, ReadonlySet<string>>, seeds: Iterable<string>, constraint?: ReadonlySet<string>): Set<string> => {
  const visited = new Set<string>();
  const queue: string[] = [];

  for (const seed of seeds) {
    if (!visited.has(seed)) {
      visited.add(seed);
      queue.push(seed);
    }
  }

  let head = 0;
  while (head < queue.length) {
    const current = queue[head++]!;
    const neighbors = adjacency.get(current);
    if (!neighbors) continue;

    for (const neighbor of neighbors) {
      if (visited.has(neighbor)) continue;
      if (constraint && !constraint.has(neighbor)) continue;
      visited.add(neighbor);
      queue.push(neighbor);
    }
  }

  return visited;
};

/**
 * Compute the set of type names reachable on paths from root types to target types.
 *
 * Algorithm:
 * 1. Backward BFS from target types to find all upstream types
 * 2. Forward BFS from root types, constrained to upstream set, to find actual paths
 * 3. Collect input/enum/scalar types used as field arguments on reachable object types
 */
const computeReachableTypes = (
  graph: TypeGraph,
  schema: ReturnType<typeof createSchemaIndex>,
  targetTypes: ReadonlySet<string>,
  usedInputTypes?: ReadonlySet<string>,
): Set<string> => {
  // Step 1: Backward BFS from targets
  const upstream = bfs(graph.reverse, targetTypes);

  // Step 2: Forward BFS from roots, constrained to upstream set
  const rootTypes: string[] = [];
  if (schema.operationTypes.query) rootTypes.push(schema.operationTypes.query);
  if (schema.operationTypes.mutation) rootTypes.push(schema.operationTypes.mutation);
  if (schema.operationTypes.subscription) rootTypes.push(schema.operationTypes.subscription);

  // Only start from roots that are in the upstream set (i.e., can reach a target)
  const validRoots = rootTypes.filter((r) => upstream.has(r));
  const pathTypes = bfs(graph.forward, validRoots, upstream);

  // Step 3: Collect argument types (inputs, enums, scalars) for reachable object types
  const reachable = new Set(pathTypes);
  const inputQueue: string[] = [];

  for (const typeName of pathTypes) {
    const objectRecord = schema.objects.get(typeName);
    if (!objectRecord) continue;

    for (const field of objectRecord.fields.values()) {
      // Collect field return type scalars/enums referenced by reachable types
      const returnType = extractNamedType(field.type);
      if (!reachable.has(returnType)) {
        // Include scalars (both custom and builtin) and enums
        const isKnownComposite = schema.objects.has(returnType) || schema.inputs.has(returnType) || schema.unions.has(returnType);
        if (!isKnownComposite) {
          // It's a scalar (builtin or custom) or enum
          reachable.add(returnType);
        }
      }

      // Collect argument types (only when usedInputTypes is not provided)
      if (!usedInputTypes && field.arguments) {
        for (const arg of field.arguments) {
          const argType = extractNamedType(arg.type);
          if (!reachable.has(argType)) {
            reachable.add(argType);
            if (schema.inputs.has(argType)) {
              inputQueue.push(argType);
            }
          }
        }
      }
    }
  }

  // When usedInputTypes is provided, seed from it instead of field arguments
  if (usedInputTypes) {
    for (const inputName of usedInputTypes) {
      if (!reachable.has(inputName)) {
        reachable.add(inputName);
        inputQueue.push(inputName);
      }
    }
  }

  // Transitively resolve input types
  let inputHead = 0;
  while (inputHead < inputQueue.length) {
    const inputName = inputQueue[inputHead++]!;
    const inputRecord = schema.inputs.get(inputName);
    if (!inputRecord) continue;

    for (const field of inputRecord.fields.values()) {
      const fieldType = extractNamedType(field.type);
      if (!reachable.has(fieldType)) {
        reachable.add(fieldType);
        if (schema.inputs.has(fieldType)) {
          inputQueue.push(fieldType);
        }
      }
    }
  }

  return reachable;
};

export type ReachabilityResult = {
  readonly filter: (context: FilterContext) => boolean;
  readonly warnings: readonly string[];
};

/**
 * Compute a filter function that includes only types reachable from root types
 * to the specified target types.
 *
 * When targetTypes is empty, returns a pass-all filter (no filtering).
 * Warns when target types are not found in the schema.
 *
 * @param document - The parsed GraphQL schema document
 * @param targetTypes - Set of type names that fragments target (e.g., from ParsedFragment.onType)
 * @returns Filter function and any warnings
 */
export const computeReachabilityFilter = (
  document: DocumentNode,
  targetTypes: ReadonlySet<string>,
  usedInputTypes?: ReadonlySet<string>,
): ReachabilityResult => {
  if (targetTypes.size === 0) {
    return { filter: () => true, warnings: [] };
  }

  const { graph, schema } = buildTypeGraph(document);

  // Validate target types exist in schema
  const allTypeNames = new Set([
    ...schema.objects.keys(),
    ...schema.inputs.keys(),
    ...schema.enums.keys(),
    ...schema.unions.keys(),
    ...schema.scalars.keys(),
  ]);
  const warnings: string[] = [];
  const validTargets = new Set<string>();
  for (const target of targetTypes) {
    if (allTypeNames.has(target)) {
      validTargets.add(target);
    } else {
      warnings.push(`Target type "${target}" not found in schema`);
    }
  }

  if (validTargets.size === 0) {
    return { filter: () => true, warnings };
  }

  const reachable = computeReachableTypes(graph, schema, validTargets, usedInputTypes);
  return {
    filter: (context: FilterContext) => reachable.has(context.name),
    warnings,
  };
};

/**
 * SWC implementation of the transform adapter for plugin-swc.
 *
 * This is a simplified version that only includes the transformation logic needed
 * for the SWC plugin, without the full TransformAdapter interface from plugin-shared.
 */

import type { CanonicalId, GraphqlSystemIdentifyHelper } from "@soda-gql/builder";
import type { CallExpression, ExpressionStatement, Module, Span } from "@swc/types";
import { ensureGqlRuntimeImport, removeGraphqlSystemImports } from "./imports";

/**
 * SWC-specific environment required for the adapter.
 */
export type SwcEnv = {
  readonly module: Module;
  readonly swc: typeof import("@swc/core");
  readonly filename: string;
};

/**
 * Context for transformation.
 */
export type TransformContext = {
  readonly filename: string;
  readonly artifactLookup: (canonicalId: CanonicalId) => unknown;
  readonly runtimeModule: string;
};

/**
 * Result of a transformation pass.
 */
export type TransformResult = {
  readonly transformed: boolean;
  readonly runtimeArtifacts?: ReadonlyArray<unknown>;
};

/**
 * SWC adapter for transforming GraphQL operations.
 */
export class SwcAdapter {
  private env: SwcEnv;
  private readonly swc: typeof import("@swc/core");
  private readonly graphqlSystemIdentifyHelper: GraphqlSystemIdentifyHelper;
  private runtimeCallsFromLastTransform: CallExpression[] = [];

  constructor(env: SwcEnv, graphqlSystemIdentifyHelper: GraphqlSystemIdentifyHelper) {
    this.env = env;
    this.swc = env.swc;
    this.graphqlSystemIdentifyHelper = graphqlSystemIdentifyHelper;
  }

  /**
   * Transform the entire program.
   *
   * Detection-only implementation for v0.0.1:
   * - Detects gql.default calls containing operations
   * - Marks as transformed when detected
   * - Returns original AST unchanged
   */
  transformProgram(_context: TransformContext): TransformResult {
    this.runtimeCallsFromLastTransform = [];
    let transformed = false;

    // Helper to recursively visit nodes
    // biome-ignore lint/suspicious/noExplicitAny: SWC AST traversal
    const visit = (node: any): any => {
      if (!node || typeof node !== "object") {
        return node;
      }

      // Handle CallExpression nodes
      if (node.type === "CallExpression") {
        const gqlCall = this.detectGqlOperationCall(node as CallExpression);
        if (gqlCall) {
          transformed = true;
          return node;
        }
      }

      // Recursively visit children
      if (Array.isArray(node)) {
        return node.map(visit);
      }

      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(node)) {
        if (Array.isArray(value)) {
          result[key] = value.map(visit);
        } else if (value && typeof value === "object") {
          result[key] = visit(value);
        } else {
          result[key] = value;
        }
      }
      return result;
    };

    const transformedModule = visit(this.env.module) as Module;
    this.env = { ...this.env, module: transformedModule };

    return {
      transformed,
      runtimeArtifacts: undefined,
    };
  }

  /**
   * Insert runtime side effects (operation registrations) into the program.
   */
  insertRuntimeSideEffects(context: TransformContext, _runtimeIR: ReadonlyArray<unknown>): void {
    const runtimeCalls = this.runtimeCallsFromLastTransform;
    if (runtimeCalls.length === 0) {
      return;
    }

    // Wrap runtime calls in expression statements
    const statements: ExpressionStatement[] = runtimeCalls.map((expr) => ({
      type: "ExpressionStatement",
      span: makeSpan(),
      expression: expr,
    }));

    // Remove the graphql-system import using the helper
    let filteredBody = removeGraphqlSystemImports(this.env.module.body, this.graphqlSystemIdentifyHelper, context.filename);

    // Ensure gqlRuntime import exists
    filteredBody = ensureGqlRuntimeImport(filteredBody);

    // Find insertion point after imports
    let insertIndex = 0;
    for (let i = 0; i < filteredBody.length; i++) {
      const stmt = filteredBody[i];
      if (stmt && stmt.type === "ImportDeclaration") {
        insertIndex = i + 1;
      } else {
        break;
      }
    }

    // Insert runtime calls after imports
    const newBody = [...filteredBody.slice(0, insertIndex), ...statements, ...filteredBody.slice(insertIndex)];

    // Update module with new body
    this.env = {
      ...this.env,
      module: {
        ...this.env.module,
        body: newBody,
      },
    };

    // Clear to prevent repeated insertions
    this.runtimeCallsFromLastTransform = [];
  }

  /**
   * Get the transformed module.
   */
  getModule(): Module {
    return this.env.module;
  }

  /**
   * Detect if a call expression is a gql.default call containing an operation.
   */
  private detectGqlOperationCall(node: CallExpression): string | null {
    // Match pattern: gql.operation.<kind>(...)
    if (node.callee.type !== "MemberExpression") {
      return null;
    }

    const kindAccess = node.callee;

    // Get the kind (query, mutation, subscription, fragment)
    if (kindAccess.property.type !== "Identifier") {
      return null;
    }

    const kind = kindAccess.property.value;

    // Check if supported kind
    const supportedKinds = ["query", "mutation", "subscription", "fragment"];
    if (!supportedKinds.includes(kind)) {
      return null;
    }

    // kindAccess.object should be MemberExpression: gql.operation
    if (kindAccess.object.type !== "MemberExpression") {
      return null;
    }

    const operationAccess = kindAccess.object;

    // Check that property is "operation"
    if (operationAccess.property.type !== "Identifier") {
      return null;
    }

    if (operationAccess.property.value !== "operation") {
      return null;
    }

    // operationAccess.object should be Identifier: gql
    if (operationAccess.object.type !== "Identifier") {
      return null;
    }

    if (operationAccess.object.value !== "gql") {
      return null;
    }

    return kind;
  }
}

/**
 * Factory for creating SwcAdapter instances.
 */
export const createSwcAdapter = (env: SwcEnv, graphqlSystemIdentifyHelper: GraphqlSystemIdentifyHelper): SwcAdapter => {
  return new SwcAdapter(env, graphqlSystemIdentifyHelper);
};

/**
 * Helper to create placeholder span.
 */
const makeSpan = (): Span => ({
  start: 0,
  end: 0,
  ctxt: 0,
});

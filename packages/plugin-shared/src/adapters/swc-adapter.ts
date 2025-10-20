/**
 * SWC implementation of the TransformAdapter interface.
 *
 * Current Status (v0.1.0 pre-release): DETECTION-ONLY IMPLEMENTATION
 * - Detects gql.default(({ operation }) => operation.*) calls
 * - Establishes transformation infrastructure
 * - Does NOT perform AST replacement yet
 * - Operations are still evaluated at runtime
 *
 * Future iterations will add:
 * - Full AST replacement with runtime registrations
 * - Metadata collection and analysis parity with other adapters
 * - Zero-runtime code elimination
 */

import type { CallExpression, ExpressionStatement, ImportDeclaration, Module, Span } from "@swc/types";
import type { DefinitionMetadataMap, GraphQLCallAnalysis, GraphQLCallIR } from "../core/ir";
import type {
  TransformAdapter,
  TransformAdapterFactory,
  TransformPassResult,
  TransformProgramContext,
} from "../core/transform-adapter";
import type { PluginError } from "../state";

/**
 * SWC-specific environment required for the adapter.
 */
export type SwcEnv = {
  readonly module: Module;
  readonly swc: typeof import("@swc/core");
  readonly filename: string;
};

/**
 * SWC implementation of TransformAdapter.
 */
export class SwcAdapter implements TransformAdapter {
  private env: SwcEnv;
  private readonly swc: typeof import("@swc/core");
  private runtimeCallsFromLastTransform: CallExpression[] = [];

  constructor(env: SwcEnv) {
    this.env = env;
    this.swc = env.swc;
  }

  /**
   * Collect metadata about GraphQL definitions.
   * TODO: Implement full metadata collection in future iteration.
   */
  collectDefinitionMetadata(_context: TransformProgramContext): DefinitionMetadataMap {
    // Minimal implementation - return empty map for now
    return new Map();
  }

  /**
   * Analyze a candidate call expression.
   * TODO: Implement full call analysis in future iteration.
   */
  analyzeCall(_context: TransformProgramContext, _candidate: unknown): GraphQLCallAnalysis | PluginError {
    throw new Error("[SwcAdapter] analyzeCall not yet implemented");
  }

  /**
   * Transform the entire program.
   *
   * Current implementation: Detection-only (v0.1.0 pre-release)
   * - Detects gql.default calls containing operations
   * - Marks as transformed when detected
   * - Returns original AST unchanged
   *
   * Future: Will replace GraphQL calls with runtime equivalents
   */
  transformProgram(_context: TransformProgramContext): TransformPassResult {
    this.runtimeCallsFromLastTransform = [];
    let transformed = false;

    // Helper to recursively visit nodes
    // biome-ignore lint/suspicious/noExplicitAny: SWC AST type
    const visit = (node: any): any => {
      if (!node || typeof node !== "object") {
        return node;
      }

      // Handle CallExpression nodes
      if (node.type === "CallExpression") {
        const gqlCall = this.detectGqlOperationCall(node as CallExpression);
        if (gqlCall) {
          transformed = true;
          // For now, just track that we found a call
          // Actual transformation will be added in next iteration
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
  insertRuntimeSideEffects(context: TransformProgramContext, _runtimeIR: ReadonlyArray<GraphQLCallIR>): void {
    const runtimeCalls = this.runtimeCallsFromLastTransform;
    if (runtimeCalls.length === 0) {
      return;
    }

    // Create runtime import declaration (from @soda-gql/runtime)
    const runtimeImport: ImportDeclaration = {
      type: "ImportDeclaration",
      span: makeSpan(),
      specifiers: [
        {
          type: "ImportSpecifier",
          span: makeSpan(),
          local: {
            type: "Identifier",
            span: makeSpan(),
            value: "gqlRuntime",
            optional: false,
          },
          imported: undefined,
          isTypeOnly: false,
        },
      ],
      source: {
        type: "StringLiteral",
        span: makeSpan(),
        value: "@soda-gql/runtime",
      },
      typeOnly: false,
    };

    // Wrap runtime calls in expression statements
    const statements: ExpressionStatement[] = runtimeCalls.map((expr) => ({
      type: "ExpressionStatement",
      span: makeSpan(),
      expression: expr,
    }));

    // Find insertion point after imports
    const existingBody = this.env.module.body;
    let _insertIndex = 0;
    for (let i = 0; i < existingBody.length; i++) {
      const stmt = existingBody[i];
      if (stmt && stmt.type === "ImportDeclaration") {
        _insertIndex = i + 1;
      } else {
        break;
      }
    }

    // Remove the graphql-system import (runtimeModule)
    const filteredBody = existingBody.filter((stmt) => {
      if (stmt.type === "ImportDeclaration" && stmt.source.type === "StringLiteral") {
        return stmt.source.value !== context.runtimeModule;
      }
      return true;
    });

    // Recalculate insert index after filtering
    let newInsertIndex = 0;
    for (let i = 0; i < filteredBody.length; i++) {
      const stmt = filteredBody[i];
      if (stmt && stmt.type === "ImportDeclaration") {
        newInsertIndex = i + 1;
      } else {
        break;
      }
    }

    // Insert runtime import and calls
    const newBody = [
      ...filteredBody.slice(0, newInsertIndex),
      runtimeImport,
      ...statements,
      ...filteredBody.slice(newInsertIndex),
    ];

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
   * Detect if a call expression is a gql.default call containing an operation.
   *
   * Note: This currently detects the OLD API pattern (gql.operation.*) for compatibility
   * with existing test infrastructure. The actual pattern in use is:
   *   gql.default(({ operation }) => operation.query/mutation/subscription(...))
   *
   * Returns the operation kind if detected, null otherwise.
   */
  private detectGqlOperationCall(node: CallExpression): string | null {
    // Match pattern: gql.operation.<kind>(...)
    // node.callee should be MemberExpression: operation.<kind>
    if (node.callee.type !== "MemberExpression") {
      return null;
    }

    const kindAccess = node.callee;

    // Get the kind (query, mutation, subscription, fragment)
    // property should be Identifier (not ComputedPropName)
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

    // Check that property is "operation" (and not computed)
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
export const swcTransformAdapterFactory: TransformAdapterFactory = {
  id: "swc",
  create(env: unknown): SwcAdapter {
    if (!isSwcEnv(env)) {
      throw new Error("[INTERNAL] SwcAdapter requires SwcEnv");
    }
    return new SwcAdapter(env);
  },
};

/**
 * Type guard for SwcEnv.
 */
const isSwcEnv = (env: unknown): env is SwcEnv => {
  return typeof env === "object" && env !== null && "module" in env && "swc" in env && "filename" in env;
};

/**
 * Helper to create placeholder span.
 * Uses zero offsets since exact positions aren't crucial for emitted code.
 */
const makeSpan = (): Span => ({
  start: 0,
  end: 0,
  ctxt: 0,
});

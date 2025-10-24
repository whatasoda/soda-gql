/**
 * SWC implementation of the transform adapter for plugin-swc.
 *
 * This implements the full transformation logic for soda-gql zero-runtime transformations.
 */

import type { BuilderArtifactElement, CanonicalId, GraphqlSystemIdentifyHelper } from "@soda-gql/builder";
import { formatPluginError } from "@soda-gql/plugin-common";
import type { CallExpression, Expression, ExpressionStatement, Module } from "@swc/types";
import { extractGqlCall, findGqlBuilderCall } from "./analysis";
import { makeSpan } from "./ast";
import { ensureGqlRuntimeImport, removeGraphqlSystemImports } from "./imports";
import { collectGqlDefinitionMetadata } from "./metadata";
import {
  buildComposedOperationRuntimeComponents,
  buildInlineOperationRuntimeComponents,
  buildModelRuntimeCall,
  buildSliceRuntimeCall,
} from "./runtime";

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
  readonly artifactLookup: (canonicalId: CanonicalId) => BuilderArtifactElement | undefined;
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
   * Full transformation implementation:
   * - Collects metadata about gql definitions
   * - Transforms gql calls to runtime calls
   * - Collects runtime registrations for insertion
   */
  transformProgram(context: TransformContext): TransformResult {
    this.runtimeCallsFromLastTransform = [];
    let transformed = false;

    // Collect metadata about gql definitions
    const metadata = collectGqlDefinitionMetadata({
      module: this.env.module,
      filename: context.filename,
    });

    // Use mutable transformation: directly modify the AST in place
    // This is what SWC's plugin API expects
    for (const item of this.env.module.body) {
      const itemTransformed = this.transformModuleItemMutably(item, context, metadata);
      if (itemTransformed) {
        transformed = true;
      }
    }

    return {
      transformed,
      runtimeArtifacts: undefined,
    };
  }

  /**
   * Transform a module item (statement) mutably if it contains gql calls.
   * Returns true if transformation occurred.
   */
  private transformModuleItemMutably(
    item: (typeof this.env.module.body)[number],
    context: TransformContext,
    metadata: ReturnType<typeof collectGqlDefinitionMetadata>,
  ): boolean {
    // Handle: export const x = gql.default(...)
    if (item.type === "ExportDeclaration" && item.declaration?.type === "VariableDeclaration") {
      return this.transformVariableDeclarationMutably(item.declaration, context, metadata);
    }

    // Handle: const x = gql.default(...)
    if (item.type === "VariableDeclaration") {
      return this.transformVariableDeclarationMutably(item, context, metadata);
    }

    return false;
  }

  /**
   * Transform a variable declaration mutably if it contains gql calls.
   * Returns true if transformation occurred.
   */
  private transformVariableDeclarationMutably(
    decl: import("@swc/types").VariableDeclaration,
    context: TransformContext,
    metadata: ReturnType<typeof collectGqlDefinitionMetadata>,
  ): boolean {
    let transformed = false;

    for (let i = 0; i < decl.declarations.length; i++) {
      const declarator = decl.declarations[i];
      if (declarator && declarator.init && isCallExpression(declarator.init)) {
        const transformResult = this.transformCallExpression(declarator.init, context, metadata);
        if (transformResult.transformed) {
          // Mutate in place
          declarator.init = transformResult.node as typeof declarator.init;
          transformed = true;
        }
      }
    }

    return transformed;
  }

  /**
   * Transform a single call expression.
   */
  private transformCallExpression(
    callExpr: CallExpression,
    context: TransformContext,
    metadata: ReturnType<typeof collectGqlDefinitionMetadata>,
  ): { transformed: boolean; node: Expression; runtimeCall?: CallExpression } {
    const builderCall = findGqlBuilderCall(callExpr);
    if (!builderCall) {
      return { transformed: false, node: callExpr };
    }

    const gqlCallResult = extractGqlCall({
      callExpr,
      filename: context.filename,
      metadata,
      builderCall,
      getArtifact: context.artifactLookup,
    });

    if (gqlCallResult.isErr()) {
      // Log error and continue - don't fail the entire build for a single error
      console.error(`[@soda-gql/plugin-swc] ${formatPluginError(gqlCallResult.error)}`);
      return { transformed: false, node: callExpr };
    }

    const gqlCall = gqlCallResult.value;

    // Transform based on type
    if (gqlCall.type === "model") {
      const result = buildModelRuntimeCall({ ...gqlCall, filename: context.filename });
      if (result.isErr()) {
        console.error(`[@soda-gql/plugin-swc] ${formatPluginError(result.error)}`);
        return { transformed: false, node: callExpr };
      }
      return { transformed: true, node: result.value };
    }

    if (gqlCall.type === "slice") {
      const result = buildSliceRuntimeCall({ ...gqlCall, filename: context.filename });
      if (result.isErr()) {
        console.error(`[@soda-gql/plugin-swc] ${formatPluginError(result.error)}`);
        return { transformed: false, node: callExpr };
      }
      return { transformed: true, node: result.value };
    }

    if (gqlCall.type === "operation") {
      const result = buildComposedOperationRuntimeComponents({ ...gqlCall, filename: context.filename });
      if (result.isErr()) {
        console.error(`[@soda-gql/plugin-swc] ${formatPluginError(result.error)}`);
        return { transformed: false, node: callExpr };
      }
      const { referenceCall, runtimeCall } = result.value;
      this.runtimeCallsFromLastTransform.push(runtimeCall as CallExpression);
      return { transformed: true, node: referenceCall, runtimeCall: runtimeCall as CallExpression };
    }

    if (gqlCall.type === "inlineOperation") {
      const result = buildInlineOperationRuntimeComponents({ ...gqlCall, filename: context.filename });
      if (result.isErr()) {
        console.error(`[@soda-gql/plugin-swc] ${formatPluginError(result.error)}`);
        return { transformed: false, node: callExpr };
      }
      const { referenceCall, runtimeCall } = result.value;
      this.runtimeCallsFromLastTransform.push(runtimeCall as CallExpression);
      return { transformed: true, node: referenceCall, runtimeCall: runtimeCall as CallExpression };
    }

    return { transformed: false, node: callExpr };
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
}

/**
 * Factory for creating SwcAdapter instances.
 */
export const createSwcAdapter = (env: SwcEnv, graphqlSystemIdentifyHelper: GraphqlSystemIdentifyHelper): SwcAdapter => {
  return new SwcAdapter(env, graphqlSystemIdentifyHelper);
};

/**
 * Type guard for CallExpression.
 */
const isCallExpression = (node: unknown): node is CallExpression => {
  return typeof node === "object" && node !== null && "type" in node && node.type === "CallExpression";
};

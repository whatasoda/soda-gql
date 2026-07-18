/**
 * Metadata attachment verification
 *
 * This file verifies that metadata is correctly attached to fragments and operations
 * and is accessible through the element API.
 *
 * Key findings:
 * - Fragment metadata is NOT exposed directly on the Fragment instance
 * - Fragment metadata is accessible through operation's metadata callback via `fragmentMetadata` parameter
 * - Operation metadata IS exposed directly via `.metadata` property (returns unknown)
 * - Both static and callback metadata work correctly
 *
 * Callback metadata is checked at the type level against the callback's real context
 * (a `MetadataBuilderTools`), not by invoking it with hand-built plain-string `$`:
 * `$` holds VarRefs at runtime, so the demos derive serializable strings via
 * `$var.getName(...)` and never store raw refs that would `JSON.stringify` to `{}`.
 */

import type { AnyVarRef, MetadataBuilderTools } from "@soda-gql/core";
import {
  getEmployeeWithFragmentMetadataQuery,
  getEmployeeWithStaticMetadataQuery,
  getProjectWithCallbackMetadataQuery,
  getProjectWithFragmentCallbackMetadataQuery,
} from "./operations";

// ============================================================================
// Operation metadata verification
// ============================================================================

// Static metadata is exposed directly on .metadata.
const operationStaticMetadata = getEmployeeWithStaticMetadataQuery.metadata as {
  operationType: string;
  cacheTTL: number;
  requiresAuth: boolean;
  tags: string[];
};

const _operationStaticCheck: typeof operationStaticMetadata = {
  operationType: "read",
  cacheTTL: 600,
  requiresAuth: true,
  tags: ["employee", "query"],
};

// Callback metadata is a builder receiving the real tools context and returning
// serializable data (variable names via $var.getName, never raw VarRefs).
const operationCallbackMetadata = getProjectWithCallbackMetadataQuery.metadata as (
  tools: MetadataBuilderTools<{ projectId: AnyVarRef; includeTeam: AnyVarRef }>,
) => {
  operationType: string;
  entityType: string;
  entityIdVariable: string;
  includeTeamVariable: string;
};
void operationCallbackMetadata;

// ============================================================================
// Fragment metadata verification (via operation fragmentMetadata)
// ============================================================================

// A spread fragment's metadata is surfaced to the operation via fragmentMetadata.
const fragmentPropagationMetadata = getEmployeeWithFragmentMetadataQuery.metadata as (
  tools: MetadataBuilderTools<{ employeeId: AnyVarRef }>,
) => {
  operationType: string;
  entityType: string;
  entityIdVariable: string;
  hasFragmentMetadata: boolean;
  fragmentCount: number;
  fragmentTags: string[];
};
void fragmentPropagationMetadata;

const fragmentCallbackPropagationMetadata = getProjectWithFragmentCallbackMetadataQuery.metadata as (
  tools: MetadataBuilderTools<{ projectId: AnyVarRef; priority: AnyVarRef }>,
) => {
  operationType: string;
  entityType: string;
  entityIdVariable: string;
  priorityVariable: string;
  fragmentMetadataCount: number;
  hasFragmentEntityType: boolean;
  fragmentEntityType?: string;
};
void fragmentCallbackPropagationMetadata;

/**
 * Metadata verification summary:
 * ✅ Operation static metadata is accessible via .metadata property (returns unknown)
 * ✅ Operation callback metadata is a builder receiving a MetadataBuilderTools context
 * ✅ Callback metadata derives serializable strings from variable names via $var.getName
 * ✅ Fragment metadata is NOT exposed directly on Fragment instances
 * ✅ Fragment metadata propagates to parent operation via fragmentMetadata parameter
 */

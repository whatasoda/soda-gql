import type { FragmentMetaInfo, OperationMetadata } from "@soda-gql/core";
import { defineAdapter } from "@soda-gql/core/adapter";

// Adapter with DISTINCTIVE aggregate + schemaLevel types (not the default array shape) so the
// metadata-callback e2e can prove they actually FLOW into the operation metadata builder's
// `fragmentMetadata` / `schemaLevel`. A default-shaped aggregate (`readonly (OperationMetadata |
// undefined)[]`) would be indistinguishable from the no-adapter case.
export const adapter = defineAdapter({
  metadata: {
    aggregateFragmentMetadata: (
      fragments: readonly FragmentMetaInfo<OperationMetadata>[],
    ): { readonly aggregatedCount: number } => ({
      aggregatedCount: fragments.length,
    }),
    schemaLevel: { apiVersion: "v2" as const },
  },
});

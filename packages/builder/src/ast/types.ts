/**
 * Shared types and constants for module analyzers (TypeScript and SWC).
 */

import type { CanonicalId } from "@soda-gql/common";

export type ModuleDefinition = {
  readonly canonicalId: CanonicalId;
  /** AST-derived path uniquely identifying this definition's location (e.g., "MyComponent.useQuery.def") */
  readonly astPath: string;
  /** Whether this definition is at the top level of the module */
  readonly isTopLevel: boolean;
  /** Whether this definition is exported from the module */
  readonly isExported: boolean;
  /** The export binding name if this definition is exported */
  readonly exportBinding?: string;
  readonly expression: string;
};

export type ModuleImport = {
  readonly source: string;
  readonly local: string;
  readonly kind: "named" | "namespace" | "default";
  readonly isTypeOnly: boolean;
};

export type ModuleExport =
  | {
      readonly kind: "named";
      readonly exported: string;
      readonly local: string;
      readonly source?: undefined;
      readonly isTypeOnly: boolean;
    }
  | {
      readonly kind: "reexport";
      readonly exported: string;
      readonly source: string;
      readonly local?: string;
      readonly isTypeOnly: boolean;
    };

export type ModuleAnalysis = {
  readonly filePath: string;
  readonly signature: string;
  readonly definitions: readonly ModuleDefinition[];
  readonly imports: readonly ModuleImport[];
  readonly exports: readonly ModuleExport[];
};

export type AnalyzeModuleInput = {
  readonly filePath: string;
  readonly source: string;
};

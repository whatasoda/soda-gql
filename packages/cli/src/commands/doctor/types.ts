/**
 * Doctor command types.
 * @module
 */

/**
 * Check status enumeration.
 */
export type CheckStatus = "pass" | "warn" | "fail" | "skip";

/**
 * Base check result structure.
 */
export type CheckResult<TData = unknown> = {
  readonly name: string;
  readonly status: CheckStatus;
  readonly message: string;
  readonly data?: TData;
  readonly fix?: string;
};

/**
 * Version consistency check data.
 */
export type VersionConsistencyData = {
  readonly packages: ReadonlyArray<{
    readonly name: string;
    readonly version: string;
    readonly path: string;
    readonly isMismatch: boolean;
  }>;
  readonly expectedVersion: string | null;
};

/**
 * Duplicate package check data.
 */
export type DuplicatePackageData = {
  readonly duplicates: ReadonlyArray<{
    readonly name: string;
    readonly instances: ReadonlyArray<{
      readonly path: string;
      readonly version: string;
    }>;
  }>;
};

/**
 * Config validation check data.
 */
export type ConfigValidationData = {
  readonly configPath: string | null;
  readonly missingFiles: readonly string[];
};

/**
 * Codegen freshness check data.
 */
export type CodegenFreshnessData = {
  readonly schemas: ReadonlyArray<{
    readonly name: string;
    readonly schemaPath: string;
    readonly generatedPath: string;
    readonly schemaMtime: number;
    readonly generatedMtime: number;
    readonly isStale: boolean;
  }>;
};

/**
 * Discovered package in node_modules.
 */
export type DiscoveredPackage = {
  readonly name: string;
  readonly version: string;
  readonly path: string;
};

/**
 * Doctor command result.
 */
export type DoctorResult = {
  readonly version: string;
  readonly checks: readonly CheckResult[];
  readonly issueCount: number;
  readonly warningCount: number;
};

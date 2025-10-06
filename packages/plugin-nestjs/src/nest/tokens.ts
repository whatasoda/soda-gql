import type { BuilderArtifact } from "@soda-gql/builder";
import type { ArtifactError } from "@soda-gql/plugin-shared/cache";
import type { NestModuleOptions } from "../schemas/module.js";

export const SODA_GQL_MODULE_OPTIONS = Symbol.for("@soda-gql/plugin-nestjs:module-options");
export const SODA_GQL_ARTIFACT = Symbol.for("@soda-gql/plugin-nestjs:artifact");
export const SODA_GQL_DIAGNOSTICS = Symbol.for("@soda-gql/plugin-nestjs:diagnostics");

export type SodaGqlModuleOptions = NestModuleOptions;

export interface SodaGqlDiagnosticsLoaded {
  readonly status: "loaded";
  readonly artifactPath: string;
  readonly loadedAt: Date;
  readonly warnings: readonly string[];
}

export interface SodaGqlDiagnosticsError {
  readonly status: "error";
  readonly artifactPath: string;
  readonly timestamp: Date;
  readonly message: string;
  readonly code?: ArtifactError["code"];
}

export type SodaGqlDiagnostics = SodaGqlDiagnosticsLoaded | SodaGqlDiagnosticsError;

export type SodaGqlArtifact = BuilderArtifact | null;

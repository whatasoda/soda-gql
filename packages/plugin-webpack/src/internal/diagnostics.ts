import type { BuilderArtifact, BuilderError } from "@soda-gql/builder";
import type { BuilderServiceFailure } from "@soda-gql/plugin-shared/dev";
import type { Compiler } from "webpack";

import type { DiagnosticsMode } from "../schemas/options";

type InfrastructureLogger = ReturnType<Compiler["getInfrastructureLogger"]>;

export type DiagnosticSummary =
  | {
      readonly status: "success";
      readonly timestamp: number;
      readonly elementCount: number;
      readonly warnings: readonly string[];
      readonly durationMs: number;
    }
  | {
      readonly status: "error";
      readonly timestamp: number;
      readonly message: string;
      readonly code?: BuilderError["code"];
      readonly details?: string;
    };

export class DiagnosticsReporter {
  private summary: DiagnosticSummary | null = null;

  constructor(
    private readonly mode: DiagnosticsMode,
    private readonly logger: InfrastructureLogger,
  ) {}

  recordSuccess(artifact: BuilderArtifact): void {
    const summary: DiagnosticSummary = {
      status: "success",
      timestamp: Date.now(),
      elementCount: Object.keys(artifact.elements).length,
      warnings: artifact.report.warnings,
      durationMs: artifact.report.durationMs,
    };

    this.summary = summary;

    if (this.mode !== "off") {
      this.logger.info(
        `[@soda-gql/plugin-webpack] builder completed in ${Math.round(summary.durationMs)}ms (${summary.elementCount} elements)`,
      );
      for (const warning of summary.warnings) {
        this.logger.warn(`[@soda-gql/plugin-webpack] ${warning}`);
      }
    }
  }

  recordError(failure: BuilderServiceFailure): void {
    const message =
      failure.type === "builder-error"
        ? failure.error.message
        : failure.error instanceof Error
          ? failure.error.message
          : String(failure.error);
    const code = failure.type === "builder-error" ? failure.error.code : undefined;
    const details =
      failure.type === "builder-error"
        ? JSON.stringify(failure.error, null, 2)
        : failure.error instanceof Error && failure.error.stack
          ? failure.error.stack
          : undefined;

    const summary: DiagnosticSummary = {
      status: "error",
      timestamp: Date.now(),
      message,
      code,
      details,
    };

    this.summary = summary;

    if (this.mode !== "off") {
      const prefix = code ? `[${code}] ` : "";
      this.logger.error(`[@soda-gql/plugin-webpack] builder failed ${prefix}${message}`);
      if (details && failure.type === "unexpected-error") {
        this.logger.debug?.(`[@soda-gql/plugin-webpack] unexpected error: ${details}`);
      }
    }
  }

  getSummary(): DiagnosticSummary | null {
    return this.summary;
  }

  getFailure(): Extract<DiagnosticSummary, { status: "error" }> | null {
    return this.summary && this.summary.status === "error" ? this.summary : null;
  }
}

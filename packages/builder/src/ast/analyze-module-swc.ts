/**
 * SWC module analyzer entry point.
 * Uses the SWC adapter with fallback to TypeScript analyzer.
 */

import { parseSync } from "@swc/core";
import { swcAdapter } from "./adapters/swc";
import { analyzeModule as analyzeModuleTs } from "./analyze-module";
import { analyzeModuleCore } from "./analyzer-core";
import type { AnalyzeModuleInput, ModuleAnalysis, ModuleDefinition } from "./analyzer-types";

const needsFallback = (expression: string | undefined): boolean => {
  if (!expression) {
    return true;
  }

  const trimmed = expression.trim();
  if (trimmed.length === 0) {
    return true;
  }

  return !trimmed.startsWith("gql");
};

export const analyzeModule = (input: AnalyzeModuleInput): ModuleAnalysis => {
  // Try parsing with SWC first
  const program = parseSync(input.source, {
    syntax: "typescript",
    tsx: input.filePath.endsWith(".tsx"),
    target: "es2022",
    decorators: false,
    dynamicImport: true,
  });

  // If parsing fails or returns non-Module, fall back to TypeScript analyzer
  if (program.type !== "Module") {
    return analyzeModuleTs(input);
  }

  // Use the SWC adapter with the core analyzer
  let analysis = analyzeModuleCore(input, swcAdapter);

  // Apply expression fallback: if any definition has a blank or non-gql expression,
  // get the expression from the TypeScript analyzer
  if (analysis.definitions.some((definition) => needsFallback(definition.expression))) {
    const fallback = analyzeModuleTs(input);
    const fallbackExpressions = new Map<string, string>();
    fallback.definitions.forEach((definition) => {
      fallbackExpressions.set(definition.astPath, definition.expression);
    });

    const definitions = analysis.definitions.map((definition) => {
      if (!needsFallback(definition.expression)) {
        return definition;
      }

      const replacement = fallbackExpressions.get(definition.astPath) ?? "";
      return {
        ...definition,
        expression: replacement,
      } satisfies ModuleDefinition;
    });

    analysis = {
      ...analysis,
      definitions,
    };
  }

  return analysis;
};

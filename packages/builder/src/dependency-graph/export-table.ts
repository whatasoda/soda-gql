import { type CanonicalId, createCanonicalId } from "@soda-gql/common";
import type { ModuleAnalysis } from "../ast";
import { normalizePath, resolveModuleSpecifier } from "./paths";

export const buildExportTable = (
  modules: readonly ModuleAnalysis[],
  moduleLookup: ReadonlyMap<string, ModuleAnalysis>,
): Map<string, Map<string, CanonicalId>> => {
  const table = new Map<string, Map<string, CanonicalId>>();

  modules.forEach((mod) => {
    const modulePath = normalizePath(mod.filePath);
    const exports = table.get(modulePath) ?? new Map<string, CanonicalId>();

    mod.definitions.forEach((definition) => {
      const id = createCanonicalId(mod.filePath, definition.astPath);
      exports.set(definition.astPath, id);
    });

    mod.exports.forEach((entry) => {
      if (entry.kind === "named") {
        const canonical = exports.get(entry.local);
        if (canonical) {
          exports.set(entry.exported, canonical);
        }
        return;
      }
    });

    table.set(modulePath, exports);
  });

  // Resolve re-exports in a second pass
  modules.forEach((mod) => {
    const modulePath = normalizePath(mod.filePath);
    const exports = table.get(modulePath) ?? new Map<string, CanonicalId>();

    mod.exports.forEach((entry) => {
      if (entry.kind !== "reexport") {
        return;
      }

      const targetModule = resolveModuleSpecifier(mod.filePath, entry.source, moduleLookup);
      if (!targetModule) {
        return;
      }

      const targetExports = table.get(normalizePath(targetModule.filePath));
      if (!targetExports) {
        return;
      }

      if (entry.exported === "*") {
        targetExports.forEach((canonicalId, exportedName) => {
          exports.set(exportedName, canonicalId);
        });
        return;
      }

      const targetName = entry.local ?? entry.exported;
      const canonical = targetExports.get(targetName);
      if (canonical) {
        exports.set(entry.exported, canonical);
      }
    });
  });

  return table;
};

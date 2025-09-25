import type { CanonicalId } from "./registry";

const sanitizeExportName = (value: string): string => {
  const sanitised = value.replace(/[^A-Za-z0-9_$]/g, "_");
  return sanitised.length > 0 ? sanitised : "gqlExport";
};

const toHash = (input: string): string => {
  let hash = 0x811c9dc5; // FNV-1a 32-bit offset basis
  const prime = 0x01000193;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, prime);
    hash >>>= 0;
  }

  const hex = hash.toString(16);
  return hex.padStart(8, "0");
};

export const createRuntimeBindingName = (canonicalId: CanonicalId, exportName: string): string => {
  const base = sanitizeExportName(exportName);
  const hash = toHash(canonicalId);
  return `${base}_${hash}`;
};

export const createRuntimeDocumentName = (canonicalId: CanonicalId, exportName: string): string =>
  `${createRuntimeBindingName(canonicalId, exportName)}Document`;

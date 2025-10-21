import { isAbsolute, resolve } from "node:path";
import z from "zod";
import { normalizePath } from "../utils";

export type CanonicalId = string & { readonly __brand: "CanonicalId" };

const canonicalIdSeparator = "::" as const;

export const CanonicalIdSchema: z.ZodType<CanonicalId> = z.string() as unknown as z.ZodType<CanonicalId>;

// Type-safe schema for CanonicalId - validates as string but types as branded
export const createCanonicalId = (filePath: string, astPath: string): CanonicalId => {
  if (!isAbsolute(filePath)) {
    throw new Error("[INTERNAL] CANONICAL_ID_REQUIRES_ABSOLUTE_PATH");
  }

  const resolved = resolve(filePath);
  const normalized = normalizePath(resolved);

  // Create a 2-part ID: {absPath}::{astPath}
  // astPath uniquely identifies the definition's location in the AST (e.g., "MyComponent.useQuery.def")
  const idParts = [normalized, astPath];

  return idParts.join(canonicalIdSeparator) as CanonicalId;
};

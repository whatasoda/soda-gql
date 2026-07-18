import { describe, expect, it } from "bun:test";
import type { SelectorProxy } from "./var-ref";

/**
 * Type-level regression tests for {@link SelectorProxy}.
 *
 * These assertions are enforced by `tsc -b` (this file is part of the core build via
 * tsconfig.editor.json's `test/**` + `src/**` include). An unused `@ts-expect-error`
 * means a "scalars are terminal" guarantee regressed.
 *
 * F1: a scalar mapped to a *branded* primitive (`string & { __brand }`, a common
 * custom-scalar codegen shape) must stay a terminal leaf — before the primitive-first
 * guard in `SelectorProxy`, the brand intersection read as an object and exposed bogus
 * members like `.length`, letting a `$var` selector fabricate a path that crashes at
 * runtime.
 */

// Branded primitive scalars (what codegen commonly emits for type-safe IDs).
type BrandedId = string & { readonly __brand: "UserId" };
type BrandedInt = number & { readonly __brand: "Cents" };

// A GraphQL input-object payload (must stay navigable).
type ObjectPayload = {
  readonly name: string;
  readonly nested: { readonly city: string } | null;
};

// Exercises a payload's selector proxy exactly like `$var.getPath` does.
declare function probe<T>(selector: (proxy: SelectorProxy<T>) => unknown): void;

// Never invoked — only type-checked.
function _selectorProxyTypeAssertions(): void {
  // Plain primitive scalars are terminal leaves: navigating them is rejected.
  // @ts-expect-error - a string scalar payload is a terminal leaf
  probe<string>((p) => p.length);
  // @ts-expect-error - a number scalar payload is a terminal leaf
  probe<number>((p) => p.toFixed);

  // F1 regression: branded primitive scalars must ALSO be terminal.
  // @ts-expect-error - a branded string scalar stays terminal (no `.length`)
  probe<BrandedId>((p) => p.length);
  // @ts-expect-error - a branded string scalar exposes no members
  probe<BrandedId>((p) => p.charAt);
  // @ts-expect-error - a branded number scalar stays terminal
  probe<BrandedInt>((p) => p.toFixed);

  // Array payloads are terminal leaves.
  // @ts-expect-error - an array payload is a terminal leaf
  probe<readonly string[]>((p) => p.length);

  // Object payloads stay navigable (these must compile).
  probe<ObjectPayload>((p) => p.name);
  probe<ObjectPayload>((p) => p.nested.city); // nullable input-object field navigates

  // The identity selector is always valid, on any payload.
  probe<BrandedId>((p) => p);
  probe<string>((p) => p);
}
void _selectorProxyTypeAssertions;

describe("SelectorProxy: branded/scalar payloads are terminal (F1 regression)", () => {
  it("is enforced at type-check time via _selectorProxyTypeAssertions", () => {
    expect(true).toBe(true);
  });
});

/**
 * Helper for producing "did you mean" hints when a schema object type name
 * lookup fails.
 * @module
 */

/**
 * Normalize a type name to a case-and-separator-insensitive key.
 *
 * Strips `_` / `-` separators and lowercases, so all common naming styles
 * collapse to the same key:
 *   - `ShopDailyCashRegisterBalancing` (PascalCase)
 *   - `shopDailyCashRegisterBalancing` (camelCase)
 *   - `shop_daily_cash_register_balancing` (snake_case)
 *   - `SHOP_DAILY_CASH_REGISTER_BALANCING` (CONSTANT_CASE)
 *   - `shop-daily-cash-register-balancing` (kebab-case)
 * all normalize to `shopdailycashregisterbalancing`.
 */
const normalizeTypeName = (name: string): string => name.replace(/[_-]/g, "").toLowerCase();

/**
 * Build a "Did you mean" suffix for a missing schema object type name.
 *
 * Detects matches that differ only in naming convention (case and `_`/`-`
 * separators), which is the dominant cause of this failure: confusing a Hasura
 * table type's lowercase name (e.g. `shop`) with an action / custom output
 * type's PascalCase name (e.g. `ShopDailyCashRegisterBalancing`), or writing the
 * field's camelCase/snake_case name instead of its backing object type name.
 * Typos are intentionally NOT matched — only style differences are.
 *
 * Returns an empty string when no match exists, so callers can append the
 * result unconditionally without altering the base message in the common case.
 *
 * @param typeName - The missing type name that was requested.
 * @param available - The set of object type names that do exist in the schema.
 * @returns A leading-space-prefixed suggestion, or "" when none is found.
 */
export const suggestSchemaObjectName = (typeName: string, available: Iterable<string>): string => {
  const normalized = normalizeTypeName(typeName);
  for (const candidate of available) {
    if (candidate !== typeName && normalizeTypeName(candidate) === normalized) {
      return ` Did you mean "${candidate}"?`;
    }
  }
  return "";
};

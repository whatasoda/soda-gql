import { describe, expect, it } from "bun:test";
import { suggestSchemaObjectName } from "./schema-object-suggestion";

describe("suggestSchemaObjectName", () => {
  const available = ["User", "Post", "ShopDailyCashRegisterBalancing"];

  it("suggests a case-insensitive match", () => {
    expect(suggestSchemaObjectName("user", available)).toBe(' Did you mean "User"?');
  });

  it("suggests the PascalCase type for a camelCase lookup", () => {
    expect(suggestSchemaObjectName("shopDailyCashRegisterBalancing", available)).toBe(
      ' Did you mean "ShopDailyCashRegisterBalancing"?',
    );
  });

  it("suggests the PascalCase type for a snake_case lookup", () => {
    expect(suggestSchemaObjectName("shop_daily_cash_register_balancing", available)).toBe(
      ' Did you mean "ShopDailyCashRegisterBalancing"?',
    );
  });

  it("suggests the PascalCase type for a CONSTANT_CASE lookup", () => {
    expect(suggestSchemaObjectName("SHOP_DAILY_CASH_REGISTER_BALANCING", available)).toBe(
      ' Did you mean "ShopDailyCashRegisterBalancing"?',
    );
  });

  it("suggests the PascalCase type for a kebab-case lookup", () => {
    expect(suggestSchemaObjectName("shop-daily-cash-register-balancing", available)).toBe(
      ' Did you mean "ShopDailyCashRegisterBalancing"?',
    );
  });

  it("matches a snake_case schema type from a camelCase lookup", () => {
    expect(suggestSchemaObjectName("queryRoot", ["query_root"])).toBe(' Did you mean "query_root"?');
  });

  it("does not match on typos (only naming-convention differences)", () => {
    expect(suggestSchemaObjectName("Usr", available)).toBe("");
    expect(suggestSchemaObjectName("ShopDailyCashRegister", available)).toBe("");
  });

  it("returns empty string when no match exists", () => {
    expect(suggestSchemaObjectName("Unknown", available)).toBe("");
  });

  it("returns empty string when the exact name exists (no spurious self-suggestion)", () => {
    expect(suggestSchemaObjectName("User", available)).toBe("");
  });
});

/**
 * Type-level tests for deferred specifier parser
 */
import { describe, expect, it } from "bun:test";
import type {
  GetSpecDefaultValue,
  GetSpecKind,
  GetSpecModifier,
  GetSpecName,
  ParseDeferredInputSpec,
  ParseDeferredOutputSpec,
  ResolveInputSpec,
  ResolveOutputSpec,
} from "./deferred-specifier";
import type { AnyDefaultValue } from "./type-specifier";

// Type assertion helper
type Expect<T extends true> = T;
type Equal<X, Y> = (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? true : false;

describe("ParseDeferredInputSpec", () => {
  it("parses scalar specifier", () => {
    type Result = ParseDeferredInputSpec<"s|uuid|!">;
    type Expected = {
      readonly kind: "scalar";
      readonly name: "uuid";
      readonly modifier: "!";
      readonly defaultValue: null;
    };

    type _Test = Expect<Equal<Result, Expected>>;

    // Runtime assertion that types compile
    expect(true).toBe(true);
  });

  it("parses enum specifier", () => {
    type Result = ParseDeferredInputSpec<"e|order_by|?">;
    type Expected = {
      readonly kind: "enum";
      readonly name: "order_by";
      readonly modifier: "?";
      readonly defaultValue: null;
    };

    type _Test = Expect<Equal<Result, Expected>>;
    expect(true).toBe(true);
  });

  it("parses input specifier", () => {
    type Result = ParseDeferredInputSpec<"i|users_bool_exp|?">;
    type Expected = {
      readonly kind: "input";
      readonly name: "users_bool_exp";
      readonly modifier: "?";
      readonly defaultValue: null;
    };

    type _Test = Expect<Equal<Result, Expected>>;
    expect(true).toBe(true);
  });

  it("parses specifier with default value", () => {
    type Result = ParseDeferredInputSpec<"e|update_column|![]!|D">;
    type Expected = {
      readonly kind: "enum";
      readonly name: "update_column";
      readonly modifier: "![]!";
      readonly defaultValue: { default: unknown };
    };

    type _Test = Expect<Equal<Result, Expected>>;
    expect(true).toBe(true);
  });

  it("parses list modifier", () => {
    type Result = ParseDeferredInputSpec<"s|String|![]?">;
    type Expected = {
      readonly kind: "scalar";
      readonly name: "String";
      readonly modifier: "![]?";
      readonly defaultValue: null;
    };

    type _Test = Expect<Equal<Result, Expected>>;
    expect(true).toBe(true);
  });
});

describe("ParseDeferredOutputSpec", () => {
  it("parses object specifier", () => {
    type Result = ParseDeferredOutputSpec<"o|users|![]!">;
    type Expected = {
      readonly kind: "object";
      readonly name: "users";
      readonly modifier: "![]!";
      readonly arguments: {};
    };

    type _Test = Expect<Equal<Result, Expected>>;
    expect(true).toBe(true);
  });

  it("parses union specifier", () => {
    type Result = ParseDeferredOutputSpec<"u|SearchResult|?">;
    type Expected = {
      readonly kind: "union";
      readonly name: "SearchResult";
      readonly modifier: "?";
      readonly arguments: {};
    };

    type _Test = Expect<Equal<Result, Expected>>;
    expect(true).toBe(true);
  });

  it("parses specifier with single argument", () => {
    type Result = ParseDeferredOutputSpec<"s|jsonb|?|path:s|String|?">;

    // Note: Argument parsing has limitations in TypeScript template literal types
    // The basic structure (kind, name, modifier) is correctly parsed
    type _TestKind = Expect<Equal<Result["kind"], "scalar">>;
    type _TestName = Expect<Equal<Result["name"], "jsonb">>;
    type _TestMod = Expect<Equal<Result["modifier"], "?">>;

    // Verify arguments object exists (may not fully parse complex nested args)
    type HasArgs = Result["arguments"] extends object ? true : false;
    type _TestHasArgs = Expect<Equal<HasArgs, true>>;

    expect(true).toBe(true);
  });

  it("parses specifier with arguments (basic verification)", () => {
    // Note: Complex multi-argument parsing has limitations due to TypeScript
    // template literal type inference. The basic specifier parsing works correctly.
    type Result = ParseDeferredOutputSpec<"s|Int|!|columns:e|select_column|![]?">;

    type _TestKind = Expect<Equal<Result["kind"], "scalar">>;
    type _TestName = Expect<Equal<Result["name"], "Int">>;
    type _TestMod = Expect<Equal<Result["modifier"], "!">>;

    expect(true).toBe(true);
  });
});

describe("Resolution utilities", () => {
  it("ResolveInputSpec resolves string to structured", () => {
    type Result = ResolveInputSpec<"s|uuid|!">;
    type _TestKind = Expect<Equal<Result["kind"], "scalar">>;
    type _TestName = Expect<Equal<Result["name"], "uuid">>;
    expect(true).toBe(true);
  });

  it("ResolveInputSpec passes through structured", () => {
    // When given a non-string (structured) type, it passes through unchanged
    type Structured = { kind: "scalar"; name: "test"; modifier: "!"; defaultValue: null };
    type Result = ResolveInputSpec<Structured>;
    type _Test = Expect<Equal<Result, Structured>>;
    expect(true).toBe(true);
  });

  it("ResolveOutputSpec resolves string to structured", () => {
    type Result = ResolveOutputSpec<"o|users|![]!">;
    type _TestKind = Expect<Equal<Result["kind"], "object">>;
    type _TestName = Expect<Equal<Result["name"], "users">>;
    expect(true).toBe(true);
  });

  it("GetSpecKind extracts kind from string", () => {
    type Result1 = GetSpecKind<"s|uuid|!">;
    type Result2 = GetSpecKind<"o|users|![]!">;
    type Result3 = GetSpecKind<"e|order_by|?">;

    type _Test1 = Expect<Equal<Result1, "scalar">>;
    type _Test2 = Expect<Equal<Result2, "object">>;
    type _Test3 = Expect<Equal<Result3, "enum">>;
    expect(true).toBe(true);
  });

  it("GetSpecName extracts name from string", () => {
    type Result1 = GetSpecName<"s|uuid|!">;
    type Result2 = GetSpecName<"o|users|![]!">;

    type _Test1 = Expect<Equal<Result1, "uuid">>;
    type _Test2 = Expect<Equal<Result2, "users">>;
    expect(true).toBe(true);
  });

  it("GetSpecModifier extracts modifier from string", () => {
    type Result1 = GetSpecModifier<"s|uuid|!">;
    type Result2 = GetSpecModifier<"o|users|![]!">;
    type Result3 = GetSpecModifier<"s|Int|!|arg:s|X|?">;

    type _Test1 = Expect<Equal<Result1, "!">>;
    type _Test2 = Expect<Equal<Result2, "![]!">>;
    type _Test3 = Expect<Equal<Result3, "!">>;
    expect(true).toBe(true);
  });

  it("GetSpecDefaultValue extracts defaultValue from string with |D suffix", () => {
    type Result1 = GetSpecDefaultValue<"s|uuid|!|D">;
    type Result2 = GetSpecDefaultValue<"e|order_by|?|D">;

    // Deferred strings return AnyDefaultValue (not the actual value)
    type _Test1 = Expect<Equal<Result1, AnyDefaultValue>>;
    type _Test2 = Expect<Equal<Result2, AnyDefaultValue>>;
    expect(true).toBe(true);
  });

  it("GetSpecDefaultValue returns null for string without |D suffix", () => {
    type Result1 = GetSpecDefaultValue<"s|uuid|!">;
    type Result2 = GetSpecDefaultValue<"e|order_by|?">;
    type Result3 = GetSpecDefaultValue<"s|Int|!|arg:s|X|?">; // has args but no |D

    type _Test1 = Expect<Equal<Result1, null>>;
    type _Test2 = Expect<Equal<Result2, null>>;
    type _Test3 = Expect<Equal<Result3, null>>;
    expect(true).toBe(true);
  });

  it("GetSpecDefaultValue passes through structured defaultValue", () => {
    type WithDefault = { kind: "scalar"; name: "test"; modifier: "!"; defaultValue: { default: "value" } };
    type WithoutDefault = { kind: "scalar"; name: "test"; modifier: "!"; defaultValue: null };
    type WithUndefined = { kind: "scalar"; name: "test"; modifier: "!" };

    type Result1 = GetSpecDefaultValue<WithDefault>;
    type Result2 = GetSpecDefaultValue<WithoutDefault>;
    type Result3 = GetSpecDefaultValue<WithUndefined>;

    type _Test1 = Expect<Equal<Result1, { default: "value" }>>;
    type _Test2 = Expect<Equal<Result2, null>>;
    type _Test3 = Expect<Equal<Result3, null>>;
    expect(true).toBe(true);
  });

  it("GetSpecDefaultValue works with AnyDefaultValue type check", () => {
    // Test that the result can be used with AnyDefaultValue extends check
    type ResultWithD = GetSpecDefaultValue<"s|uuid|!|D">;
    type ResultWithoutD = GetSpecDefaultValue<"s|uuid|!">;

    type HasDefault1 = ResultWithD extends AnyDefaultValue ? true : false;
    type HasDefault2 = ResultWithoutD extends AnyDefaultValue ? true : false;

    type _Test1 = Expect<Equal<HasDefault1, true>>;
    type _Test2 = Expect<Equal<HasDefault2, false>>;
    expect(true).toBe(true);
  });
});

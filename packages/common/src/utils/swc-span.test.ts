import { describe, expect, test } from "bun:test";
import { createSwcSpanConverter } from "./swc-span";

describe("createSwcSpanConverter", () => {
  test("ASCII-only: byteLength equals string length", () => {
    const source = "const x = 42;";
    const converter = createSwcSpanConverter(source);
    expect(converter.byteLength).toBe(source.length);
  });

  test("ASCII-only: identity conversion", () => {
    const source = "hello world";
    const converter = createSwcSpanConverter(source);
    for (let i = 0; i <= source.length; i++) {
      expect(converter.byteOffsetToCharIndex(i)).toBe(i);
    }
  });

  test("empty string", () => {
    const converter = createSwcSpanConverter("");
    expect(converter.byteLength).toBe(0);
    expect(converter.byteOffsetToCharIndex(0)).toBe(0);
  });

  test("2-byte UTF-8 characters (accented)", () => {
    // "\u00E9" = e-acute, 2 bytes in UTF-8, 1 code unit in UTF-16
    const source = "caf\u00E9";
    const converter = createSwcSpanConverter(source);
    // "caf" = 3 bytes, "\u00E9" = 2 bytes → total 5 bytes
    expect(converter.byteLength).toBe(5);
    // byte 0 → char 0 ('c')
    expect(converter.byteOffsetToCharIndex(0)).toBe(0);
    // byte 3 → char 3 (start of '\u00E9')
    expect(converter.byteOffsetToCharIndex(3)).toBe(3);
    // byte 5 → char 4 (end sentinel)
    expect(converter.byteOffsetToCharIndex(5)).toBe(4);
  });

  test("3-byte UTF-8 characters (CJK)", () => {
    // Each Japanese character is 3 bytes in UTF-8, 1 code unit in UTF-16
    const source = "\u3053\u3093\u306B\u3061\u306F"; // konnichiwa
    const converter = createSwcSpanConverter(source);
    expect(converter.byteLength).toBe(15); // 5 chars * 3 bytes
    // byte 0 → char 0
    expect(converter.byteOffsetToCharIndex(0)).toBe(0);
    // byte 3 → char 1
    expect(converter.byteOffsetToCharIndex(3)).toBe(1);
    // byte 6 → char 2
    expect(converter.byteOffsetToCharIndex(6)).toBe(2);
    // byte 15 → char 5 (end sentinel)
    expect(converter.byteOffsetToCharIndex(15)).toBe(5);
  });

  test("4-byte UTF-8 / surrogate pair (emoji)", () => {
    // "\u{1F600}" = grinning face, 4 bytes UTF-8, 2 code units UTF-16
    const source = "a\u{1F600}b";
    const converter = createSwcSpanConverter(source);
    // 'a' = 1 byte, emoji = 4 bytes, 'b' = 1 byte → 6 bytes
    expect(converter.byteLength).toBe(6);
    // byte 0 → char 0 ('a')
    expect(converter.byteOffsetToCharIndex(0)).toBe(0);
    // byte 1 → char 1 (start of emoji, first surrogate)
    expect(converter.byteOffsetToCharIndex(1)).toBe(1);
    // byte 5 → char 3 ('b', after 2 code units for surrogate pair)
    expect(converter.byteOffsetToCharIndex(5)).toBe(3);
    // byte 6 → char 4 (end sentinel)
    expect(converter.byteOffsetToCharIndex(6)).toBe(4);
  });

  test("mixed ASCII and multi-byte", () => {
    // "hello \u3053\u3093\u306B\u3061\u306F world"
    const source = "hello \u3053\u3093\u306B\u3061\u306F world";
    const converter = createSwcSpanConverter(source);
    // "hello " = 6 bytes, 5 CJK chars = 15 bytes, " world" = 6 bytes → 27 bytes
    expect(converter.byteLength).toBe(27);

    // "hello " → bytes 0-5, chars 0-5
    expect(converter.byteOffsetToCharIndex(0)).toBe(0);
    expect(converter.byteOffsetToCharIndex(5)).toBe(5);

    // First CJK char starts at byte 6 → char 6
    expect(converter.byteOffsetToCharIndex(6)).toBe(6);

    // " world" starts at byte 21 → char 11
    expect(converter.byteOffsetToCharIndex(21)).toBe(11);

    // End sentinel
    expect(converter.byteOffsetToCharIndex(27)).toBe(17);
  });

  test("end sentinel: byteOffsetToCharIndex(byteLength) === source.length", () => {
    const sources = [
      "",
      "ascii",
      "caf\u00E9",
      "\u3053\u3093\u306B\u3061\u306F",
      "a\u{1F600}b",
      "hello \u3053\u3093\u306B\u3061\u306F world",
    ];
    for (const source of sources) {
      const converter = createSwcSpanConverter(source);
      expect(converter.byteOffsetToCharIndex(converter.byteLength)).toBe(source.length);
    }
  });
});

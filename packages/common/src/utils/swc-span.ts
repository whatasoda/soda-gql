/**
 * SWC span position converter: UTF-8 byte offsets → UTF-16 code unit indices.
 *
 * SWC (Rust-based) returns span positions as UTF-8 byte offsets.
 * JavaScript strings use UTF-16 code units for indexing.
 * For ASCII-only content these are identical, but for multi-byte
 * characters the positions diverge.
 */

export type SwcSpanConverter = {
  /** UTF-8 byte length of the source string */
  readonly byteLength: number;
  /** Convert a UTF-8 byte offset (within the source) to a UTF-16 code unit index */
  readonly byteOffsetToCharIndex: (byteOffset: number) => number;
};

/**
 * Create a converter that maps UTF-8 byte offsets to UTF-16 char indices
 * for the given source string.
 *
 * Includes a fast path for ASCII-only sources (zero allocation).
 */
export const createSwcSpanConverter = (source: string): SwcSpanConverter => {
  const byteLength = Buffer.byteLength(source, "utf8");

  // Fast path: ASCII-only — byte offsets equal char indices
  if (byteLength === source.length) {
    return {
      byteLength,
      byteOffsetToCharIndex: (byteOffset: number) => byteOffset,
    };
  }

  // Build lookup table: byteOffset → charIndex
  const byteToChar = new Uint32Array(byteLength + 1);
  let bytePos = 0;

  for (let charIdx = 0; charIdx < source.length; charIdx++) {
    const codePoint = source.codePointAt(charIdx)!;
    const bytesForCodePoint = codePoint <= 0x7f ? 1 : codePoint <= 0x7ff ? 2 : codePoint <= 0xffff ? 3 : 4;

    for (let b = 0; b < bytesForCodePoint; b++) {
      byteToChar[bytePos + b] = charIdx;
    }
    bytePos += bytesForCodePoint;

    // Astral code points use a surrogate pair (2 UTF-16 code units)
    if (codePoint > 0xffff) {
      charIdx++;
    }
  }

  // Sentinel: end-of-string
  byteToChar[byteLength] = source.length;

  return {
    byteLength,
    byteOffsetToCharIndex: (byteOffset: number) => byteToChar[byteOffset]!,
  };
};

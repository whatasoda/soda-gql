import type { AnyEffect, DeferEffect, ParallelEffect, PureEffect, YieldEffect } from "@soda-gql/common";
import { Effects } from "@soda-gql/common";

/**
 * File read effect - reads a file from the filesystem.
 */
export type FileReadEffect = {
  readonly kind: "file:read";
  readonly path: string;
};

/**
 * File stat effect - gets file stats from the filesystem.
 */
export type FileStatEffect = {
  readonly kind: "file:stat";
  readonly path: string;
};

/**
 * File stats result type.
 */
export type FileStats = {
  readonly mtimeMs: number;
  readonly size: number;
  readonly isFile: boolean;
};

/**
 * Builder-specific effect union type.
 * Extends the base Effect type with file I/O effects.
 */
export type BuilderEffect =
  | PureEffect
  | DeferEffect
  | ParallelEffect
  | YieldEffect
  | FileReadEffect
  | FileStatEffect;

/**
 * Builder effect constructors.
 * Extends the base Effects with file I/O operations.
 */
export const BuilderEffects = {
  ...Effects,

  /**
   * Create a file read effect.
   * @param path - The file path to read
   * @returns A FileReadEffect
   */
  readFile: (path: string): FileReadEffect => ({
    kind: "file:read",
    path,
  }),

  /**
   * Create a file stat effect.
   * @param path - The file path to stat
   * @returns A FileStatEffect
   */
  stat: (path: string): FileStatEffect => ({
    kind: "file:stat",
    path,
  }),
} as const;

/**
 * Type guard for FileReadEffect.
 */
export const isFileReadEffect = (effect: AnyEffect): effect is FileReadEffect => effect.kind === "file:read";

/**
 * Type guard for FileStatEffect.
 */
export const isFileStatEffect = (effect: AnyEffect): effect is FileStatEffect => effect.kind === "file:stat";

import { readFileSync, statSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { Effect, Effects } from "@soda-gql/common";

/**
 * File stats result type.
 */
export type FileStats = {
  readonly mtimeMs: number;
  readonly size: number;
  readonly isFile: boolean;
};

/**
 * File read effect - reads a file from the filesystem.
 * Works in both sync and async schedulers.
 *
 * @example
 * const effect = new FileReadEffect("/path/to/file");
 * yield effect;
 * const content: string = effect.value;
 */
export class FileReadEffect extends Effect<string> {
  constructor(readonly path: string) {
    super();
  }

  protected _executeSync(): string {
    return readFileSync(this.path, "utf-8");
  }

  protected _executeAsync(): Promise<string> {
    return readFile(this.path, "utf-8");
  }
}

/**
 * File stat effect - gets file stats from the filesystem.
 * Works in both sync and async schedulers.
 *
 * @example
 * const effect = new FileStatEffect("/path/to/file");
 * yield effect;
 * const stats: FileStats = effect.value;
 */
export class FileStatEffect extends Effect<FileStats> {
  constructor(readonly path: string) {
    super();
  }

  protected _executeSync(): FileStats {
    const stats = statSync(this.path);
    return {
      mtimeMs: stats.mtimeMs,
      size: stats.size,
      isFile: stats.isFile(),
    };
  }

  protected async _executeAsync(): Promise<FileStats> {
    const stats = await stat(this.path);
    return {
      mtimeMs: stats.mtimeMs,
      size: stats.size,
      isFile: stats.isFile(),
    };
  }
}

/**
 * File read effect that returns null if file doesn't exist.
 * Useful for discovery where missing files are expected.
 */
export class OptionalFileReadEffect extends Effect<string | null> {
  constructor(readonly path: string) {
    super();
  }

  protected _executeSync(): string | null {
    try {
      return readFileSync(this.path, "utf-8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }
      throw error;
    }
  }

  protected async _executeAsync(): Promise<string | null> {
    try {
      return await readFile(this.path, "utf-8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }
      throw error;
    }
  }
}

/**
 * File stat effect that returns null if file doesn't exist.
 * Useful for discovery where missing files are expected.
 */
export class OptionalFileStatEffect extends Effect<FileStats | null> {
  constructor(readonly path: string) {
    super();
  }

  protected _executeSync(): FileStats | null {
    try {
      const stats = statSync(this.path);
      return {
        mtimeMs: stats.mtimeMs,
        size: stats.size,
        isFile: stats.isFile(),
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }
      throw error;
    }
  }

  protected async _executeAsync(): Promise<FileStats | null> {
    try {
      const stats = await stat(this.path);
      return {
        mtimeMs: stats.mtimeMs,
        size: stats.size,
        isFile: stats.isFile(),
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }
      throw error;
    }
  }
}

/**
 * Builder effect constructors.
 * Extends the base Effects with file I/O operations.
 */
export const BuilderEffects = {
  ...Effects,

  /**
   * Create a file read effect.
   * @param path - The file path to read
   */
  readFile: (path: string): FileReadEffect => new FileReadEffect(path),

  /**
   * Create a file stat effect.
   * @param path - The file path to stat
   */
  stat: (path: string): FileStatEffect => new FileStatEffect(path),

  /**
   * Create an optional file read effect that returns null if file doesn't exist.
   * @param path - The file path to read
   */
  readFileOptional: (path: string): OptionalFileReadEffect => new OptionalFileReadEffect(path),

  /**
   * Create an optional file stat effect that returns null if file doesn't exist.
   * @param path - The file path to stat
   */
  statOptional: (path: string): OptionalFileStatEffect => new OptionalFileStatEffect(path),
} as const;

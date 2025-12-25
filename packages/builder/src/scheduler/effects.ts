import { readFileSync, statSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { Effect, Effects } from "@soda-gql/common";
import { type AnyOperation, type AnyModel, GqlElement } from "@soda-gql/core";

type AcceptableArtifact = AnyModel | AnyOperation;

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
 * const content = yield* new FileReadEffect("/path/to/file").run();
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
 * const stats = yield* new FileStatEffect("/path/to/file").run();
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
 * Element evaluation effect - evaluates a GqlElement using its generator.
 * Supports both sync and async schedulers, enabling parallel element evaluation
 * when using async scheduler.
 *
 * @example
 * yield* new ElementEvaluationEffect(element).run();
 */
export class ElementEvaluationEffect extends Effect<void> {
  constructor(readonly element: AcceptableArtifact) {
    super();
  }

  protected _executeSync(): void {
    // Run generator synchronously - throws if async operation is required
    const generator = GqlElement.createEvaluationGenerator(this.element);
    const result = generator.next();
    while (!result.done) {
      // If generator yields, it means async operation is needed
      throw new Error("Async operation required during sync element evaluation");
    }
  }

  protected async _executeAsync(): Promise<void> {
    const generator = GqlElement.createEvaluationGenerator(this.element);
    let result = generator.next();
    while (!result.done) {
      // Yield value is a Promise<void>
      await result.value;
      result = generator.next();
    }
  }
}

/**
 * Builder effect constructors.
 * Extends the base Effects with file I/O operations and element evaluation.
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

  /**
   * Create an element evaluation effect.
   * @param element - The GqlElement to evaluate
   */
  evaluateElement: (element: AcceptableArtifact): ElementEvaluationEffect => new ElementEvaluationEffect(element),
} as const;

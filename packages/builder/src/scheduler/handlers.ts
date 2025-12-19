import { readFile, stat } from "node:fs/promises";
import { readFileSync, statSync } from "node:fs";
import type { EffectHandler } from "@soda-gql/common";
import { isFileReadEffect, isFileStatEffect, type FileReadEffect, type FileStatEffect, type FileStats } from "./effects";

/**
 * Synchronous handler for FileReadEffect.
 * Uses readFileSync to read file contents.
 */
export const syncFileReadHandler: EffectHandler<FileReadEffect> = {
  canHandle: isFileReadEffect,
  handle: (effect) => readFileSync(effect.path, "utf-8"),
};

/**
 * Synchronous handler for FileStatEffect.
 * Uses statSync to get file stats.
 */
export const syncFileStatHandler: EffectHandler<FileStatEffect> = {
  canHandle: isFileStatEffect,
  handle: (effect): FileStats => {
    const stats = statSync(effect.path);
    return {
      mtimeMs: stats.mtimeMs,
      size: stats.size,
      isFile: stats.isFile(),
    };
  },
};

/**
 * Asynchronous handler for FileReadEffect.
 * Uses fs/promises readFile to read file contents.
 */
export const asyncFileReadHandler: EffectHandler<FileReadEffect> = {
  canHandle: isFileReadEffect,
  handle: (effect) => readFile(effect.path, "utf-8"),
};

/**
 * Asynchronous handler for FileStatEffect.
 * Uses fs/promises stat to get file stats.
 */
export const asyncFileStatHandler: EffectHandler<FileStatEffect> = {
  canHandle: isFileStatEffect,
  handle: async (effect): Promise<FileStats> => {
    const stats = await stat(effect.path);
    return {
      mtimeMs: stats.mtimeMs,
      size: stats.size,
      isFile: stats.isFile(),
    };
  },
};

/**
 * All synchronous builder handlers.
 */
export const syncBuilderHandlers = [syncFileReadHandler, syncFileStatHandler] as const;

/**
 * All asynchronous builder handlers.
 */
export const asyncBuilderHandlers = [asyncFileReadHandler, asyncFileStatHandler] as const;

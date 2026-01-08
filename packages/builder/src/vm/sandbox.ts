/**
 * VM sandbox utilities for CJS bundle evaluation.
 *
 * Provides shared infrastructure for executing CommonJS modules
 * in a sandboxed VM context with @soda-gql package mocking.
 *
 * @module
 */

import { resolve } from "node:path";
import { createContext, Script } from "node:vm";
import * as sandboxCore from "@soda-gql/core";
import * as sandboxCoreAdapter from "@soda-gql/core/adapter";
import * as sandboxCoreRuntime from "@soda-gql/core/runtime";
import * as sandboxRuntime from "@soda-gql/runtime";

/**
 * Sandbox type with CommonJS module exports.
 */
export type CjsSandbox = {
  require: (path: string) => unknown;
  module: { exports: Record<string, unknown> };
  exports: Record<string, unknown>;
  __dirname: string;
  __filename: string;
  global: unknown;
  globalThis: unknown;
  [key: string]: unknown;
};

/**
 * Create a require function for the sandbox.
 * Maps @soda-gql package imports to their actual modules.
 */
const createSandboxRequire = () => (path: string): unknown => {
  if (path === "@soda-gql/core") return sandboxCore;
  if (path === "@soda-gql/core/adapter") return sandboxCoreAdapter;
  if (path === "@soda-gql/core/runtime") return sandboxCoreRuntime;
  if (path === "@soda-gql/runtime") return sandboxRuntime;
  throw new Error(`Unknown module: ${path}`);
};

/**
 * Create a VM sandbox for executing CJS bundles.
 *
 * Sets up:
 * - require() handler for @soda-gql packages
 * - module.exports and exports pointing to the same object
 * - __dirname, __filename for path resolution
 * - global and globalThis pointing to the sandbox itself
 *
 * @param modulePath - Absolute path to the module being executed
 * @param additionalContext - Optional additional context properties
 * @returns Configured sandbox object
 */
export const createSandbox = (
  modulePath: string,
  additionalContext?: Record<string, unknown>,
): CjsSandbox => {
  const moduleExports: Record<string, unknown> = {};

  const sandbox: CjsSandbox = {
    require: createSandboxRequire(),
    module: { exports: moduleExports },
    exports: moduleExports,
    __dirname: resolve(modulePath, ".."),
    __filename: modulePath,
    global: undefined as unknown,
    globalThis: undefined as unknown,
    ...additionalContext,
  };

  // Wire global and globalThis to the sandbox itself
  sandbox.global = sandbox;
  sandbox.globalThis = sandbox;

  return sandbox;
};

/**
 * Execute CJS code in a sandbox and return the exports.
 *
 * Note: Reads from sandbox.module.exports because esbuild CJS output
 * reassigns module.exports via __toCommonJS(), replacing the original object.
 *
 * @param code - The CJS code to execute
 * @param modulePath - Absolute path to the module (for error messages)
 * @param additionalContext - Optional additional context properties
 * @returns The module's exports object
 */
export const executeSandbox = (
  code: string,
  modulePath: string,
  additionalContext?: Record<string, unknown>,
): Record<string, unknown> => {
  const sandbox = createSandbox(modulePath, additionalContext);
  const context = createContext(sandbox);
  new Script(code, { filename: modulePath }).runInContext(context);

  // Read from module.exports due to esbuild's CommonJS transform
  return sandbox.module.exports;
};

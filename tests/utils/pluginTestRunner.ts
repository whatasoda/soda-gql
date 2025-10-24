import { writeFileSync } from "node:fs";
import { join } from "node:path";
import type { BuilderArtifact } from "@soda-gql/builder";
import {
  __getRegisteredComposedOperations,
  __getRegisteredInlineOperations,
  __resetRuntimeRegistry,
} from "@soda-gql/core/runtime";

/**
 * Module format for plugin transformation tests
 */
export type ModuleFormat = "esm" | "cjs";

/**
 * Result of a plugin transformation test
 */
export type PluginTransformResult = {
  /** Original source code */
  originalCode: string;
  /** Transformed code */
  transformedCode: string;
  /** Whether the code was transformed */
  wasTransformed: boolean;
};

export type PluginTestRunnerTransformer = (params: {
  sourceCode: string;
  sourcePath: string;
  artifact: BuilderArtifact;
  moduleFormat: ModuleFormat;
}) => Promise<string>;

/**
 * Plugin test runner configuration
 */
export type PluginTestRunnerConfig = {
  /** Plugin name for logging */
  pluginName: string;
  /** Module format for transformation */
  moduleFormat: ModuleFormat;
  /** Function to transform source code using the plugin */
  transform: PluginTestRunnerTransformer;
};

/**
 * Create a plugin test runner that can verify transformations across different module formats.
 */
export const createPluginTestRunner = (config: PluginTestRunnerConfig) => {
  const { pluginName, transform } = config;

  /**
   * Test that gql calls are transformed to runtime calls
   */
  const testTransformation = async (params: {
    fixtureName: string;
    sourceCode: string;
    sourcePath: string;
    artifact: BuilderArtifact;
    moduleFormat: ModuleFormat;
    expectations: {
      /** Should contain runtime call (e.g., "gqlRuntime.model") */
      shouldContainRuntimeCall?: string;
      /** Should NOT contain original gql import */
      shouldNotContainGqlImport?: boolean;
      /** Should contain runtime import/require */
      shouldContainRuntimeImport?: boolean;
    };
  }): Promise<PluginTransformResult> => {
    const { sourceCode, sourcePath, artifact, moduleFormat, expectations } = params;

    const transformedCode = await transform({
      sourceCode,
      sourcePath,
      artifact,
      moduleFormat,
    });

    const wasTransformed = transformedCode !== sourceCode;

    // Verify expectations
    if (expectations.shouldContainRuntimeCall) {
      if (!transformedCode.includes(expectations.shouldContainRuntimeCall)) {
        throw new Error(`[${pluginName}] Expected transformed code to contain "${expectations.shouldContainRuntimeCall}"`);
      }
    }

    if (expectations.shouldNotContainGqlImport) {
      if (transformedCode.includes('from "@/graphql-system"') || transformedCode.includes('from "@/graphql-system"')) {
        throw new Error(`[${pluginName}] Expected transformed code to NOT contain graphql-system import`);
      }
    }

    if (expectations.shouldContainRuntimeImport) {
      const hasImport = transformedCode.includes("@soda-gql/runtime");
      const hasRequire = transformedCode.includes('require("@soda-gql/runtime")');
      if (!hasImport && !hasRequire) {
        throw new Error(`[${pluginName}] Expected transformed code to contain runtime import or require`);
      }
    }

    return {
      originalCode: sourceCode,
      transformedCode,
      wasTransformed,
    };
  };

  /**
   * Test runtime behavior by executing the transformed code
   */
  const testRuntimeBehavior = async (params: {
    transformedCode: string;
    tmpDir: string;
    expectations: {
      /** Expected composed operation names to be registered */
      expectedComposedOperations?: string[];
      /** Expected inline operation names to be registered */
      expectedInlineOperations?: string[];
    };
  }): Promise<void> => {
    const { transformedCode, tmpDir, expectations } = params;

    // Reset runtime registry
    __resetRuntimeRegistry();

    // Write transformed code to temporary file
    const testFilePath = join(tmpDir, `test-${Date.now()}.mjs`);
    writeFileSync(testFilePath, transformedCode);

    // Import the file to execute it
    try {
      await import(`file://${testFilePath}?t=${Date.now()}`);
    } catch (error) {
      throw new Error(`[${pluginName}] Failed to execute transformed code: ${error}`);
    }

    // Verify expectations for composed operations
    if (expectations.expectedComposedOperations) {
      const registered = __getRegisteredComposedOperations();
      const registeredNames = Array.from(registered.keys());

      for (const expected of expectations.expectedComposedOperations) {
        if (!registeredNames.includes(expected)) {
          throw new Error(
            `[${pluginName}] Expected composed operation "${expected}" to be registered. ` +
              `Registered: ${registeredNames.join(", ")}`,
          );
        }
      }
    }

    // Verify expectations for inline operations
    if (expectations.expectedInlineOperations) {
      const registered = __getRegisteredInlineOperations();
      const registeredNames = Array.from(registered.keys());

      for (const expected of expectations.expectedInlineOperations) {
        if (!registeredNames.includes(expected)) {
          throw new Error(
            `[${pluginName}] Expected inline operation "${expected}" to be registered. ` +
              `Registered: ${registeredNames.join(", ")}`,
          );
        }
      }
    }
  };

  return {
    testTransformation,
    testRuntimeBehavior,
  };
};

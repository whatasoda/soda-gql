import { readFile } from "node:fs/promises";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dir, "..");

type TsconfigReference = { path: string };

type TsconfigJson = {
  references?: TsconfigReference[];
};

type ValidationError = {
  file: string;
  type: "missing" | "extra";
  path: string;
};

/**
 * Find all tsconfig.editor.json files in packages/ and playgrounds/
 */
const findEditorConfigs = async (): Promise<string[]> => {
  const glob = new Bun.Glob("*/tsconfig.editor.json");

  const packageConfigs = await Array.fromAsync(
    glob.scan({ cwd: join(REPO_ROOT, "packages"), absolute: false }),
  );
  const playgroundConfigs = await Array.fromAsync(
    glob.scan({ cwd: join(REPO_ROOT, "playgrounds"), absolute: false }),
  );

  return [
    ...packageConfigs.map((f) => `./packages/${f}`),
    ...playgroundConfigs.map((f) => `./playgrounds/${f}`),
  ].sort();
};

/**
 * Read and parse tsconfig file
 */
const readTsconfig = async (filePath: string): Promise<TsconfigJson> => {
  const fullPath = join(REPO_ROOT, filePath);
  const content = await readFile(fullPath, "utf-8");
  // Handle JSON with comments (tsconfig allows comments)
  const jsonWithoutComments = content.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, "");
  // Handle trailing commas (common in tsconfig)
  const jsonClean = jsonWithoutComments.replace(/,(\s*[}\]])/g, "$1");
  return JSON.parse(jsonClean) as TsconfigJson;
};

/**
 * Extract reference paths from tsconfig
 */
const extractReferences = (tsconfig: TsconfigJson): Set<string> => {
  const refs = tsconfig.references ?? [];
  return new Set(refs.map((ref) => ref.path));
};

/**
 * Validate references in a single tsconfig file
 */
const validateReferences = async (
  configFile: string,
  expectedRefs: Set<string>,
): Promise<ValidationError[]> => {
  const tsconfig = await readTsconfig(configFile);
  const actualRefs = extractReferences(tsconfig);

  const errors: ValidationError[] = [];

  // Check for missing references
  for (const expected of expectedRefs) {
    if (!actualRefs.has(expected)) {
      errors.push({
        file: configFile,
        type: "missing",
        path: expected,
      });
    }
  }

  // Check for extra references (references to non-existent files)
  for (const actual of actualRefs) {
    if (
      !expectedRefs.has(actual) &&
      (actual.startsWith("./packages/") || actual.startsWith("./playgrounds/"))
    ) {
      // This is a reference to a package/playground that doesn't exist
      if (actual.endsWith("/tsconfig.editor.json")) {
        errors.push({
          file: configFile,
          type: "extra",
          path: actual,
        });
      }
    }
  }

  return errors;
};

/**
 * Main function
 */
const main = async (): Promise<void> => {
  console.log("Checking tsconfig.json references...\n");

  // Find all expected tsconfig.editor.json files
  const editorConfigs = await findEditorConfigs();
  const expectedRefs = new Set(editorConfigs);

  // Add root tsconfig.editor.json to expected refs for tsconfig.json
  const expectedRefsWithRoot = new Set([...expectedRefs, "./tsconfig.editor.json"]);

  let hasErrors = false;

  // Validate tsconfig.json
  console.log("Validating tsconfig.json...");
  const tsconfigErrors = await validateReferences("tsconfig.json", expectedRefsWithRoot);

  if (tsconfigErrors.length > 0) {
    const missingErrors = tsconfigErrors.filter((e) => e.type === "missing");
    const extraErrors = tsconfigErrors.filter((e) => e.type === "extra");

    if (missingErrors.length > 0) {
      hasErrors = true;
      console.error(`  Missing references (${missingErrors.length}):`);
      for (const error of missingErrors) {
        console.error(`    - ${error.path}`);
      }
    }

    if (extraErrors.length > 0) {
      hasErrors = true;
      console.error(`  Extra references to non-existent files (${extraErrors.length}):`);
      for (const error of extraErrors) {
        console.error(`    - ${error.path}`);
      }
    }
  } else {
    console.log("  All references are correct");
  }

  console.log("");

  // Validate tsconfig.editor.json
  console.log("Validating tsconfig.editor.json...");
  const editorTsconfigErrors = await validateReferences("tsconfig.editor.json", expectedRefs);

  if (editorTsconfigErrors.length > 0) {
    const missingErrors = editorTsconfigErrors.filter((e) => e.type === "missing");
    const extraErrors = editorTsconfigErrors.filter((e) => e.type === "extra");

    if (missingErrors.length > 0) {
      hasErrors = true;
      console.error(`  Missing references (${missingErrors.length}):`);
      for (const error of missingErrors) {
        console.error(`    - ${error.path}`);
      }
    }

    if (extraErrors.length > 0) {
      hasErrors = true;
      console.error(`  Extra references to non-existent files (${extraErrors.length}):`);
      for (const error of extraErrors) {
        console.error(`    - ${error.path}`);
      }
    }
  } else {
    console.log("  All references are correct");
  }

  console.log("");

  if (hasErrors) {
    console.error("Validation failed. Please update tsconfig references.");
    process.exit(1);
  }

  console.log("All tsconfig references are valid.");
};

await main();

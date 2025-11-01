import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Recursively find all .d.ts files in a directory
 */
async function findDtsFiles(dir: string): Promise<string[]> {
  const results: string[] = [];

  try {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        results.push(...(await findDtsFiles(fullPath)));
      } else if (entry.isFile() && entry.name.endsWith(".d.ts")) {
        results.push(fullPath);
      }
    }
  } catch (error) {
    // Directory might not exist, ignore
  }

  return results;
}

/**
 * Validate generated type definitions for correct type parameters
 * Checks for tsdown's type parameter renaming bug (e.g., TSchema -> TSchema_1)
 */
const validateTypes = async () => {
  console.log("Validating generated type definitions...\n");

  const packageDirEntries = await readdir("packages", { withFileTypes: true });
  const packages = packageDirEntries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);

  // Patterns that indicate type parameter bugs
  // These are generic parameter names with numeric suffixes that shouldn't exist
  const suspiciousPatterns = [
    /\bTSchema_\d+\b/g,
    /\bTRuntimeAdapter_\d+\b/g,
    /\bTSliceFragments_\d+\b/g,
    /\bTVariables_\d+\b/g,
    /\bTContext_\d+\b/g,
  ];

  let hasIssues = false;

  for (const pkg of packages) {
    const packageDir = path.join("packages", pkg);
    const distDir = path.join(packageDir, "dist");

    console.log(`Validating types for @soda-gql/${pkg}...`);

    try {
      // Find all .d.ts files in dist directory
      const dtsFiles = await findDtsFiles(distDir);

      if (dtsFiles.length === 0) {
        console.warn(`⚠️  No .d.ts files found for @soda-gql/${pkg}`);
        continue;
      }

      let packageHasIssues = false;

      for (const dtsFile of dtsFiles) {
        const content = await readFile(dtsFile, "utf-8");
        const relativePath = path.relative(packageDir, dtsFile);

        for (const pattern of suspiciousPatterns) {
          const matches = content.match(pattern);
          if (matches) {
            if (!packageHasIssues) {
              console.error(`❌ Found type parameter issues in @soda-gql/${pkg}`);
              packageHasIssues = true;
              hasIssues = true;
            }

            console.error(`   ${relativePath}:`);
            for (const match of matches) {
              console.error(`     - Found suspicious type parameter: ${match}`);
            }
          }
        }
      }

      if (!packageHasIssues) {
        console.log(`✅ No type parameter issues found for @soda-gql/${pkg}`);
      }
    } catch (error) {
      console.error(`❌ Error validating types for @soda-gql/${pkg}:`, error);
      hasIssues = true;
    }

    console.log("");
  }

  if (hasIssues) {
    console.error("\n❌ Type validation failed - found type parameter issues");
    console.error("This usually indicates type bundling/inlining bugs.");
    console.error("Check the reported files for incorrect type parameter names.");
    process.exit(1);
  } else {
    console.log("\n✅ All type definitions validated successfully");
  }
};

validateTypes().catch((error) => {
  console.error("Fatal error during type validation:", error);
  process.exit(1);
});

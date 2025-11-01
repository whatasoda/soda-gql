import { readdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { $ } from "bun";

/**
 * Build type definitions for all packages using tsc
 * This avoids tsdown's type parameter renaming bug
 */
const buildTypes = async () => {
  console.log("Building type definitions with tsc...\n");

  const packageDirEntries = await readdir("packages", { withFileTypes: true });
  const packages = packageDirEntries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);

  // Build path aliases for internal package resolution
  const pathAliases: Record<string, string[]> = {};
  for (const pkg of packages) {
    pathAliases[`@soda-gql/${pkg}/*`] = [`../../${pkg}/src/*`];
  }

  let hasErrors = false;

  for (const pkg of packages) {
    const packageDir = path.join("packages", pkg);
    const srcDir = path.join(packageDir, "src");
    const distDir = path.join(packageDir, "dist");
    const tsconfigPath = path.join(packageDir, "tsconfig.build-types.json");

    console.log(`Building types for @soda-gql/${pkg}...`);

    try {
      // Create temporary tsconfig for type generation
      const tsconfigContent = {
        extends: "../../tsconfig.base.json",
        compilerOptions: {
          emitDeclarationOnly: true,
          declaration: true,
          declarationMap: true,
          outDir: "./dist",
          rootDir: "./src",
          customConditions: ["development"],
          moduleResolution: "Bundler",
          skipLibCheck: true,
          noEmit: false,
          composite: false,
          paths: pathAliases,
        },
        include: ["src/**/*"],
        exclude: ["node_modules", "dist", "**/*.test.ts", "**/*.spec.ts"],
      };

      await writeFile(tsconfigPath, JSON.stringify(tsconfigContent, null, 2));

      // Run tsc with the generated config
      const result = await $`bunx tsc --project ${tsconfigPath}`.nothrow();

      // Clean up temporary config
      await rm(tsconfigPath, { force: true });

      if (result.exitCode !== 0) {
        console.error(`❌ Failed to build types for @soda-gql/${pkg}`);
        console.error(result.stderr.toString());
        hasErrors = true;
      } else {
        console.log(`✅ Successfully built types for @soda-gql/${pkg}`);
      }
    } catch (error) {
      console.error(`❌ Error building types for @soda-gql/${pkg}:`, error);
      hasErrors = true;
    }

    console.log("");
  }

  if (hasErrors) {
    console.error("\n❌ Type generation failed for some packages");
    process.exit(1);
  } else {
    console.log("\n✅ All type definitions generated successfully");
  }
};

buildTypes().catch((error) => {
  console.error("Fatal error during type generation:", error);
  process.exit(1);
});

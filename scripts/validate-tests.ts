#!/usr/bin/env bun
import * as fs from "node:fs/promises";
import * as path from "node:path";
import ts from "typescript";

interface AliasMapping {
	alias: string;
	aliasBase: string;
	targetAbs: string;
	wildcard: boolean;
}

interface Violation {
	file: string;
	line: number;
	found: string;
	suggestion: string;
}

const PROJECT_ROOT = path.resolve(import.meta.dir, "..");

async function loadAliasMap(): Promise<AliasMapping[]> {
	const tsConfigPath = path.join(PROJECT_ROOT, "tsconfig.editor.json");
	const content = await fs.readFile(tsConfigPath, "utf-8");
	const config = JSON.parse(content);

	const mappings: AliasMapping[] = [];
	const paths = config.compilerOptions?.paths ?? {};

	for (const [alias, targets] of Object.entries(paths)) {
		const target = (targets as string[])[0];
		if (!target) continue;

		const wildcard = alias.endsWith("/*");
		const aliasBase = wildcard ? alias.slice(0, -2) : alias;
		const targetAbs = path.resolve(PROJECT_ROOT, target.replace("/*", ""));

		mappings.push({ alias, aliasBase, targetAbs, wildcard });
	}

	return mappings;
}

async function* walkDirectory(dir: string): AsyncGenerator<string> {
	const skipDirs = new Set([
		"node_modules",
		".git",
		".typecheck",
		"dist",
		".tmp",
	]);

	const entries = await fs.readdir(dir, { withFileTypes: true });

	for (const entry of entries) {
		if (skipDirs.has(entry.name)) continue;

		const fullPath = path.join(dir, entry.name);

		if (entry.isDirectory()) {
			yield* walkDirectory(fullPath);
		} else if (/\.test\.(ts|tsx|js|mjs|cjs)$/.test(entry.name)) {
			yield fullPath;
		}
	}
}

function extractImports(
	filePath: string,
	sourceFile: ts.SourceFile,
): { specifier: string; line: number }[] {
	const imports: { specifier: string; line: number }[] = [];

	function visit(node: ts.Node) {
		// Import declarations: import { x } from "module"
		if (ts.isImportDeclaration(node) && node.moduleSpecifier) {
			if (ts.isStringLiteral(node.moduleSpecifier)) {
				const line =
					sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
				imports.push({ specifier: node.moduleSpecifier.text, line });
			}
		}

		// Export declarations: export { x } from "module"
		if (
			ts.isExportDeclaration(node) &&
			node.moduleSpecifier &&
			ts.isStringLiteral(node.moduleSpecifier)
		) {
			const line =
				sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
			imports.push({ specifier: node.moduleSpecifier.text, line });
		}

		// Dynamic imports: import("module")
		if (
			ts.isCallExpression(node) &&
			node.expression.kind === ts.SyntaxKind.ImportKeyword
		) {
			const arg = node.arguments[0];
			if (arg && ts.isStringLiteral(arg)) {
				const line =
					sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
				imports.push({ specifier: arg.text, line });
			}
		}

		ts.forEachChild(node, visit);
	}

	visit(sourceFile);
	return imports;
}

function suggestAlias(
	absolutePath: string,
	aliasMap: AliasMapping[],
): string | null {
	for (const mapping of aliasMap) {
		if (!absolutePath.startsWith(mapping.targetAbs)) continue;

		let relative = path
			.relative(mapping.targetAbs, absolutePath)
			.replace(/\\/g, "/");

		// Remove file extension
		relative = relative.replace(/\.(ts|tsx|js|mjs|cjs)$/, "");

		// Handle index files
		if (relative === "index") {
			return mapping.aliasBase;
		}

		if (mapping.wildcard) {
			return `${mapping.aliasBase}/${relative}`;
		}

		return mapping.aliasBase;
	}

	return null;
}

async function validateTestFile(
	filePath: string,
	aliasMap: AliasMapping[],
): Promise<Violation[]> {
	const content = await fs.readFile(filePath, "utf-8");
	const sourceFile = ts.createSourceFile(
		filePath,
		content,
		ts.ScriptTarget.ES2022,
		true,
		ts.ScriptKind.TS,
	);

	const imports = extractImports(filePath, sourceFile);
	const violations: Violation[] = [];

	for (const { specifier, line } of imports) {
		// Skip non-relative imports
		if (!specifier.startsWith("./") && !specifier.startsWith("../")) {
			continue;
		}

		const resolvedPath = path.resolve(path.dirname(filePath), specifier);
		const normalizedPath = resolvedPath.replace(/\\/g, "/");

		// Check if it references packages/
		if (!normalizedPath.includes("/packages/")) {
			continue;
		}

		// Try to find matching alias
		const suggestion = suggestAlias(resolvedPath, aliasMap);

		if (!suggestion) {
			console.warn(
				`WARNING: ${filePath}:${line} - No alias found for ${specifier}`,
			);
			console.warn(
				"  Consider adding an alias to tsconfig.editor.json for this package",
			);
			continue;
		}

		violations.push({
			file: filePath,
			line,
			found: specifier,
			suggestion,
		});
	}

	return violations;
}

async function main() {
	console.log("Loading alias mappings from tsconfig.editor.json...");
	const aliasMap = await loadAliasMap();

	console.log("Scanning for test files...\n");
	const testFiles: string[] = [];
	const misplacedTests: string[] = [];

	for await (const file of walkDirectory(PROJECT_ROOT)) {
		const relativePath = path
			.relative(PROJECT_ROOT, file)
			.replace(/\\/g, "/");
		testFiles.push(file);

		// Check if test file is under tests/
		if (!relativePath.startsWith("tests/")) {
			misplacedTests.push(relativePath);
		}
	}

	console.log(`Found ${testFiles.length} test files`);

	// Report misplaced tests
	if (misplacedTests.length > 0) {
		console.log("\n❌ MISPLACED TEST FILES:");
		for (const file of misplacedTests) {
			console.log(`  ${file}`);
			console.log(`    → Move to tests/ directory`);
		}
	}

	// Check imports
	console.log("\nValidating import paths...");
	const allViolations: Violation[] = [];

	for (const file of testFiles) {
		const violations = await validateTestFile(file, aliasMap);
		allViolations.push(...violations);
	}

	// Report import violations
	if (allViolations.length > 0) {
		console.log("\n❌ INVALID IMPORT PATHS:");
		for (const violation of allViolations) {
			const relativePath = path
				.relative(PROJECT_ROOT, violation.file)
				.replace(/\\/g, "/");
			console.log(`\n  ${relativePath}:${violation.line}`);
			console.log(`    found: ${violation.found}`);
			console.log(`    use:   ${violation.suggestion}`);
		}
	}

	// Summary
	console.log("\n" + "=".repeat(50));
	if (misplacedTests.length === 0 && allViolations.length === 0) {
		console.log("✅ All tests are valid!");
		process.exitCode = 0;
	} else {
		console.log(`❌ Found ${misplacedTests.length} misplaced test files`);
		console.log(`❌ Found ${allViolations.length} invalid import paths`);
		process.exitCode = 1;
	}
}

main().catch((error) => {
	console.error("Fatal error:", error);
	process.exitCode = 1;
});

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { BuilderArtifact } from "@soda-gql/builder";

/**
 * Create a temporary artifact file from a template
 */
export const createTempArtifact = async (artifact: BuilderArtifact): Promise<string> => {
	const tmpDir = join(tmpdir(), `soda-gql-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
	await mkdir(tmpDir, { recursive: true });

	const artifactPath = join(tmpDir, "artifact.json");
	await writeFile(artifactPath, JSON.stringify(artifact, null, 2), "utf8");

	return artifactPath;
};

/**
 * Create a temporary source file
 */
export const createTempSource = async (filename: string, content: string): Promise<string> => {
	const tmpDir = join(tmpdir(), `soda-gql-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
	await mkdir(tmpDir, { recursive: true });

	const sourcePath = join(tmpDir, filename);
	await mkdir(dirname(sourcePath), { recursive: true });
	await writeFile(sourcePath, content, "utf8");

	return sourcePath;
};

/**
 * Load fixture file
 */
export const loadFixture = async (fixtureName: string): Promise<string> => {
	const fixturePath = join(import.meta.dir, "../fixtures", fixtureName);
	return readFile(fixturePath, "utf8");
};

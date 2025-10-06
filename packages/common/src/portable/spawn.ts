/**
 * Portable subprocess spawning that works on both Bun and Node.js
 */

import { runtime } from "./runtime";

export interface SpawnOptions {
	cmd: string[];
	cwd?: string;
	env?: Record<string, string>;
}

export interface SpawnResult {
	stdout: string;
	stderr: string;
	exitCode: number;
}

export async function spawn(options: SpawnOptions): Promise<SpawnResult> {
	if (runtime.isBun) {
		const proc = Bun.spawn(options.cmd, {
			cwd: options.cwd,
			env: options.env,
			stdout: "pipe",
			stderr: "pipe",
		});

		const [stdout, stderr] = await Promise.all([
			new Response(proc.stdout).text(),
			new Response(proc.stderr).text(),
		]);

		const exitCode = await proc.exited;

		return { stdout, stderr, exitCode };
	}

	// Node.js implementation
	const { execFile } = await import("node:child_process");
	const { promisify } = await import("node:util");
	const execFilePromise = promisify(execFile);

	try {
		const execOptions: {
			cwd?: string;
			env?: Record<string, string>;
			encoding: BufferEncoding;
		} = {
			encoding: "utf-8",
		};

		if (options.cwd) {
			execOptions.cwd = options.cwd;
		}
		if (options.env) {
			execOptions.env = options.env;
		}

		const { stdout, stderr } = await execFilePromise(
			options.cmd[0],
			options.cmd.slice(1),
			execOptions,
		);
		return {
			stdout: stdout || "",
			stderr: stderr || "",
			exitCode: 0,
		};
	} catch (error: unknown) {
		const err = error as {
			stdout?: string;
			stderr?: string;
			code?: number;
		};
		return {
			stdout: err.stdout || "",
			stderr: err.stderr || "",
			exitCode: err.code || 1,
		};
	}
}

/**
 * Integration test: spawns a real tsserver process, loads the bundled TS plugin,
 * and verifies that GraphQL completion works end-to-end.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { ChildProcess } from "node:child_process";
import { spawn } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const fixturesDir = resolve(import.meta.dir, "../fixtures");
const pluginPath = resolve(import.meta.dir, "../../../../packages/vscode-extension/dist/ts-plugin.cjs");

const PLUGIN_PACKAGE_NAME = "soda-gql-ts-plugin";

/** Communicates with a tsserver process via JSON protocol. */
class TsServerClient {
  private proc: ChildProcess;
  private seq = 0;
  private buffer = "";
  private pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

  constructor(cwd: string) {
    const tsserverPath = require.resolve("typescript/lib/tsserver.js");
    this.proc = spawn("node", [tsserverPath, "--disableAutomaticTypingAcquisition", "--pluginProbeLocations", cwd], {
      cwd,
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.proc.stdout!.on("data", (chunk: Buffer) => {
      this.buffer += chunk.toString();
      this.drain();
    });
  }

  private drain(): void {
    while (true) {
      const headerEnd = this.buffer.indexOf("\r\n\r\n");
      if (headerEnd < 0) break;
      const header = this.buffer.slice(0, headerEnd);
      const match = header.match(/Content-Length:\s*(\d+)/);
      if (!match) break;
      const len = Number(match[1]);
      const bodyStart = headerEnd + 4;
      if (this.buffer.length < bodyStart + len) break;
      const body = this.buffer.slice(bodyStart, bodyStart + len);
      this.buffer = this.buffer.slice(bodyStart + len);
      try {
        const msg = JSON.parse(body);
        if (msg.request_seq !== undefined) {
          const p = this.pending.get(msg.request_seq);
          if (p) {
            this.pending.delete(msg.request_seq);
            p.resolve(msg);
          }
        }
      } catch {
        // ignore parse errors
      }
    }
  }

  /** Send a command that does not return a response (e.g. "open"). */
  send(command: string, args: Record<string, unknown>): void {
    const seq = ++this.seq;
    const payload = JSON.stringify({ seq, type: "request", command, arguments: args });
    this.proc.stdin!.write(`${payload}\n`);
  }

  /** Send a command and wait for the response. */
  request(command: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
    const seq = ++this.seq;
    const payload = JSON.stringify({ seq, type: "request", command, arguments: args });
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pending.has(seq)) {
          this.pending.delete(seq);
          reject(new Error(`Timeout: ${command} (seq ${seq})`));
        }
      }, 15_000);
      this.pending.set(seq, {
        resolve: (v: unknown) => {
          clearTimeout(timer);
          resolve(v as Record<string, unknown>);
        },
        reject: (e: Error) => {
          clearTimeout(timer);
          reject(e);
        },
      });
      this.proc.stdin!.write(`${payload}\n`);
    });
  }

  close(): void {
    this.proc.kill();
  }
}

/** Create a temporary TypeScript project configured with the ts-plugin. */
function createTempProject(source: string) {
  const tmpDir = mkdtempSync(join(tmpdir(), "tsserver-process-test-"));
  const testFile = join(tmpDir, "test.ts");
  writeFileSync(testFile, source);

  writeFileSync(
    join(tmpDir, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "ESNext",
        moduleResolution: "bundler",
        strict: true,
        skipLibCheck: true,
        plugins: [{ name: PLUGIN_PACKAGE_NAME }],
      },
      include: ["*.ts"],
    }),
  );

  // tsserver only loads plugins by package name from node_modules.
  // Create a fake package that re-exports the bundled plugin.
  const fakePackageDir = join(tmpDir, "node_modules", PLUGIN_PACKAGE_NAME);
  mkdirSync(fakePackageDir, { recursive: true });
  writeFileSync(join(fakePackageDir, "package.json"), JSON.stringify({ name: PLUGIN_PACKAGE_NAME, main: "index.js" }));
  writeFileSync(join(fakePackageDir, "index.js"), `module.exports = require(${JSON.stringify(pluginPath)});`);

  writeFileSync(
    join(tmpDir, "soda-gql.config.ts"),
    `import { defineConfig } from "@soda-gql/config";
export default defineConfig({
  outdir: "./graphql-system",
  include: ["**/*.ts"],
  schemas: {
    default: {
      schema: "./schemas/default.graphql",
      inject: { scalars: "./scalars.ts" },
    },
  },
});
`,
  );

  mkdirSync(join(tmpDir, "schemas"), { recursive: true });
  copyFileSync(join(fixturesDir, "schemas/default.graphql"), join(tmpDir, "schemas/default.graphql"));
  copyFileSync(join(fixturesDir, "scalars.ts"), join(tmpDir, "scalars.ts"));

  return { tmpDir, testFile };
}

describe("tsserver process integration", () => {
  const bundleExists = existsSync(pluginPath);

  if (!bundleExists) {
    test.skip("skipped: ts-plugin.cjs bundle not found (run extension build first)", () => {});
    return;
  }

  let client: TsServerClient;
  let testFile: string;

  const sourceWithCursor = `
import { gql } from "@/graphql-system";
const GetUser = gql.default(({ query }) =>
  query("GetUser")\`{ users { | } }\`
);
`;
  const cursorOffset = sourceWithCursor.indexOf("|");
  const source = sourceWithCursor.slice(0, cursorOffset) + sourceWithCursor.slice(cursorOffset + 1);

  // Compute line/offset from cursor position (tsserver uses 1-based line and offset)
  const linesBeforeCursor = source.slice(0, cursorOffset).split("\n");
  const line = linesBeforeCursor.length;
  const offset = (linesBeforeCursor[linesBeforeCursor.length - 1]?.length ?? 0) + 1;

  beforeAll(async () => {
    const project = createTempProject(source);
    testFile = project.testFile;
    client = new TsServerClient(project.tmpDir);

    // Wait for tsserver to initialize
    await new Promise((r) => setTimeout(r, 1000));

    // Open the file (no response expected from open command)
    client.send("open", { file: testFile, scriptKindName: "TS" });

    // Give tsserver time to load the plugin and process the file
    await new Promise((r) => setTimeout(r, 3000));
  }, 30_000);

  afterAll(() => {
    client?.close();
  });

  test("tsserver returns GraphQL field completions inside tagged template", async () => {
    const response = (await client.request("completionInfo", {
      file: testFile,
      line,
      offset,
    })) as { success: boolean; body?: { entries?: Array<{ name: string }> } };

    expect(response.success).toBe(true);
    expect(response.body).toBeDefined();
    expect(response.body!.entries).toBeDefined();

    const names = response.body!.entries!.map((e) => e.name);
    expect(names).toContain("id");
    expect(names).toContain("name");
    expect(names).toContain("email");
    expect(names).toContain("posts");
  }, 20_000);
});

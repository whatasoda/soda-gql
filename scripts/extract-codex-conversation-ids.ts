#!/usr/bin/env -S bun run

import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { Dirent, Stats } from "node:fs";

const SCRIPT_PATH = path.relative(process.cwd(), import.meta.dirname);
const USAGE = `\
Extract Codex MCP conversationId candidates from ~/.codex/sessions

This script scans Codex MCP session data under ~/.codex/sessions and lists possible
conversationId values, showing when they were created, last updated, and the first
user prompt (for quick context). It is useful when multiple Codex sessions are running
concurrently and you want to find the right conversationId to use for a manual MCP call.

🧭 Filtering rules:
  - Only includes sessions that are located in the current working directory **or any of its ancestors**.
    (This allows you to run the command from any subdirectory of a project and still match its sessions.)
  - Skips old files if --since is specified.
  - Aggregates results across all matching files (JSON, log, ndjson, etc.).

🧩 Output fields:
  - created:   File creation time (when the session first appeared)
  - lastSeen:  Most recent modification time of any file containing this ID
  - id:        The conversationId itself
  - firstPrompt:  The first user message found in that session (truncated to 80 chars)

🧱 Example (human output):
  $ bun extract-codex-conversation-ids.ts
  #  created              lastSeen              id                                      firstPrompt
  1  2025-10-12T18:05:11+09:00  2025-10-12T19:30:02+09:00  3e63c3fb-91b3-4a03-b7d3-af07b4c8e8bb  "codex の ~/.codex/sessions から mcp..."

🧰 Options:
  --help           Show this help message
  --dir <path>       Override sessions root (default: ~/.codex/sessions)
  --work-dir <path>  Limit sessions to those in the specified working directory or its ancestors (default: current working directory)
  --limit <count>    Limit the number of sessions to extract (default: 10)
  --since <dur>      Only include files modified within a duration (e.g. 30m, 6h, 2d)
  --json             Output JSON instead of human-readable text

🧪 Examples:
  # Show help
  bun ${SCRIPT_PATH} --help

  # Basic usage
  bun ${SCRIPT_PATH}

  # Basic usage with limit
  bun ${SCRIPT_PATH} --limit 10

  # Show only sessions updated in the last 2 hours
  bun ${SCRIPT_PATH} --since 2h

  # Output JSON for further processing
  bun ${SCRIPT_PATH} --json
`;

type SessionFileInfo = {
  filename: string;
  stat: Stats;
};

type Session = {
  id: string;
  birthtimeMs: number;
  mtimeMs: number;
  prompt?: string;
};

function parseArgs() {
  const args = new Map<string, string | boolean>();
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg?.startsWith("--")) {
      const key = arg.slice(2);
      const next = process.argv[i + 1];
      if (!next || next.startsWith("--")) args.set(key, true);
      else {
        args.set(key, next);
        i++;
      }
    }
  }

  if (args.get("help")) {
    console.log(USAGE);
    process.exit(0);
  }

  const rootDir = (args.get("dir") as string) ?? path.join(os.homedir(), ".codex", "sessions");
  const jsonOut = Boolean(args.get("json"));
  const since = parseSince((args.get("since") as string) ?? "");
  const limitCount = parseCount((args.get("limit") as string) ?? "");
  const workDir = (args.get("work-dir") as string) ?? process.cwd();

  return { rootDir, jsonOut, since, limitCount, workDir };

  function parseSince(since: string): number | 0 {
    // cspell:disable-next-line
    const match = since.match(/^(\d+)([smhdw])$/i);
    const value = parseInt(match?.[1] ?? "0", 10);
    const unit = match?.[2]?.toLowerCase();

    if (!value || !unit) {
      return 0;
    }

    const units: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400, w: 604800 };
    return Date.now() - value * (units[unit] ?? 0) * 1000;
  }

  function parseCount(limit: string): number {
    if (!limit) return 10;
    const n = Number(limit);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 10;
  }
}

const main = async () => {
  try {
    const { rootDir, jsonOut, since, limitCount, workDir } = parseArgs();

    const sessions = await extractSessionsWithLimit({
      rootDir,
      since,
      workDir,
      limitCount,
    });

    if (jsonOut) {
      const json = sessions.map((o) => ({
        id: o.id,
        created: new Date(o.birthtimeMs).toISOString(),
        lastSeen: new Date(o.mtimeMs).toISOString(),
        prompt: o.prompt,
      }));
      console.log(JSON.stringify(json, null, 2));
    } else {
      if (sessions.length > 0) {
        const rows = sessions.map((session) => ({
          id: session.id,
          created: new Date(session.birthtimeMs).toISOString(),
          updated: new Date(session.mtimeMs).toISOString(),
          prompt: JSON.stringify(session.prompt?.slice(0, 80) ?? ""),
        }));
        const cols = Object.keys(rows[0] ?? {});
        const header = "| " + cols.join(" | ") + " |";
        const divider = "| " + cols.map(() => "---").join(" | ") + " |";
        const body = rows
          .map((row) => "| " + cols.map((col) => (row as Record<string, string>)[col] ?? "").join(" | ") + " |")
          .join("\n");

        console.log(header);
        console.log(divider);
        console.log(body);
        console.log(`\n(${rows.length} rows)`);
      } else {
        console.log("(0 rows)");
      }
    }
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
};

/**
 * extract conversation ids from new files, and exit if the unique session count reaches limitCount.
 */
async function extractSessionsWithLimit({
  rootDir,
  since,
  workDir,
  limitCount,
}: {
  rootDir: string;
  since: number;
  workDir: string;
  limitCount: number;
}): Promise<Session[]> {
  const sessions: Session[] = [];
  const targetWorkDirSet = new Set(getAncestors(workDir));

  for await (const { filename, stat } of sessionFilesByNewest(rootDir)) {
    const session = await parseSessionFile({
      source: { filename, stat },
      since,
      targetWorkDirSet,
    });

    if (session) {
      sessions.push(session);
    }

    if (sessions.length >= limitCount) {
      break;
    }
  }

  return sessions;

  function getAncestors(dir: string): string[] {
    const ancestors: string[] = [];
    let current = dir;
    while (true) {
      ancestors.push(current);
      const parent = path.dirname(current);
      if (parent === current) break;
      current = parent;
    }
    return ancestors;
  }
}

/**
 * yield files under ~/.codex/sessions/{YYYY}/{MM}/{DD} in descending order of mtime.
 * fails if the hierarchy is broken.
 */
async function* sessionFilesByNewest(root: string): AsyncGenerator<SessionFileInfo> {
  const yearDirs = await safeListDirs(root, /^\d{4}$/);
  if (yearDirs.length === 0) {
    throw new Error(`No year directories found in "${root}"`);
  }

  // YYYY -> MM -> DD, in descending order
  for (const y of yearDirs.sort((a, b) => Number(b.name) - Number(a.name))) {
    const yPath = path.join(root, y.name);
    const monthDirs = await safeListDirs(yPath, /^(0[1-9]|1[0-2])$/);
    for (const m of monthDirs.sort((a, b) => Number(b.name) - Number(a.name))) {
      const mPath = path.join(yPath, m.name);
      const dayDirs = await safeListDirs(mPath, /^(0[1-9]|[12]\d|3[01])$/);
      for (const d of dayDirs.sort((a, b) => Number(b.name) - Number(a.name))) {
        const dPath = path.join(mPath, d.name);
        const files = await safeListFiles(dPath, /\.jsonl$/);
        const stats = await Promise.all(
          files.map(async (f) => {
            const filename = path.join(dPath, f.name);
            const stat = await fs.stat(filename);
            return { filename, stat };
          }),
        );

        yield* stats.sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);
      }
    }
  }

  async function safeListDirs(dir: string, nameRe: RegExp): Promise<Dirent[]> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      return entries.filter((e) => e.isDirectory() && nameRe.test(e.name));
    } catch {
      return [];
    }
  }

  async function safeListFiles(dir: string, nameRe: RegExp): Promise<Dirent[]> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      return entries.filter((e) => e.isFile() && nameRe.test(e.name));
    } catch {
      return [];
    }
  }
}

async function parseSessionFile({
  source,
  since,
  targetWorkDirSet,
}: {
  source: SessionFileInfo;
  since: number | null;
  targetWorkDirSet: Set<string>;
}): Promise<Session | null> {
  const { filename, stat } = source;
  try {
    if (since != null && stat.mtimeMs < since) {
      return null;
    }

    const buf = await fs.readFile(filename);
    const text = new TextDecoder("utf-8", { fatal: false }).decode(buf);

    let id: string | undefined;
    let sessionCwd: string | undefined;
    let firstPrompt: string | undefined;

    const lines = text.split("\n").filter((line) => line.trim());
    let isJsonl = false;

    for (const line of lines) {
      try {
        const json = JSON.parse(line);
        isJsonl = true;
        if (json.type === "session_meta" && json.payload) {
          id ??= json.payload.id;
          sessionCwd ??= json.payload.cwd;
        }
        firstPrompt ??= extractFirstPrompt(json);
      } catch {
        // break if the first line is not a valid JSON
        if (!isJsonl) {
          console.warn(`Skipped ${filename} because it is not a JSONL file`);
          return null;
        }
      }

      if (sessionCwd && !targetWorkDirSet.has(sessionCwd)) {
        return null;
      }

      if (id && sessionCwd && firstPrompt) {
        return {
          id,
          birthtimeMs: stat.birthtimeMs,
          mtimeMs: stat.mtimeMs,
          prompt: firstPrompt,
        };
      }
    }
  } catch {
    /* ignore */
  }

  return null;
}

function extractFirstPrompt(json: any): string | undefined {
  if (!json) return undefined;

  // Handle JSONL event_msg format
  if (json.type === "event_msg" && json.payload?.type === "user_message" && json.payload?.message) {
    return json.payload.message.trim();
  }

  // Handle response_item format
  if (
    json.type === "response_item" &&
    json.payload?.role === "user" &&
    Array.isArray(json.payload.content)
  ) {
    for (const item of json.payload.content) {
      if (item.type === "input_text" && item.text) {
        // Skip environment context
        if (!item.text.includes("<environment_context>")) {
          return item.text.trim();
        }
      }
    }
  }

  // Handle standard messages array format
  const msgs = json.messages ?? json.session?.messages ?? [];
  if (Array.isArray(msgs)) {
    const firstUser = msgs.find((m: any) => m.role === "user" && typeof m.content === "string");
    return firstUser?.content?.trim();
  }

  return undefined;
}

void main();

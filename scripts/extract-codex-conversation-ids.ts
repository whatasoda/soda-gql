#!/usr/bin/env -S bun run
/**
 * Extract Codex MCP conversationId candidates from ~/.codex/sessions
 *
 * This script scans Codex MCP session data under ~/.codex/sessions and lists possible
 * conversationId values, showing when they were created, last updated, and the first
 * user prompt (for quick context). It is useful when multiple Codex sessions are running
 * concurrently and you want to find the right conversationId to use for a manual MCP call.
 *
 * 🧭 Filtering rules:
 *   - Only includes sessions that are located in the current working directory **or any of its ancestors**.
 *     (This allows you to run the command from any subdirectory of a project and still match its sessions.)
 *   - Skips old files if --since is specified.
 *   - Aggregates results across all matching files (JSON, log, ndjson, etc.).
 *
 * 🧩 Output fields:
 *   - created:   File creation time (when the session first appeared)
 *   - lastSeen:  Most recent modification time of any file containing this ID
 *   - id:        The conversationId itself
 *   - firstPrompt:  The first user message found in that session (truncated to 80 chars)
 *
 * 🧱 Example (human output):
 *   $ bun extract-codex-conversation-ids.ts
 *   #  created              lastSeen              id                                      firstPrompt
 *   1  2025-10-12T18:05:11+09:00  2025-10-12T19:30:02+09:00  3e63c3fb-91b3-4a03-b7d3-af07b4c8e8bb  "codex の ~/.codex/sessions から mcp..."
 *
 * 🧰 Options:
 *   --dir <path>       Override sessions root (default: ~/.codex/sessions)
 *   --limit <n>        Max number of conversationId entries to print (default: 10)
 *   --since <dur>      Only include files modified within a duration (e.g. 30m, 6h, 2d)
 *   --json             Output JSON instead of human-readable text
 *   --files            Include contributing file paths in output
 *   --pattern <regex>  Extra regex pattern for matching conversationIds
 *
 * 🧪 Examples:
 *   # Basic usage
 *   bun extract-codex-conversation-ids.ts
 *
 *   # Show only sessions updated in the last 2 hours
 *   bun extract-codex-conversation-ids.ts --since 2h
 *
 *   # Output JSON for further processing
 *   bun extract-codex-conversation-ids.ts --json
 *
 *   # Include the list of files where each ID was found
 *   bun extract-codex-conversation-ids.ts --files
 *
 *   # Add a custom regex to catch other ID formats
 *   bun extract-codex-conversation-ids.ts --pattern "conv[a-z_-]*id"
 */

import { readdir, readFile, stat } from "node:fs/promises";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { Dirent } from "node:fs";

const args = new Map<string, string | boolean>();
for (let i = 2; i < process.argv.length; i++) {
  const arg = process.argv[i];
  if (arg?.startsWith("--")) {
    const key = arg.slice(2);
    const next = process.argv[i + 1];
    if (!next || next.startsWith("--")) args.set(key, true);
    else { args.set(key, next); i++; }
  }
}

const HOME = os.homedir();
const rootDir = (args.get("dir") as string) ?? path.join(HOME, ".codex", "sessions");
const limit = parseInt((args.get("limit") as string) ?? "10", 10);
const jsonOut = Boolean(args.get("json"));
const includeFiles = Boolean(args.get("files"));
const extraPatternRaw = (args.get("pattern") as string) ?? "";
const since = parseSince((args.get("since") as string) ?? "");

const UUID_RE = /\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}\b/g;
let EXTRA_RE: RegExp | null = null;
if (extraPatternRaw) { try { EXTRA_RE = new RegExp(extraPatternRaw, "g"); } catch {} }

const KEY_NAME_RE = /^(conversation[_-]?id|conv(?:ersation)?[_-]?id|session[_-]?id)$/i;
const LIKELY_FILE_RE = /(session|meta|state|context|run|trace|log|config)\.(json|ndjson|log|txt)$/i;

(async () => {
  try {
    const cwd = process.cwd();
    const ancestors = getAncestors(cwd);

    const files = await walk(rootDir);
    const candidates: Record<string, { count: number; created: number; last: number; files: Set<string>; prompt?: string }> = {};

    for (const file of files) {
      try {
        const st = await stat(file);
        if (!st.isFile()) continue;
        if (since && st.mtimeMs < since) continue;

        const priority = LIKELY_FILE_RE.test(path.basename(file)) ? 2 : 1;
        const buf = await readFile(file);
        const text = safeDecodeUtf8(buf);

        const ids = new Set<string>();
        let firstPrompt: string | undefined;
        let sessionCwd: string | undefined;

        // Handle JSONL files (one JSON object per line)
        const lines = text.split('\n').filter(line => line.trim());
        let isJsonl = false;

        for (const line of lines) {
          try {
            const json = JSON.parse(line);
            isJsonl = true;

            // Extract session cwd and id from session_meta
            if (json.type === 'session_meta' && json.payload) {
              if (json.payload.cwd) sessionCwd = json.payload.cwd;
              if (json.payload.id) ids.add(json.payload.id);
            }

            for (const found of findIdsInJson(json)) ids.add(found);
            if (!firstPrompt) firstPrompt = extractFirstPrompt(json);
          } catch {
            // Not a valid JSON line, skip
          }
        }

        // If not JSONL, try parsing as single JSON
        if (!isJsonl) {
          try {
            const json = JSON.parse(text);
            for (const found of findIdsInJson(json)) ids.add(found);
            if (!firstPrompt) firstPrompt = extractFirstPrompt(json);
            if (json.cwd) sessionCwd = json.cwd;
          } catch {
            // Fall back to regex matching
            for (const m of text.matchAll(UUID_RE)) ids.add(m[0]);
            if (EXTRA_RE) for (const m of text.matchAll(EXTRA_RE)) ids.add(m[0]);
          }
        }

        // Filter by session cwd: only include if session cwd matches current dir or any ancestor
        if (sessionCwd && !ancestors.some(a => sessionCwd === a || sessionCwd.startsWith(a + path.sep))) {
          continue;
        }

        for (const id of ids) {
          const entry = (candidates[id] ??= { count: 0, created: st.birthtimeMs, last: 0, files: new Set(), prompt: undefined });
          entry.count += priority;
          entry.last = Math.max(entry.last, st.mtimeMs);
          entry.created = Math.min(entry.created, st.birthtimeMs || st.mtimeMs);
          entry.files.add(file);
          if (!entry.prompt && firstPrompt) entry.prompt = firstPrompt;
        }
      } catch {}
    }

    const out = Object.entries(candidates)
      .map(([id, v]) => ({ id, count: v.count, created: v.created, last: v.last, files: Array.from(v.files), prompt: v.prompt }))
      .sort((a, b) => b.last - a.last || b.count - a.count)
      .slice(0, limit);

    if (jsonOut) {
      const json = out.map(o => ({
        id: o.id,
        created: new Date(o.created).toISOString(),
        lastSeen: new Date(o.last).toISOString(),
        count: o.count,
        prompt: o.prompt,
        ...(includeFiles ? { files: o.files } : {}),
      }));
      console.log(JSON.stringify(json, null, 2));
    } else {
      console.log(`#  created              lastSeen              id                                      firstPrompt`);
      out.forEach((o, i) => {
        const created = toLocal(o.created);
        const last = toLocal(o.last);
        console.log(`${String(i + 1).padEnd(3)} ${created.padEnd(20)} ${last.padEnd(20)} ${o.id} ${o.prompt ? JSON.stringify(o.prompt.slice(0,80)) : ''}`);
        if (includeFiles) for (const f of o.files.slice(0,5)) console.log('   -', f);
      });
    }
  } catch (e: any) {
    console.error('Error:', e?.message ?? e);
    process.exit(1);
  }
})();

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  async function _walk(d: string) {
    let ents: Dirent[];
    try { ents = await fs.readdir(d, { withFileTypes: true }); } catch { return; }
    for (const ent of ents) {
      const p = path.join(d, ent.name);
      if (ent.isDirectory()) await _walk(p); else if (ent.isFile()) out.push(p);
    }
  }
  await _walk(dir);
  return out;
}

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

function safeDecodeUtf8(buf: Buffer): string {
  return new TextDecoder("utf-8", { fatal: false }).decode(buf);
}

function* findIdsInJson(node: any): Iterable<string> {
  const stack = [node];
  while (stack.length) {
    const cur = stack.pop();
    if (cur == null) continue;
    if (typeof cur === 'string') {
      for (const m of cur.matchAll(UUID_RE)) yield m[0];
      if (EXTRA_RE) for (const m of cur.matchAll(EXTRA_RE)) yield m[0];
    } else if (Array.isArray(cur)) {
      stack.push(...cur);
    } else if (typeof cur === 'object') {
      for (const [k,v] of Object.entries(cur)) {
        if (KEY_NAME_RE.test(k) && typeof v === 'string') {
          for (const m of v.matchAll(UUID_RE)) yield m[0];
        }
        stack.push(v);
      }
    }
  }
}

function extractFirstPrompt(json: any): string | undefined {
  if (!json) return undefined;

  // Handle JSONL event_msg format
  if (json.type === 'event_msg' && json.payload?.type === 'user_message' && json.payload?.message) {
    return json.payload.message.trim();
  }

  // Handle response_item format
  if (json.type === 'response_item' && json.payload?.role === 'user' && Array.isArray(json.payload.content)) {
    for (const item of json.payload.content) {
      if (item.type === 'input_text' && item.text) {
        // Skip environment context
        if (!item.text.includes('<environment_context>')) {
          return item.text.trim();
        }
      }
    }
  }

  // Handle standard messages array format
  const msgs = json.messages ?? json.session?.messages ?? [];
  if (Array.isArray(msgs)) {
    const firstUser = msgs.find((m: any) => m.role === 'user' && typeof m.content === 'string');
    return firstUser?.content?.trim();
  }

  return undefined;
}

function parseSince(s: string): number | 0 {
  if (!s) return 0;
  const m = s.match(/^(\d+)([smhdw])$/i);
  if (!m) return 0;
  const n = parseInt(m[1] ?? "0",10);
  const u = m[2]?.toLowerCase();
  const mult: any = {s:1,m:60,h:3600,d:86400,w:604800};
  return Date.now() - (n*(mult[u!]??0))*1000;
}

function toLocal(ms:number):string{
  const d=new Date(ms);const tz=-d.getTimezoneOffset();const sign=tz>=0?'+':'-';const hh=String(Math.floor(Math.abs(tz)/60)).padStart(2,'0');const mm=String(Math.abs(tz)%60).padStart(2,'0');return d.toISOString().replace('Z',`${sign}${hh}:${mm}`);
}

/**
 * Portable filesystem API that works on both Bun and Node.js
 */

import { once, runtime } from "./runtime";

export interface PortableFS {
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  stat(path: string): Promise<{ mtime: Date; size: number }>;
  rename(oldPath: string, newPath: string): Promise<void>;
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
}

interface FSPromises {
  readFile: (path: string, encoding: string) => Promise<string>;
  writeFile: (path: string, content: string, encoding: string) => Promise<void>;
  access: (path: string) => Promise<void>;
  stat: (path: string) => Promise<{
    mtime: Date;
    size: number;
    isDirectory: () => boolean;
  }>;
  rename: (oldPath: string, newPath: string) => Promise<void>;
  mkdir: (path: string, options?: { recursive?: boolean }) => Promise<void>;
}

// Cache the fs/promises import
const getNodeFS = once(async (): Promise<FSPromises> => {
  const fs = await import("node:fs/promises");
  return fs as FSPromises;
});

export function createPortableFS(): PortableFS {
  if (runtime.isBun) {
    return {
      async readFile(path) {
        const file = Bun.file(path);
        return await file.text();
      },

      async writeFile(path, content) {
        // Bun.write auto-creates parent directories
        await Bun.write(path, content);
      },

      async exists(path) {
        // Bun.file().exists() only works for files, use fs.stat for both files and dirs
        const nodeFS = await getNodeFS();
        try {
          await nodeFS.stat(path);
          return true;
        } catch {
          return false;
        }
      },

      async stat(path) {
        const file = Bun.file(path);
        const size = file.size;
        // Bun doesn't expose mtime directly, use Node fs.stat
        const nodeFS = await getNodeFS();
        const { mtime } = await nodeFS.stat(path);
        return { mtime, size };
      },

      async rename(oldPath, newPath) {
        const nodeFS = await getNodeFS();
        await nodeFS.rename(oldPath, newPath);
      },

      async mkdir(path, options) {
        const nodeFS = await getNodeFS();
        await nodeFS.mkdir(path, options);
      },
    };
  }

  // Node.js implementation
  return {
    async readFile(path) {
      const nodeFS = await getNodeFS();
      return await nodeFS.readFile(path, "utf-8");
    },

    async writeFile(path, content) {
      const nodeFS = await getNodeFS();
      // Auto-create parent directories like Bun.write does
      const pathModule = await import("node:path");
      const dir = pathModule.dirname(path);
      await nodeFS.mkdir(dir, { recursive: true });
      await nodeFS.writeFile(path, content, "utf-8");
    },

    async exists(path) {
      const nodeFS = await getNodeFS();
      try {
        await nodeFS.access(path);
        return true;
      } catch {
        return false;
      }
    },

    async stat(path) {
      const nodeFS = await getNodeFS();
      const stats = await nodeFS.stat(path);
      return { mtime: stats.mtime, size: stats.size };
    },

    async rename(oldPath, newPath) {
      const nodeFS = await getNodeFS();
      await nodeFS.rename(oldPath, newPath);
    },

    async mkdir(path, options) {
      const nodeFS = await getNodeFS();
      await nodeFS.mkdir(path, options);
    },
  };
}

// Singleton to avoid recreating instances
let fsInstance: PortableFS | null = null;

export function getPortableFS(): PortableFS {
  if (!fsInstance) {
    fsInstance = createPortableFS();
  }
  return fsInstance;
}

/**
 * Reset the filesystem singleton for testing
 * @internal
 */
export function __resetPortableFSForTests(): void {
  fsInstance = null;
}

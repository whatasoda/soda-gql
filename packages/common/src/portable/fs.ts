/**
 * Portable filesystem API that works on both Bun and Node.js
 */

import { once, runtime } from "./runtime";

export interface PortableFS {
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  /**
   * Write a file atomically using temp file + rename pattern.
   * This prevents partial/corrupt writes on crash.
   */
  writeFileAtomic(path: string, content: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  stat(path: string): Promise<{ mtime: Date; size: number }>;
  rename(oldPath: string, newPath: string): Promise<void>;
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
  /**
   * Write a file synchronously and atomically using temp file + rename pattern.
   * Safe for use in beforeExit handlers.
   */
  writeFileSyncAtomic(path: string, content: string): void;
  /**
   * Remove a file. Does not throw if file doesn't exist.
   */
  unlink(path: string): Promise<void>;
  /**
   * Remove a file synchronously. Does not throw if file doesn't exist.
   */
  unlinkSync(path: string): void;
  /**
   * Read a file synchronously.
   */
  readFileSync(path: string): string;
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
  unlink: (path: string) => Promise<void>;
}

interface FSSync {
  writeFileSync: (path: string, content: string, encoding: string) => void;
  renameSync: (oldPath: string, newPath: string) => void;
  unlinkSync: (path: string) => void;
  readFileSync: (path: string, encoding: string) => string;
  mkdirSync: (path: string, options?: { recursive?: boolean }) => void;
}

// Cache the fs/promises import
const getNodeFS = once(async (): Promise<FSPromises> => {
  const fs = await import("node:fs/promises");
  return fs as FSPromises;
});

// Cache the sync fs import
let nodeFsSync: FSSync | null = null;
const getNodeFSSync = (): FSSync => {
  if (!nodeFsSync) {
    // Use require for sync loading
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    nodeFsSync = require("node:fs") as FSSync;
  }
  return nodeFsSync;
};

// Cache path module
let pathModule: { dirname: (path: string) => string } | null = null;
const getPathModule = (): { dirname: (path: string) => string } => {
  if (!pathModule) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    pathModule = require("node:path") as { dirname: (path: string) => string };
  }
  return pathModule;
};

/**
 * Generate a unique temp file path for atomic write.
 */
const getTempPath = (targetPath: string): string => {
  return `${targetPath}.${process.pid}.${Date.now()}.tmp`;
};

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

      async writeFileAtomic(path, content) {
        const tempPath = getTempPath(path);
        try {
          await Bun.write(tempPath, content);
          const nodeFS = await getNodeFS();
          await nodeFS.rename(tempPath, path);
        } catch (error) {
          // Clean up temp file on failure
          try {
            const nodeFS = await getNodeFS();
            await nodeFS.unlink(tempPath);
          } catch {
            // Ignore cleanup errors
          }
          throw error;
        }
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

      writeFileSyncAtomic(path, content) {
        const fsSync = getNodeFSSync();
        const pathMod = getPathModule();
        const tempPath = getTempPath(path);

        // Ensure parent directory exists
        const dir = pathMod.dirname(path);
        fsSync.mkdirSync(dir, { recursive: true });

        try {
          fsSync.writeFileSync(tempPath, content, "utf-8");
          fsSync.renameSync(tempPath, path);
        } catch (error) {
          // Clean up temp file on failure
          try {
            fsSync.unlinkSync(tempPath);
          } catch {
            // Ignore cleanup errors
          }
          throw error;
        }
      },

      async unlink(path) {
        const nodeFS = await getNodeFS();
        try {
          await nodeFS.unlink(path);
        } catch (error) {
          // Ignore ENOENT (file not found)
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
            throw error;
          }
        }
      },

      unlinkSync(path) {
        const fsSync = getNodeFSSync();
        try {
          fsSync.unlinkSync(path);
        } catch (error) {
          // Ignore ENOENT (file not found)
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
            throw error;
          }
        }
      },

      readFileSync(path) {
        const fsSync = getNodeFSSync();
        return fsSync.readFileSync(path, "utf-8");
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

    async writeFileAtomic(path, content) {
      const nodeFS = await getNodeFS();
      const pathMod = await import("node:path");
      const dir = pathMod.dirname(path);
      const tempPath = getTempPath(path);

      try {
        await nodeFS.mkdir(dir, { recursive: true });
        await nodeFS.writeFile(tempPath, content, "utf-8");
        await nodeFS.rename(tempPath, path);
      } catch (error) {
        // Clean up temp file on failure
        try {
          await nodeFS.unlink(tempPath);
        } catch {
          // Ignore cleanup errors
        }
        throw error;
      }
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

    writeFileSyncAtomic(path, content) {
      const fsSync = getNodeFSSync();
      const pathMod = getPathModule();
      const tempPath = getTempPath(path);

      // Ensure parent directory exists
      const dir = pathMod.dirname(path);
      fsSync.mkdirSync(dir, { recursive: true });

      try {
        fsSync.writeFileSync(tempPath, content, "utf-8");
        fsSync.renameSync(tempPath, path);
      } catch (error) {
        // Clean up temp file on failure
        try {
          fsSync.unlinkSync(tempPath);
        } catch {
          // Ignore cleanup errors
        }
        throw error;
      }
    },

    async unlink(path) {
      const nodeFS = await getNodeFS();
      try {
        await nodeFS.unlink(path);
      } catch (error) {
        // Ignore ENOENT (file not found)
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
          throw error;
        }
      }
    },

    unlinkSync(path) {
      const fsSync = getNodeFSSync();
      try {
        fsSync.unlinkSync(path);
      } catch (error) {
        // Ignore ENOENT (file not found)
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
          throw error;
        }
      }
    },

    readFileSync(path) {
      const fsSync = getNodeFSSync();
      return fsSync.readFileSync(path, "utf-8");
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

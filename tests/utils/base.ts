import { afterEach, beforeEach } from "bun:test";
import { TestTempDir } from "./index.ts";

/**
 * Base class for test suites with common setup/teardown
 */
export class TestSuite {
  protected tempDir!: TestTempDir;
  private cleanupCallbacks: Array<() => void | Promise<void>> = [];

  /**
   * Initialize the test suite with automatic setup/teardown
   */
  public setup(): void {
    beforeEach(() => {
      this.tempDir = new TestTempDir(this.constructor.name.toLowerCase());
      this.cleanupCallbacks = [];
    });

    afterEach(async () => {
      // Run all cleanup callbacks in reverse order
      for (const cleanup of this.cleanupCallbacks.reverse()) {
        try {
          await cleanup();
        } catch (error) {
          console.error("Cleanup error:", error);
        }
      }
      this.cleanupCallbacks = [];

      // Cleanup temp directory
      if (this.tempDir) {
        this.tempDir.cleanup();
      }
    });
  }

  /**
   * Add a cleanup callback to be run after the test
   */
  protected addCleanup(callback: () => void | Promise<void>): void {
    this.cleanupCallbacks.push(callback);
  }

  /**
   * Write content to a file in the temp directory
   */
  protected async writeTempFile(relativePath: string, content: string): Promise<string> {
    const fullPath = this.tempDir.join(relativePath);
    await Bun.write(fullPath, content);
    return fullPath;
  }

  /**
   * Read content from a file in the temp directory
   */
  protected async readTempFile(relativePath: string): Promise<string> {
    const fullPath = this.tempDir.join(relativePath);
    return Bun.file(fullPath).text();
  }

  /**
   * Check if a file exists in the temp directory
   */
  protected async tempFileExists(relativePath: string): Promise<boolean> {
    const fullPath = this.tempDir.join(relativePath);
    return Bun.file(fullPath).exists();
  }

  /**
   * Get the full path to a file in the temp directory
   */
  protected getTempPath(relativePath = ""): string {
    return relativePath ? this.tempDir.join(relativePath) : this.tempDir.path;
  }
}

/**
 * Create a test suite with automatic setup
 */
export const createTestSuite = <T extends TestSuite>(SuiteClass: new () => T): T => {
  const suite = new SuiteClass();
  suite.setup();
  return suite;
};

/**
 * Utility for managing multiple cleanup callbacks
 */
export class CleanupManager {
  private callbacks: Array<() => void | Promise<void>> = [];

  add(callback: () => void | Promise<void>): void {
    this.callbacks.push(callback);
  }

  async runAll(): Promise<void> {
    for (const callback of this.callbacks.reverse()) {
      try {
        await callback();
      } catch (error) {
        console.error("Cleanup error:", error);
      }
    }
    this.callbacks = [];
  }

  clear(): void {
    this.callbacks = [];
  }
}

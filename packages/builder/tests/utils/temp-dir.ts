import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Temporary directory management for tests
 */
export class TestTempDir {
  private dir: string;

  constructor(prefix: string) {
    this.dir = mkdtempSync(join(tmpdir(), `soda-gql-${prefix}-`));
  }

  get path(): string {
    return this.dir;
  }

  cleanup(): void {
    rmSync(this.dir, { recursive: true, force: true });
  }

  join(...paths: string[]): string {
    return join(this.dir, ...paths);
  }
}

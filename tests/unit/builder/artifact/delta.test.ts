import { describe, expect, test } from "bun:test";
import { createCanonicalId } from "../../../../packages/builder/src/canonical-id/canonical-id";
import type { ChunkDiff, ChunkManifest } from "../../../../packages/builder/src/intermediate-module/chunks";
import { applyArtifactDelta, computeArtifactDelta } from "../../../../packages/builder/src/artifact/delta";
import type { BuilderArtifact, BuilderArtifactElement } from "../../../../packages/builder/src/artifact/types";

const createTestElement = (id: string, type: "model" | "operation" | "slice", data: string): BuilderArtifactElement => {
  const canonicalId = createCanonicalId(`/test/${id}.ts`, id);
  return {
    id: canonicalId,
    type,
    prebuild: { data } as any,
  };
};

const createTestArtifact = (elements: BuilderArtifactElement[]): BuilderArtifact => {
  const elementsRecord: Record<string, BuilderArtifactElement> = {};
  for (const element of elements) {
    elementsRecord[element.id] = element;
  }

  return {
    elements: elementsRecord,
    report: {
      durationMs: 100,
      warnings: [],
      cache: {
        hits: 0,
        misses: 0,
        skips: 0,
      },
    },
  };
};

const emptyChunkDiff: ChunkDiff = {
  added: new Map(),
  updated: new Map(),
  removed: new Set(),
};

const emptyManifest: ChunkManifest = {
  chunks: new Map(),
  version: 1,
};

describe("computeArtifactDelta", () => {
  test("treats everything as added when old artifact is null", () => {
    const element1 = createTestElement("foo", "model", "data1");
    const element2 = createTestElement("bar", "operation", "data2");
    const newArtifact = createTestArtifact([element1, element2]);

    const delta = computeArtifactDelta(null, newArtifact, emptyChunkDiff, emptyManifest);

    expect(Object.keys(delta.added)).toHaveLength(2);
    expect(delta.added[element1.id]).toBe(element1);
    expect(delta.added[element2.id]).toBe(element2);
    expect(Object.keys(delta.updated)).toHaveLength(0);
    expect(delta.removed.size).toBe(0);
  });

  test("detects added elements", () => {
    const element1 = createTestElement("foo", "model", "data1");
    const element2 = createTestElement("bar", "operation", "data2");

    const oldArtifact = createTestArtifact([element1]);
    const newArtifact = createTestArtifact([element1, element2]);

    const delta = computeArtifactDelta(oldArtifact, newArtifact, emptyChunkDiff, emptyManifest);

    expect(Object.keys(delta.added)).toHaveLength(1);
    expect(delta.added[element2.id]).toBe(element2);
    expect(Object.keys(delta.updated)).toHaveLength(0);
    expect(delta.removed.size).toBe(0);
  });

  test("detects updated elements", () => {
    const element1 = createTestElement("foo", "model", "data1");
    const element1Updated = createTestElement("foo", "model", "data1-updated");

    const oldArtifact = createTestArtifact([element1]);
    const newArtifact = createTestArtifact([element1Updated]);

    const delta = computeArtifactDelta(oldArtifact, newArtifact, emptyChunkDiff, emptyManifest);

    expect(Object.keys(delta.added)).toHaveLength(0);
    expect(Object.keys(delta.updated)).toHaveLength(1);
    expect(delta.updated[element1Updated.id]).toBe(element1Updated);
    expect(delta.removed.size).toBe(0);
  });

  test("detects removed elements", () => {
    const element1 = createTestElement("foo", "model", "data1");
    const element2 = createTestElement("bar", "operation", "data2");

    const oldArtifact = createTestArtifact([element1, element2]);
    const newArtifact = createTestArtifact([element1]);

    const delta = computeArtifactDelta(oldArtifact, newArtifact, emptyChunkDiff, emptyManifest);

    expect(Object.keys(delta.added)).toHaveLength(0);
    expect(Object.keys(delta.updated)).toHaveLength(0);
    expect(delta.removed.size).toBe(1);
    expect(delta.removed.has(element2.id)).toBe(true);
  });

  test("handles complex delta with all operations", () => {
    const element1 = createTestElement("foo", "model", "data1");
    const element2 = createTestElement("bar", "operation", "data2");
    const element3 = createTestElement("baz", "slice", "data3");

    const element1Updated = createTestElement("foo", "model", "data1-updated");
    const element4 = createTestElement("qux", "model", "data4");

    const oldArtifact = createTestArtifact([element1, element2, element3]);
    const newArtifact = createTestArtifact([element1Updated, element3, element4]);

    const delta = computeArtifactDelta(oldArtifact, newArtifact, emptyChunkDiff, emptyManifest);

    expect(delta.added[element4.id]).toBe(element4);
    expect(delta.updated[element1Updated.id]).toBe(element1Updated);
    expect(delta.removed.has(element2.id)).toBe(true);
    expect(delta.removed.size).toBe(1);
  });

  test("no changes produces empty delta", () => {
    const element1 = createTestElement("foo", "model", "data1");
    const oldArtifact = createTestArtifact([element1]);
    const newArtifact = createTestArtifact([element1]);

    const delta = computeArtifactDelta(oldArtifact, newArtifact, emptyChunkDiff, emptyManifest);

    expect(Object.keys(delta.added)).toHaveLength(0);
    expect(Object.keys(delta.updated)).toHaveLength(0);
    expect(delta.removed.size).toBe(0);
  });

  test("includes chunk diff and manifest", () => {
    const element1 = createTestElement("foo", "model", "data1");
    const artifact = createTestArtifact([element1]);

    const chunkDiff: ChunkDiff = {
      added: new Map([["chunk1", {} as any]]),
      updated: new Map(),
      removed: new Set(),
    };

    const manifest: ChunkManifest = {
      chunks: new Map([["chunk1", {} as any]]),
      version: 2,
    };

    const delta = computeArtifactDelta(null, artifact, chunkDiff, manifest);

    expect(delta.chunks).toBe(chunkDiff);
    expect(delta.manifest).toBe(manifest);
    expect(delta.manifest.version).toBe(2);
  });
});

describe("applyArtifactDelta", () => {
  test("applies additions", () => {
    const element1 = createTestElement("foo", "model", "data1");
    const element2 = createTestElement("bar", "operation", "data2");
    const baseArtifact = createTestArtifact([element1]);

    const delta = computeArtifactDelta(baseArtifact, createTestArtifact([element1, element2]), emptyChunkDiff, emptyManifest);

    const result = applyArtifactDelta(baseArtifact, delta);

    expect(Object.keys(result.elements)).toHaveLength(2);
    expect(result.elements[element1.id]).toBe(element1);
    expect(result.elements[element2.id]).toBe(element2);
  });

  test("applies updates", () => {
    const element1 = createTestElement("foo", "model", "data1");
    const element1Updated = createTestElement("foo", "model", "data1-updated");
    const baseArtifact = createTestArtifact([element1]);

    const delta = computeArtifactDelta(baseArtifact, createTestArtifact([element1Updated]), emptyChunkDiff, emptyManifest);

    const result = applyArtifactDelta(baseArtifact, delta);

    expect(Object.keys(result.elements)).toHaveLength(1);
    const updatedElement = result.elements[element1Updated.id];
    expect(updatedElement).toBe(element1Updated);
    expect(updatedElement?.prebuild).toEqual(expect.objectContaining({ data: "data1-updated" }));
  });

  test("applies removals", () => {
    const element1 = createTestElement("foo", "model", "data1");
    const element2 = createTestElement("bar", "operation", "data2");
    const baseArtifact = createTestArtifact([element1, element2]);

    const delta = computeArtifactDelta(baseArtifact, createTestArtifact([element1]), emptyChunkDiff, emptyManifest);

    const result = applyArtifactDelta(baseArtifact, delta);

    expect(Object.keys(result.elements)).toHaveLength(1);
    expect(result.elements[element1.id]).toBe(element1);
    expect(result.elements[element2.id]).toBeUndefined();
  });

  test("applies complex delta", () => {
    const element1 = createTestElement("foo", "model", "data1");
    const element2 = createTestElement("bar", "operation", "data2");
    const element3 = createTestElement("baz", "slice", "data3");

    const element1Updated = createTestElement("foo", "model", "data1-updated");
    const element4 = createTestElement("qux", "model", "data4");

    const baseArtifact = createTestArtifact([element1, element2, element3]);
    const newArtifact = createTestArtifact([element1Updated, element3, element4]);

    const delta = computeArtifactDelta(baseArtifact, newArtifact, emptyChunkDiff, emptyManifest);
    const result = applyArtifactDelta(baseArtifact, delta);

    expect(Object.keys(result.elements)).toHaveLength(3);
    expect(result.elements[element1Updated.id]).toBe(element1Updated);
    expect(result.elements[element3.id]).toBe(element3);
    expect(result.elements[element4.id]).toBe(element4);
    expect(result.elements[element2.id]).toBeUndefined();
  });
});

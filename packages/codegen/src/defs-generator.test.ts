import { describe, expect, test } from "bun:test";
import {
  chunkArray,
  type DefinitionVar,
  generateChunkedDefinitionFiles,
  generateChunkFile,
  generateChunkIndex,
  generateDefinitionFile,
  generateDefsStructure,
  needsChunking,
} from "./defs-generator";

describe("chunkArray", () => {
  test("splits array into chunks of specified size", () => {
    const array = [1, 2, 3, 4, 5, 6, 7];
    const result = chunkArray(array, 3);
    expect(result).toEqual([[1, 2, 3], [4, 5, 6], [7]]);
  });

  test("returns single chunk when array is smaller than chunk size", () => {
    const array = [1, 2, 3];
    const result = chunkArray(array, 5);
    expect(result).toEqual([[1, 2, 3]]);
  });

  test("returns empty array for empty input", () => {
    const result = chunkArray([], 3);
    expect(result).toEqual([]);
  });

  test("handles chunk size of 1", () => {
    const array = [1, 2, 3];
    const result = chunkArray(array, 1);
    expect(result).toEqual([[1], [2], [3]]);
  });

  test("returns single chunk for non-positive chunk size", () => {
    const array = [1, 2, 3];
    expect(chunkArray(array, 0)).toEqual([[1, 2, 3]]);
    expect(chunkArray(array, -1)).toEqual([[1, 2, 3]]);
    expect(chunkArray(array, -100)).toEqual([[1, 2, 3]]);
  });
});

describe("needsChunking", () => {
  test("returns true when vars exceed chunk size", () => {
    const vars: DefinitionVar[] = Array.from({ length: 5 }, (_, i) => ({
      name: `var_${i}`,
      code: `const var_${i} = {};`,
    }));
    expect(needsChunking(vars, 3)).toBe(true);
  });

  test("returns false when vars equal chunk size", () => {
    const vars: DefinitionVar[] = Array.from({ length: 3 }, (_, i) => ({
      name: `var_${i}`,
      code: `const var_${i} = {};`,
    }));
    expect(needsChunking(vars, 3)).toBe(false);
  });

  test("returns false when vars are less than chunk size", () => {
    const vars: DefinitionVar[] = [{ name: "var_0", code: "const var_0 = {};" }];
    expect(needsChunking(vars, 3)).toBe(false);
  });
});

describe("generateDefinitionFile", () => {
  test("generates file for enums with defineEnum import", () => {
    const vars: DefinitionVar[] = [
      {
        name: "enum_default_Status",
        code: 'const enum_default_Status = defineEnum<"Status", "ACTIVE" | "INACTIVE">("Status", { ACTIVE: true, INACTIVE: true });',
      },
    ];
    const result = generateDefinitionFile({
      category: "enums",
      schemaName: "default",
      vars,
      needsDefineEnum: true,
    });

    expect(result).toContain('import { defineEnum } from "@soda-gql/core";');
    expect(result).toContain("export const enum_default_Status");
  });

  test("generates file for objects without defineEnum import", () => {
    const vars: DefinitionVar[] = [
      { name: "object_default_User", code: 'const object_default_User = { name: "User", fields: {} } as const;' },
    ];
    const result = generateDefinitionFile({
      category: "objects",
      schemaName: "default",
      vars,
      needsDefineEnum: false,
    });

    expect(result).not.toContain("defineEnum");
    expect(result).toContain("export const object_default_User");
  });

  test("generates empty file comment for empty vars", () => {
    const result = generateDefinitionFile({
      category: "inputs",
      schemaName: "default",
      vars: [],
      needsDefineEnum: false,
    });

    expect(result).toContain("inputs definitions (empty)");
  });
});

describe("generateChunkFile", () => {
  test("generates chunk file with correct header", () => {
    const vars: DefinitionVar[] = [
      { name: "object_default_User", code: 'const object_default_User = { name: "User", fields: {} } as const;' },
    ];
    const result = generateChunkFile({
      category: "objects",
      schemaName: "default",
      vars,
      chunkIndex: 2,
      needsDefineEnum: false,
    });

    expect(result).toContain("objects chunk 2");
    expect(result).toContain("export const object_default_User");
  });

  test("includes defineEnum import for enum chunks", () => {
    const vars: DefinitionVar[] = [
      {
        name: "enum_default_Status",
        code: 'const enum_default_Status = defineEnum<"Status", "ACTIVE">("Status", { ACTIVE: true });',
      },
    ];
    const result = generateChunkFile({
      category: "enums",
      schemaName: "default",
      vars,
      chunkIndex: 0,
      needsDefineEnum: true,
    });

    expect(result).toContain('import { defineEnum } from "@soda-gql/core";');
  });
});

describe("generateChunkIndex", () => {
  test("generates index with re-exports for all chunks", () => {
    const result = generateChunkIndex({
      category: "objects",
      chunkCount: 3,
      varNames: ["object_default_User", "object_default_Post", "object_default_Comment"],
    });

    expect(result).toContain('export * from "./chunk-0";');
    expect(result).toContain('export * from "./chunk-1";');
    expect(result).toContain('export * from "./chunk-2";');
  });
});

describe("generateChunkedDefinitionFiles", () => {
  test("generates correct number of chunks", () => {
    const vars: DefinitionVar[] = Array.from({ length: 7 }, (_, i) => ({
      name: `object_default_Type${i}`,
      code: `const object_default_Type${i} = { name: "Type${i}", fields: {} } as const;`,
    }));

    const result = generateChunkedDefinitionFiles("objects", "default", vars, 3);

    expect(result.chunks).toHaveLength(3);
    expect(result.chunks[0]?.varNames).toHaveLength(3);
    expect(result.chunks[1]?.varNames).toHaveLength(3);
    expect(result.chunks[2]?.varNames).toHaveLength(1);
  });

  test("generates index file with correct re-exports", () => {
    const vars: DefinitionVar[] = Array.from({ length: 5 }, (_, i) => ({
      name: `object_default_Type${i}`,
      code: `const object_default_Type${i} = { name: "Type${i}", fields: {} } as const;`,
    }));

    const result = generateChunkedDefinitionFiles("objects", "default", vars, 3);

    expect(result.indexContent).toContain('export * from "./chunk-0";');
    expect(result.indexContent).toContain('export * from "./chunk-1";');
  });
});

describe("generateDefsStructure", () => {
  test("generates single files when vars are under chunk size", () => {
    const categoryVars = {
      enums: [
        {
          name: "enum_default_Status",
          code: 'const enum_default_Status = defineEnum<"Status", "ACTIVE">("Status", { ACTIVE: true });',
        },
      ],
      inputs: [],
      objects: [{ name: "object_default_User", code: 'const object_default_User = { name: "User", fields: {} } as const;' }],
      unions: [],
    };

    const result = generateDefsStructure("default", categoryVars, 100);

    expect(result.files.some((f) => f.relativePath === "_defs/enums.ts")).toBe(true);
    expect(result.files.some((f) => f.relativePath === "_defs/objects.ts")).toBe(true);
  });

  test("generates chunked files when vars exceed chunk size", () => {
    const objects: DefinitionVar[] = Array.from({ length: 5 }, (_, i) => ({
      name: `object_default_Type${i}`,
      code: `const object_default_Type${i} = { name: "Type${i}", fields: {} } as const;`,
    }));

    const categoryVars = {
      enums: [],
      inputs: [],
      objects,
      unions: [],
    };

    const result = generateDefsStructure("default", categoryVars, 2);

    expect(result.files.some((f) => f.relativePath === "_defs/objects/index.ts")).toBe(true);
    expect(result.files.some((f) => f.relativePath === "_defs/objects/chunk-0.ts")).toBe(true);
    expect(result.files.some((f) => f.relativePath === "_defs/objects/chunk-1.ts")).toBe(true);
    expect(result.files.some((f) => f.relativePath === "_defs/objects/chunk-2.ts")).toBe(true);
  });

  test("import paths are correct for non-chunked categories", () => {
    const categoryVars = {
      enums: [{ name: "enum_default_Status", code: "const enum_default_Status = {};" }],
      inputs: [],
      objects: [],
      unions: [],
    };

    const result = generateDefsStructure("default", categoryVars, 100);

    expect(result.importPaths.enums).toBe("./_defs/enums");
  });
});

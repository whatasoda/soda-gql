import { describe, expect, it } from "bun:test";
import type { CanonicalId } from "@soda-gql/common";
import type { FieldSelectionData } from "@soda-gql/builder";
import { mergeSelections } from "./runner";

const baseDir = "/project";

const makeFragmentSelection = (
  key: string,
  typename: string,
  fields: Record<string, unknown>,
): FieldSelectionData =>
  ({
    type: "fragment",
    schemaLabel: "default",
    key,
    typename,
    fields,
    variableDefinitions: {},
  }) as FieldSelectionData;

const makeOperationSelection = (
  operationName: string,
  operationType: string,
  fields: Record<string, unknown>,
): FieldSelectionData =>
  ({
    type: "operation",
    schemaLabel: "default",
    operationName,
    operationType,
    fields,
    variableDefinitions: [],
  }) as FieldSelectionData;

describe("mergeSelections", () => {
  it("uses builder selections when both scanners find the same fragment", () => {
    const builderSelections = new Map<CanonicalId, FieldSelectionData>([
      [
        "src/fragments.ts::MyFragment" as CanonicalId,
        makeFragmentSelection("MyFragment", "User", { id: "field", name: "field" }),
      ],
    ]);

    const templateSelections = new Map<CanonicalId, FieldSelectionData>([
      [
        "/project/src/fragments.ts::MyFragment" as CanonicalId,
        makeFragmentSelection("MyFragment", "User", {}), // empty — spread not resolved
      ],
    ]);

    const result = mergeSelections(builderSelections, templateSelections, baseDir);

    expect(result.size).toBe(1);
    const entry = [...result.values()][0]!;
    expect(entry.type).toBe("fragment");
    expect(Object.keys((entry as { fields: Record<string, unknown> }).fields)).toEqual(["id", "name"]);
  });

  it("includes template-only elements as fallback", () => {
    const builderSelections = new Map<CanonicalId, FieldSelectionData>();

    const templateSelections = new Map<CanonicalId, FieldSelectionData>([
      [
        "/project/src/extra.ts::ExtraFragment" as CanonicalId,
        makeFragmentSelection("ExtraFragment", "Post", { title: "field" }),
      ],
    ]);

    const result = mergeSelections(builderSelections, templateSelections, baseDir);

    expect(result.size).toBe(1);
    const entry = [...result.values()][0]!;
    expect(entry.type).toBe("fragment");
    expect((entry as { key: string }).key).toBe("ExtraFragment");
  });

  it("preserves builder operations not found by template scanner", () => {
    const builderSelections = new Map<CanonicalId, FieldSelectionData>([
      [
        "src/ops.ts::GetUser" as CanonicalId,
        makeOperationSelection("GetUser", "query", { user: "field" }),
      ],
    ]);

    const templateSelections = new Map<CanonicalId, FieldSelectionData>();

    const result = mergeSelections(builderSelections, templateSelections, baseDir);

    expect(result.size).toBe(1);
    const entry = [...result.values()][0]!;
    expect(entry.type).toBe("operation");
  });

  it("preserves builder operations when template scanner finds fragments from the same file", () => {
    const builderSelections = new Map<CanonicalId, FieldSelectionData>([
      [
        "src/mixed.ts::GetUser" as CanonicalId,
        makeOperationSelection("GetUser", "query", { user: "field" }),
      ],
      [
        "src/mixed.ts::UserFields" as CanonicalId,
        makeFragmentSelection("UserFields", "User", { id: "field", name: "field" }),
      ],
    ]);

    const templateSelections = new Map<CanonicalId, FieldSelectionData>([
      [
        "/project/src/mixed.ts::UserFields" as CanonicalId,
        makeFragmentSelection("UserFields", "User", {}), // empty — spread not resolved
      ],
    ]);

    const result = mergeSelections(builderSelections, templateSelections, baseDir);

    // Both operation and fragment should be present, using builder versions
    expect(result.size).toBe(2);

    const entries = [...result.values()];
    const operation = entries.find((e) => e.type === "operation")!;
    const fragment = entries.find((e) => e.type === "fragment")!;

    expect((operation as { operationName: string }).operationName).toBe("GetUser");
    expect(Object.keys((fragment as { fields: Record<string, unknown> }).fields)).toEqual(["id", "name"]);
  });
});

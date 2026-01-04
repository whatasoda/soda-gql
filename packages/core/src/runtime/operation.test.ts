import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { type DocumentNode, Kind } from "graphql";
import { createRuntimeOperation, type RuntimeOperationInput } from "./operation";
import { __getRegisteredOperations, __resetRuntimeRegistry } from "./runtime-registry";

describe("createRuntimeOperation", () => {
  beforeEach(() => {
    __resetRuntimeRegistry();
  });

  afterEach(() => {
    __resetRuntimeRegistry();
  });

  const createMockDocument = (): DocumentNode => ({
    kind: Kind.DOCUMENT,
    definitions: [],
  });

  const createMockInput = (overrides?: Partial<RuntimeOperationInput["prebuild"]>): RuntimeOperationInput => ({
    prebuild: {
      operationType: "query",
      operationName: "TestQuery",
      variableNames: [],
      document: createMockDocument(),
      metadata: null,
      ...overrides,
    },
    runtime: {},
  });

  test("creates operation with correct properties", () => {
    const input = createMockInput();

    const operation = createRuntimeOperation(input);

    expect(operation.operationType).toBe("query");
    expect(operation.operationName).toBe("TestQuery");
    expect(operation.variableNames).toEqual([]);
    expect(operation.document).toEqual(createMockDocument());
    expect(operation.metadata).toBeNull();
  });

  test("creates operation with mutation type", () => {
    const input = createMockInput({
      operationType: "mutation",
      operationName: "CreateUser",
    });

    const operation = createRuntimeOperation(input);

    expect(operation.operationType).toBe("mutation");
    expect(operation.operationName).toBe("CreateUser");
  });

  test("creates operation with subscription type", () => {
    const input = createMockInput({
      operationType: "subscription",
      operationName: "OnUserCreated",
    });

    const operation = createRuntimeOperation(input);

    expect(operation.operationType).toBe("subscription");
  });

  test("preserves variable names", () => {
    const input = createMockInput({
      variableNames: ["userId", "limit", "offset"],
    });

    const operation = createRuntimeOperation(input);

    expect(operation.variableNames).toEqual(["userId", "limit", "offset"]);
  });

  test("preserves metadata", () => {
    const metadata = { custom: "value", nested: { data: 123 } };
    const input = createMockInput({ metadata });

    const operation = createRuntimeOperation(input);

    expect(operation.metadata).toEqual(metadata);
  });

  test("registers operation in registry", () => {
    const input = createMockInput({ operationName: "RegisteredQuery" });

    createRuntimeOperation(input);

    const registered = __getRegisteredOperations();
    expect(registered.has("RegisteredQuery")).toBe(true);
  });

  test("returns the registered operation", () => {
    const input = createMockInput({ operationName: "ReturnedQuery" });

    const operation = createRuntimeOperation(input);

    const registered = __getRegisteredOperations().get("ReturnedQuery");
    expect(registered).toBe(operation);
  });

  test("has hidden documentSource", () => {
    const input = createMockInput();

    const operation = createRuntimeOperation(input);

    // documentSource should be a hidden value (function that throws or returns empty)
    expect(typeof operation.documentSource).toBe("function");
  });

  test("creates multiple operations with different names", () => {
    const input1 = createMockInput({ operationName: "Query1" });
    const input2 = createMockInput({ operationName: "Query2" });

    createRuntimeOperation(input1);
    createRuntimeOperation(input2);

    const registered = __getRegisteredOperations();
    expect(registered.size).toBe(2);
    expect(registered.has("Query1")).toBe(true);
    expect(registered.has("Query2")).toBe(true);
  });

  describe("attach", () => {
    test("attaches single property", () => {
      const input = createMockInput();

      const operation = createRuntimeOperation(input);
      const attached = operation.attach({
        name: "custom",
        createValue: () => ({ value: 42 }),
      });

      expect((attached as { custom: { value: number } }).custom.value).toBe(42);
    });

    test("attaches multiple properties from array", () => {
      const input = createMockInput();

      const operation = createRuntimeOperation(input);
      const attached = operation.attach([
        { name: "first", createValue: () => ({ a: 1 }) },
        { name: "second", createValue: () => ({ b: 2 }) },
      ]);

      expect((attached as { first: { a: number } }).first.a).toBe(1);
      expect((attached as { second: { b: number } }).second.b).toBe(2);
    });

    test("returns same operation reference", () => {
      const input = createMockInput();

      const operation = createRuntimeOperation(input);
      const attached = operation.attach({ name: "test", createValue: () => ({ x: 1 }) });

      expect(attached === operation).toBe(true);
    });

    test("handles empty array", () => {
      const input = createMockInput();

      const operation = createRuntimeOperation(input);
      const attached = operation.attach([]);

      expect(attached).toBe(operation);
    });
  });
});

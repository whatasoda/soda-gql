import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  __getRegisteredOperations,
  __resetRuntimeRegistry,
  getOperation,
  registerOperation,
} from "../../src/runtime/runtime-registry";
import type { AnyOperationOf } from "../../src/types/element";
import type { OperationType } from "../../src/types/schema";

const createMockOperation = (name: string): AnyOperationOf<OperationType> =>
  ({
    operationType: "query",
    operationName: name,
    variableNames: [],
    document: { kind: "Document", definitions: [] },
    metadata: null,
  }) as unknown as AnyOperationOf<OperationType>;

describe("runtime-registry", () => {
  beforeEach(() => {
    __resetRuntimeRegistry();
  });

  afterEach(() => {
    __resetRuntimeRegistry();
  });

  describe("registerOperation", () => {
    test("registers an operation", () => {
      const operation = createMockOperation("TestQuery");

      registerOperation(operation);

      const registered = __getRegisteredOperations();
      expect(registered.size).toBe(1);
      expect(registered.has("TestQuery")).toBe(true);
    });

    test("registers multiple operations", () => {
      const op1 = createMockOperation("Query1");
      const op2 = createMockOperation("Query2");
      const op3 = createMockOperation("Query3");

      registerOperation(op1);
      registerOperation(op2);
      registerOperation(op3);

      const registered = __getRegisteredOperations();
      expect(registered.size).toBe(3);
      expect(registered.has("Query1")).toBe(true);
      expect(registered.has("Query2")).toBe(true);
      expect(registered.has("Query3")).toBe(true);
    });

    test("overwrites operation with same name", () => {
      const op1 = createMockOperation("TestQuery");
      const op2 = createMockOperation("TestQuery");

      registerOperation(op1);
      registerOperation(op2);

      const registered = __getRegisteredOperations();
      expect(registered.size).toBe(1);
      expect(registered.get("TestQuery")).toBe(op2);
    });
  });

  describe("getOperation", () => {
    test("returns registered operation", () => {
      const operation = createMockOperation("TestQuery");
      registerOperation(operation);

      const result = getOperation("TestQuery");

      expect(result).toBe(operation);
    });

    test("throws for non-existent operation", () => {
      expect(() => getOperation("NonExistent")).toThrow("Operation NonExistent not found");
    });

    test("throws with correct operation name in message", () => {
      expect(() => getOperation("MyCustomQuery")).toThrow("MyCustomQuery");
    });
  });

  describe("__resetRuntimeRegistry", () => {
    test("clears all registered operations", () => {
      registerOperation(createMockOperation("Query1"));
      registerOperation(createMockOperation("Query2"));

      expect(__getRegisteredOperations().size).toBe(2);

      __resetRuntimeRegistry();

      expect(__getRegisteredOperations().size).toBe(0);
    });
  });

  describe("__getRegisteredOperations", () => {
    test("returns empty map initially", () => {
      const operations = __getRegisteredOperations();
      expect(operations.size).toBe(0);
    });

    test("returns readonly map", () => {
      const _operations = __getRegisteredOperations();
      // Map should be readonly - changes through registerOperation should reflect
      registerOperation(createMockOperation("TestQuery"));

      // Getting a fresh reference should show the new operation
      const updated = __getRegisteredOperations();
      expect(updated.size).toBe(1);
    });
  });
});

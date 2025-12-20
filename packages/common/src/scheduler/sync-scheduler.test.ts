import { describe, expect, it } from "bun:test";
import { createSyncScheduler, Effect, Effects, PureEffect } from "@soda-gql/common";

describe("createSyncScheduler", () => {
  it("should execute pure effects and return the final value", () => {
    const scheduler = createSyncScheduler();

    const result = scheduler.run(function* () {
      const a = yield* new PureEffect(1).run();
      const b = yield* new PureEffect(2).run();
      return a + b;
    });

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toBe(3);
  });

  it("should also work with Effects factory", () => {
    const scheduler = createSyncScheduler();

    const result = scheduler.run(function* () {
      const a = yield* Effects.pure(1).run();
      const b = yield* Effects.pure(2).run();
      return a + b;
    });

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toBe(3);
  });

  it("should handle parallel effects sequentially", () => {
    const scheduler = createSyncScheduler();

    const result = scheduler.run(function* () {
      const results = yield* Effects.parallel([Effects.pure(1), Effects.pure(2), Effects.pure(3)]).run();
      return results;
    });

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toEqual([1, 2, 3]);
  });

  it("should throw error for defer effects", () => {
    const scheduler = createSyncScheduler();

    const result = scheduler.run(function* () {
      yield* Effects.defer(Promise.resolve(42)).run();
      return 0;
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().message).toContain("DeferEffect is not supported in sync scheduler");
  });

  it("should throw error for yield effects", () => {
    const scheduler = createSyncScheduler();

    const result = scheduler.run(function* () {
      yield* Effects.yield().run();
      return 0;
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().message).toContain("YieldEffect is not supported in sync scheduler");
  });

  it("should handle nested parallel effects", () => {
    const scheduler = createSyncScheduler();

    const result = scheduler.run(function* () {
      const results = yield* Effects.parallel([
        Effects.pure([1, 2]),
        Effects.parallel([Effects.pure(3), Effects.pure(4)]),
      ]).run();
      return results;
    });

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });

  it("should catch and return errors thrown in generator", () => {
    const scheduler = createSyncScheduler();

    const result = scheduler.run(function* () {
      yield* Effects.pure(1).run();
      throw new Error("Test error");
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().message).toBe("Test error");
  });

  it("should support custom effect classes", () => {
    class CustomEffect extends Effect<string> {
      constructor(readonly customValue: string) {
        super();
      }
      protected _executeSync(): string {
        return `processed: ${this.customValue}`;
      }
      protected _executeAsync(): Promise<string> {
        return Promise.resolve(`processed: ${this.customValue}`);
      }
    }

    const scheduler = createSyncScheduler();

    const result = scheduler.run(function* () {
      const value = yield* new CustomEffect("test").run();
      return value;
    });

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toBe("processed: test");
  });

  it("should reject custom effect that returns Promise in executeSync", () => {
    class AsyncOnlyEffect extends Effect<number> {
      protected _executeSync(): number {
        throw new Error("AsyncOnlyEffect requires async scheduler");
      }
      protected _executeAsync(): Promise<number> {
        return Promise.resolve(42);
      }
    }

    const scheduler = createSyncScheduler();

    const result = scheduler.run(function* () {
      yield* new AsyncOnlyEffect().run();
      return 0;
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().message).toContain("AsyncOnlyEffect requires async scheduler");
  });
});

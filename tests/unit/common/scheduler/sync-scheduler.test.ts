import { describe, expect, it } from "bun:test";
import { createSyncScheduler, Effects } from "@soda-gql/common";

describe("createSyncScheduler", () => {
  it("should execute pure effects and return the final value", () => {
    const scheduler = createSyncScheduler();

    const result = scheduler.run(function* () {
      const a = yield Effects.pure(1);
      const b = yield Effects.pure(2);
      return (a as number) + (b as number);
    });

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toBe(3);
  });

  it("should handle parallel effects sequentially", () => {
    const scheduler = createSyncScheduler();
    const order: number[] = [];

    const result = scheduler.run(function* () {
      const results = yield Effects.parallel([Effects.pure(1), Effects.pure(2), Effects.pure(3)]);
      return results;
    });

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toEqual([1, 2, 3]);
  });

  it("should throw error for defer effects", () => {
    const scheduler = createSyncScheduler();

    const result = scheduler.run(function* () {
      yield Effects.defer(Promise.resolve(42));
      return 0;
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().message).toContain("DeferEffect is not supported in sync scheduler");
  });

  it("should throw error for yield effects", () => {
    const scheduler = createSyncScheduler();

    const result = scheduler.run(function* () {
      yield Effects.yield();
      return 0;
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().message).toContain("YieldEffect is not supported in sync scheduler");
  });

  it("should handle nested parallel effects", () => {
    const scheduler = createSyncScheduler();

    const result = scheduler.run(function* () {
      const outer = yield Effects.parallel([
        Effects.pure([1, 2]),
        Effects.parallel([Effects.pure(3), Effects.pure(4)]),
      ]);
      return outer;
    });

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toEqual([[1, 2], [3, 4]]);
  });

  it("should catch and return errors thrown in generator", () => {
    const scheduler = createSyncScheduler();

    const result = scheduler.run(function* () {
      yield Effects.pure(1);
      throw new Error("Test error");
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().message).toBe("Test error");
  });

  it("should support custom effect handlers", () => {
    type CustomEffect = { readonly kind: "custom"; readonly value: string };

    const customHandler = {
      canHandle: (effect: { readonly kind: string }): effect is CustomEffect =>
        effect.kind === "custom",
      handle: (effect: CustomEffect) => `processed: ${effect.value}`,
    };

    const scheduler = createSyncScheduler({ handlers: [customHandler] });

    const result = scheduler.run(function* () {
      const result = yield { kind: "custom", value: "test" } satisfies CustomEffect;
      return result;
    });

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toBe("processed: test");
  });

  it("should reject custom handler that returns Promise", () => {
    type AsyncCustomEffect = { readonly kind: "async-custom" };

    const asyncHandler = {
      canHandle: (effect: { readonly kind: string }): effect is AsyncCustomEffect =>
        effect.kind === "async-custom",
      handle: (_effect: AsyncCustomEffect) => Promise.resolve(42),
    };

    const scheduler = createSyncScheduler({ handlers: [asyncHandler] });

    const result = scheduler.run(function* () {
      yield { kind: "async-custom" } satisfies AsyncCustomEffect;
      return 0;
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().message).toContain("returned a Promise in sync scheduler");
  });
});

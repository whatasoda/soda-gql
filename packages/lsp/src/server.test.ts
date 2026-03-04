import { describe, expect, test } from "bun:test";
import { checkSwcUnavailable, type SwcNotificationState } from "./server";

describe("checkSwcUnavailable", () => {
  test("shows error on first call when swcUnavailable is true", () => {
    const state: SwcNotificationState = { shown: false };
    const messages: string[] = [];
    checkSwcUnavailable(true, state, (msg) => messages.push(msg));

    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain("@swc/core not found");
    expect(state.shown).toBe(true);
  });

  test("does not show error on second call (one-time semantics)", () => {
    const state: SwcNotificationState = { shown: false };
    const messages: string[] = [];
    const showError = (msg: string) => messages.push(msg);

    checkSwcUnavailable(true, state, showError);
    checkSwcUnavailable(true, state, showError);

    expect(messages).toHaveLength(1);
  });

  test("does not show error when swcUnavailable is undefined", () => {
    const state: SwcNotificationState = { shown: false };
    const messages: string[] = [];
    checkSwcUnavailable(undefined, state, (msg) => messages.push(msg));

    expect(messages).toHaveLength(0);
    expect(state.shown).toBe(false);
  });

  test("does not show error when swcUnavailable is false", () => {
    const state: SwcNotificationState = { shown: false };
    const messages: string[] = [];
    checkSwcUnavailable(false, state, (msg) => messages.push(msg));

    expect(messages).toHaveLength(0);
    expect(state.shown).toBe(false);
  });
});

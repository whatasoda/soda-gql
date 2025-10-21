import type { AnyConstAssignableInputValue } from "./const-assignable-input";

export type AnyConstDirectiveAttachments = {
  readonly [key: string]: AnyConstAssignableInputValue;
};

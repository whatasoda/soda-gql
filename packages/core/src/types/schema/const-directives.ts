import type { AnyConstAssignableInputValue } from "./const-assignable-input";

/**
 * Representation of directive arguments keyed by directive name. Concrete
 * directive support can extend this map without changing slice builders.
 */
export type AnyConstDirectiveAttachments = {
  [key: string]: AnyConstAssignableInputValue;
};

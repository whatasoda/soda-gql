/** Directive support utilities shared by field selection builders. */
import type { ConstValues } from "./const-value";
import type { AnyAssignableInput } from "./input-value";

/**
 * Representation of directive arguments keyed by directive name. Concrete
 * directive support can extend this map without changing slice builders.
 */
export type AnyConstDirectiveAttachments = {
  [key: string]: ConstValues;
};

export type AnyDirectiveAttachments = {
  [key: string]: AnyAssignableInput;
};

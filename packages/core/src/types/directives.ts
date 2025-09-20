/** Directive support utilities shared by field selection builders. */
import type { AnyVariableAssignments } from "./variables";

/**
 * Representation of directive arguments keyed by directive name. Concrete
 * directive support can extend this map without changing slice builders.
 */
export type AnyDirectiveAttachments = {
  [key: string]: AnyVariableAssignments;
};

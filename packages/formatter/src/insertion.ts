import { types as t } from "@babel/core";

/**
 * Check if an array already has a leading empty comment on its first element
 */
export const hasLeadingEmptyComment = (array: t.ArrayExpression): boolean => {
  const firstElement = array.elements[0];
  if (!firstElement) return true; // Empty array, nothing to format

  const comments = firstElement.leadingComments;
  if (!comments || comments.length === 0) return false;

  // Check if any leading comment is an empty line comment
  return comments.some((c) => c.type === "CommentLine" && c.value.trim() === "");
};

/**
 * Insert an empty line comment before the first element of the array
 */
export const insertEmptyComment = (array: t.ArrayExpression): void => {
  const firstElement = array.elements[0];
  if (!firstElement) return;

  t.addComment(firstElement, "leading", "", true);
};

/**
 * Shared handler utilities for fragment spread and definition lookup.
 * @module
 */

import { parse, visit } from "graphql";
import type { FragmentSpreadNode } from "graphql";
import type { Position } from "../position-mapping";

/**
 * Find the fragment spread node at the given GraphQL offset using AST.
 * Returns the FragmentSpreadNode if cursor is on a `...FragmentName` pattern.
 */
export const findFragmentSpreadAtOffset = (
	preprocessed: string,
	offset: number,
): FragmentSpreadNode | null => {
	try {
		const ast = parse(preprocessed, { noLocation: false });
		let found: FragmentSpreadNode | null = null;

		visit(ast, {
			FragmentSpread(node) {
				if (!node.loc) {
					return;
				}
				if (offset >= node.loc.start && offset < node.loc.end) {
					found = node;
				}
			},
		});

		return found;
	} catch {
		return findFragmentSpreadByText(preprocessed, offset);
	}
};

/**
 * Text-based fallback: find fragment spread name at offset.
 * Handles documents with parse errors.
 */
export const findFragmentSpreadByText = (
	text: string,
	offset: number,
): FragmentSpreadNode | null => {
	const spreadPattern = /\.\.\.([A-Za-z_]\w*)/g;
	let match: RegExpExecArray | null = null;

	while ((match = spreadPattern.exec(text)) !== null) {
		const start = match.index;
		const end = start + match[0].length;
		if (offset >= start && offset < end) {
			return {
				kind: "FragmentSpread" as const,
				name: { kind: "Name" as const, value: match[1]! },
			} as FragmentSpreadNode;
		}
	}

	return null;
};

export type FragmentDefinitionMatch = {
	readonly name: string;
	readonly loc: { readonly start: number; readonly end: number };
};

/**
 * Find a FragmentDefinition at a given offset.
 * Returns the name and location, or null.
 */
export const findFragmentDefinitionAtOffset = (
	preprocessed: string,
	offset: number,
): FragmentDefinitionMatch | null => {
	try {
		const ast = parse(preprocessed, { noLocation: false });
		for (const def of ast.definitions) {
			if (def.kind === "FragmentDefinition" && def.name.loc) {
				if (offset >= def.name.loc.start && offset < def.name.loc.end) {
					return { name: def.name.value, loc: { start: def.name.loc.start, end: def.name.loc.end } };
				}
			}
		}
	} catch {
		// ignore parse errors
	}
	return null;
};

/**
 * Resolve the fragment name at a given offset, checking both definitions and spreads.
 */
export const resolveFragmentNameAtOffset = (preprocessed: string, offset: number): string | null => {
	const def = findFragmentDefinitionAtOffset(preprocessed, offset);
	if (def) {
		return def.name;
	}

	const spread = findFragmentSpreadAtOffset(preprocessed, offset);
	if (spread) {
		return spread.name.value;
	}

	return null;
};

/**
 * Convert a GraphQL Position to a byte offset within GraphQL content.
 */
export const gqlPositionToOffset = (content: string, position: Position): number => {
	const lines = content.split("\n");
	let offset = 0;
	for (let i = 0; i < position.line && i < lines.length; i++) {
		offset += lines[i]!.length + 1;
	}
	return offset + position.character;
};

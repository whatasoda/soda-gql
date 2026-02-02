/**
 * Rename handler: rename fragments across the workspace.
 * @module
 */

import type { Range, TextEdit, WorkspaceEdit } from "vscode-languageserver-types";
import { preprocessFragmentArgs } from "../fragment-args-preprocessor";
import { computeLineOffsets, createPositionMapper, offsetToPosition, type Position } from "../position-mapping";
import type { ExtractedTemplate, FragmentSpreadLocation, IndexedFragment } from "../types";
import { findFragmentDefinitionNameAtOffset, findFragmentSpreadAtOffset, gqlPositionToOffset } from "./_utils";

export type HandlePrepareRenameInput = {
	readonly template: ExtractedTemplate;
	readonly tsSource: string;
	readonly tsPosition: Position;
};

export type HandleRenameInput = {
	readonly template: ExtractedTemplate;
	readonly tsSource: string;
	readonly tsPosition: Position;
	readonly newName: string;
	readonly uri: string;
	readonly allFragments: readonly IndexedFragment[];
	readonly findSpreadLocations: (fragmentName: string) => readonly FragmentSpreadLocation[];
};

/** Validate and return the range of the symbol to be renamed. */
export const handlePrepareRename = (
	input: HandlePrepareRenameInput,
): { range: Range; placeholder: string } | null => {
	const { template, tsSource, tsPosition } = input;
	const { preprocessed } = preprocessFragmentArgs(template.content);

	const mapper = createPositionMapper({
		tsSource,
		contentStartOffset: template.contentRange.start,
		graphqlContent: template.content,
	});

	const gqlPosition = mapper.tsToGraphql(tsPosition);
	if (!gqlPosition) {
		return null;
	}

	const offset = gqlPositionToOffset(preprocessed, gqlPosition);

	// Check fragment definition name
	const defName = findFragmentDefinitionNameAtOffset(preprocessed, offset);
	if (defName) {
		const gqlLineOffsets = computeLineOffsets(preprocessed);
		// Find the definition name location by searching for it after "fragment "
		const defIdx = preprocessed.indexOf(defName, preprocessed.indexOf("fragment "));
		if (defIdx >= 0) {
			const start = mapper.graphqlToTs(offsetToPosition(gqlLineOffsets, defIdx));
			const end = mapper.graphqlToTs(offsetToPosition(gqlLineOffsets, defIdx + defName.length));
			return { range: { start, end }, placeholder: defName };
		}
	}

	// Check fragment spread
	const spread = findFragmentSpreadAtOffset(preprocessed, offset);
	if (spread && spread.name.value) {
		const gqlLineOffsets = computeLineOffsets(preprocessed);
		// Find the name portion within the spread (after "...")
		const spreadPattern = new RegExp(`\\.\\.\\.${spread.name.value}\\b`);
		const match = spreadPattern.exec(preprocessed);
		if (match) {
			const nameStart = match.index + 3; // skip "..."
			const start = mapper.graphqlToTs(offsetToPosition(gqlLineOffsets, nameStart));
			const end = mapper.graphqlToTs(offsetToPosition(gqlLineOffsets, nameStart + spread.name.value.length));
			return { range: { start, end }, placeholder: spread.name.value };
		}
	}

	return null;
};

/** Perform a rename across the workspace. */
export const handleRename = (input: HandleRenameInput): WorkspaceEdit | null => {
	const { template, tsSource, tsPosition, newName, allFragments, findSpreadLocations } = input;
	const { preprocessed } = preprocessFragmentArgs(template.content);

	const mapper = createPositionMapper({
		tsSource,
		contentStartOffset: template.contentRange.start,
		graphqlContent: template.content,
	});

	const gqlPosition = mapper.tsToGraphql(tsPosition);
	if (!gqlPosition) {
		return null;
	}

	const offset = gqlPositionToOffset(preprocessed, gqlPosition);

	// Determine the fragment name at cursor
	const fragmentName = resolveFragmentName(preprocessed, offset);
	if (!fragmentName) {
		return null;
	}

	const changes: Record<string, TextEdit[]> = {};

	const addEdit = (uri: string, range: Range, text: string): void => {
		if (!changes[uri]) {
			changes[uri] = [];
		}
		changes[uri].push({ range, newText: text });
	};

	// Rename fragment definitions
	for (const frag of allFragments) {
		if (frag.fragmentName !== fragmentName) {
			continue;
		}
		if (!frag.definition.name.loc) {
			continue;
		}

		const defMapper = createPositionMapper({
			tsSource: frag.tsSource,
			contentStartOffset: frag.contentRange.start,
			graphqlContent: frag.content,
		});

		const defGqlLineOffsets = computeLineOffsets(frag.content);
		const nameStart = offsetToPosition(defGqlLineOffsets, frag.definition.name.loc.start);
		const nameEnd = offsetToPosition(defGqlLineOffsets, frag.definition.name.loc.end);

		addEdit(frag.uri, {
			start: defMapper.graphqlToTs(nameStart),
			end: defMapper.graphqlToTs(nameEnd),
		}, newName);
	}

	// Rename fragment spreads
	const spreadLocations = findSpreadLocations(fragmentName);
	for (const loc of spreadLocations) {
		const spreadMapper = createPositionMapper({
			tsSource: loc.tsSource,
			contentStartOffset: loc.template.contentRange.start,
			graphqlContent: loc.template.content,
		});

		const spreadGqlLineOffsets = computeLineOffsets(loc.template.content);
		const spreadStart = offsetToPosition(spreadGqlLineOffsets, loc.nameOffset);
		const spreadEnd = offsetToPosition(spreadGqlLineOffsets, loc.nameOffset + loc.nameLength);

		addEdit(loc.uri, {
			start: spreadMapper.graphqlToTs(spreadStart),
			end: spreadMapper.graphqlToTs(spreadEnd),
		}, newName);
	}

	if (Object.keys(changes).length === 0) {
		return null;
	}

	return { changes };
};

const resolveFragmentName = (preprocessed: string, offset: number): string | null => {
	const defName = findFragmentDefinitionNameAtOffset(preprocessed, offset);
	if (defName) {
		return defName;
	}

	const spread = findFragmentSpreadAtOffset(preprocessed, offset);
	if (spread) {
		return spread.name.value;
	}

	return null;
};

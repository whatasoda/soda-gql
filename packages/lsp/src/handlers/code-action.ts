/**
 * Code action handler: provides Extract Fragment refactoring.
 * @module
 */

import { type GraphQLSchema, TypeInfo, parse, visit, visitWithTypeInfo } from "graphql";
import type { SelectionNode } from "graphql";
import { CodeActionKind, type CodeAction, type TextEdit } from "vscode-languageserver-types";
import { preprocessFragmentArgs } from "../fragment-args-preprocessor";
import { computeLineOffsets, createPositionMapper, offsetToPosition, type Position } from "../position-mapping";
import type { ExtractedTemplate } from "../types";
import { gqlPositionToOffset } from "./_utils";

export type HandleCodeActionInput = {
	readonly template: ExtractedTemplate;
	readonly schema: GraphQLSchema;
	readonly tsSource: string;
	readonly uri: string;
	readonly selectionRange: { readonly start: Position; readonly end: Position };
};

/** Handle a code action request for a GraphQL template. */
export const handleCodeAction = (input: HandleCodeActionInput): CodeAction[] => {
	const { template, schema, tsSource, uri, selectionRange } = input;

	// Only support queries/mutations/subscriptions, not fragment definitions
	if (template.kind === "fragment") {
		return [];
	}

	const { preprocessed } = preprocessFragmentArgs(template.content);

	const mapper = createPositionMapper({
		tsSource,
		contentStartOffset: template.contentRange.start,
		graphqlContent: template.content,
	});

	// Convert selection range to GraphQL offsets
	const gqlStart = mapper.tsToGraphql(selectionRange.start);
	const gqlEnd = mapper.tsToGraphql(selectionRange.end);
	if (!gqlStart || !gqlEnd) {
		return [];
	}

	const startOffset = gqlPositionToOffset(preprocessed, gqlStart);
	const endOffset = gqlPositionToOffset(preprocessed, gqlEnd);

	// Parse the GraphQL
	let ast;
	try {
		ast = parse(preprocessed, { noLocation: false });
	} catch {
		return [];
	}

	// Walk AST with TypeInfo to find the selection set and parent type
	const typeInfo = new TypeInfo(schema);
	const extractResult = findExtractableSelections(ast, typeInfo, startOffset, endOffset);

	if (!extractResult) {
		return [];
	}

	const { selections: matchedSelections, parentTypeName } = extractResult;

	// Extract the selected fields' source text
	const firstSel = matchedSelections[0]!;
	const lastSel = matchedSelections[matchedSelections.length - 1]!;
	if (!firstSel.loc || !lastSel.loc) {
		return [];
	}

	const selectedText = preprocessed.slice(firstSel.loc.start, lastSel.loc.end);
	const fragmentName = "ExtractedFragment";

	// Build the fragment definition
	const fragmentDef = `fragment ${fragmentName} on ${parentTypeName} {\n  ${selectedText.trim()}\n}`;

	// Build the new gql expression to insert
	const newGqlExpr = `export const ${fragmentName} = gql.${template.schemaName}(({ fragment }) => fragment\`\n  ${fragmentDef}\n\`);\n\n`;

	// Find the insertion point: the start of the line containing the current gql expression
	// Walk backwards from contentRange.start to find the beginning of the export/const statement
	const insertionOffset = findStatementStart(tsSource, template.contentRange.start);

	const tsLineOffsets = computeLineOffsets(tsSource);
	const gqlLineOffsets = computeLineOffsets(preprocessed);

	// TextEdit 1: Replace selected fields with fragment spread
	const replaceStart = mapper.graphqlToTs(offsetToPosition(gqlLineOffsets, firstSel.loc.start));
	const replaceEnd = mapper.graphqlToTs(offsetToPosition(gqlLineOffsets, lastSel.loc.end));

	const replaceEdit: TextEdit = {
		range: { start: replaceStart, end: replaceEnd },
		newText: `...${fragmentName}`,
	};

	// TextEdit 2: Insert the new fragment gql expression
	const insertPos = offsetToPosition(tsLineOffsets, insertionOffset);
	const insertEdit: TextEdit = {
		range: { start: insertPos, end: insertPos },
		newText: newGqlExpr,
	};

	return [
		{
			title: `Extract Fragment "${fragmentName}"`,
			kind: CodeActionKind.RefactorExtract,
			edit: {
				changes: {
					[uri]: [insertEdit, replaceEdit],
				},
			},
		},
	];
};

type ExtractResult = {
	readonly selections: readonly SelectionNode[];
	readonly parentTypeName: string;
};

/** Find selections within the user's range that can be extracted into a fragment. */
const findExtractableSelections = (
	ast: ReturnType<typeof parse>,
	typeInfo: TypeInfo,
	startOffset: number,
	endOffset: number,
): ExtractResult | null => {
	let result: ExtractResult | null = null;

	visit(
		ast,
		visitWithTypeInfo(typeInfo, {
			SelectionSet(node) {
				if (!node.loc || result) {
					return;
				}

				const selected = node.selections.filter((sel) => {
					if (!sel.loc) {
						return false;
					}
					return sel.loc.start >= startOffset && sel.loc.end <= endOffset;
				});

				if (selected.length > 0) {
					const typeName = typeInfo.getParentType()?.name;
					if (typeName) {
						result = { selections: selected, parentTypeName: typeName };
					}
				}
			},
		}),
	);

	return result;
};

/** Find the start of the statement containing the given offset. */
const findStatementStart = (source: string, offset: number): number => {
	// Walk back to find the start of the line, then keep going to find
	// the start of the statement (look for export/const/let/var keywords)
	let pos = offset;

	// First, find the start of the current line
	while (pos > 0 && source.charCodeAt(pos - 1) !== 10) {
		pos--;
	}

	// Keep walking back through lines to find the statement start
	// (handles multi-line expressions)
	while (pos > 0) {
		const lineStart = pos;
		const lineText = source.slice(lineStart, source.indexOf("\n", lineStart)).trimStart();

		if (
			lineText.startsWith("export ") ||
			lineText.startsWith("const ") ||
			lineText.startsWith("let ") ||
			lineText.startsWith("var ")
		) {
			return lineStart;
		}

		// Go to previous line
		pos--;
		while (pos > 0 && source.charCodeAt(pos - 1) !== 10) {
			pos--;
		}

		// If we hit a semicolon or closing brace, the statement starts after it
		const prevLine = source.slice(pos, lineStart - 1).trim();
		if (prevLine.endsWith(";") || prevLine.endsWith("}")) {
			return lineStart;
		}
	}

	return pos;
};

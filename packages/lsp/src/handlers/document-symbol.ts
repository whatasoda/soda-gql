/**
 * Document symbol handler: provides outline view for GraphQL templates.
 * @module
 */

import { getOutline } from "graphql-language-service";
import { type DocumentSymbol, SymbolKind } from "vscode-languageserver-types";
import { reconstructGraphql } from "../document-manager";
import { preprocessFragmentArgs } from "../fragment-args-preprocessor";
import { computeLineOffsets, createPositionMapper, offsetToPosition, positionToOffset } from "../position-mapping";
import type { ExtractedTemplate } from "../types";

export type HandleDocumentSymbolInput = {
  readonly templates: readonly ExtractedTemplate[];
  readonly tsSource: string;
};

const KIND_MAP: Record<string, SymbolKind> = {
  OperationDefinition: SymbolKind.Function,
  FragmentDefinition: SymbolKind.Class,
  Field: SymbolKind.Field,
  FragmentSpread: SymbolKind.Constant,
  InlineFragment: SymbolKind.Struct,
  EnumValueDefinition: SymbolKind.EnumMember,
  InputValueDefinition: SymbolKind.Property,
  FieldDefinition: SymbolKind.Field,
  ObjectTypeDefinition: SymbolKind.Class,
  InputObjectTypeDefinition: SymbolKind.Class,
  InterfaceTypeDefinition: SymbolKind.Interface,
  EnumTypeDefinition: SymbolKind.Enum,
};

type OutlineTree = {
  readonly representativeName?: string;
  readonly tokenizedText?: ReadonlyArray<{ readonly value: string }>;
  readonly kind: string;
  readonly startPosition: { readonly line: number; readonly character: number };
  readonly endPosition?: { readonly line: number; readonly character: number };
  readonly children: readonly OutlineTree[];
};

const getSymbolName = (tree: OutlineTree): string => {
  if (tree.representativeName) {
    return tree.representativeName;
  }
  if (tree.tokenizedText) {
    return tree.tokenizedText.map((t) => t.value).join("");
  }
  return tree.kind;
};

type PositionConverter = (pos: { line: number; character: number }) => { line: number; character: number };

const convertTree = (
  tree: OutlineTree,
  toContentPos: PositionConverter,
  mapper: ReturnType<typeof createPositionMapper>,
): DocumentSymbol | null => {
  const name = getSymbolName(tree);
  const kind = KIND_MAP[tree.kind] ?? SymbolKind.Variable;

  const startTs = mapper.graphqlToTs(toContentPos(tree.startPosition));
  const endTs = tree.endPosition ? mapper.graphqlToTs(toContentPos(tree.endPosition)) : startTs;

  const range = {
    start: { line: startTs.line, character: startTs.character },
    end: { line: endTs.line, character: endTs.character },
  };

  const children: DocumentSymbol[] = [];
  for (const child of tree.children) {
    const converted = convertTree(child, toContentPos, mapper);
    if (converted) {
      children.push(converted);
    }
  }

  return {
    name,
    kind,
    range,
    selectionRange: range,
    children: children.length > 0 ? children : undefined,
  };
};

/** Handle a documentSymbol request for all GraphQL templates in a document. */
export const handleDocumentSymbol = (input: HandleDocumentSymbolInput): DocumentSymbol[] => {
  const { templates, tsSource } = input;
  const symbols: DocumentSymbol[] = [];

  for (const template of templates) {
    const reconstructed = reconstructGraphql(template);
    const headerLen = reconstructed.length - template.content.length;
    const { preprocessed } = preprocessFragmentArgs(reconstructed);
    const outline = getOutline(preprocessed);
    if (!outline) {
      continue;
    }

    const mapper = createPositionMapper({
      tsSource,
      contentStartOffset: template.contentRange.start,
      graphqlContent: template.content,
    });

    // Convert position from reconstructed source to template content
    const reconstructedLineOffsets = computeLineOffsets(preprocessed);
    const contentLineOffsets = computeLineOffsets(template.content);
    const toContentPos: PositionConverter = (pos) => {
      const offset = positionToOffset(reconstructedLineOffsets, pos);
      const contentOffset = Math.max(0, offset - headerLen);
      return offsetToPosition(contentLineOffsets, contentOffset);
    };

    for (const tree of outline.outlineTrees as unknown as OutlineTree[]) {
      const symbol = convertTree(tree, toContentPos, mapper);
      if (symbol) {
        symbols.push(symbol);
      }
    }
  }

  return symbols;
};

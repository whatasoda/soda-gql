/**
 * Document symbol handler: provides outline view for GraphQL templates.
 * @module
 */

import { getOutline } from "graphql-language-service";
import { type DocumentSymbol, SymbolKind } from "vscode-languageserver-types";
import { preprocessFragmentArgs } from "../fragment-args-preprocessor";
import { createPositionMapper } from "../position-mapping";
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

const convertTree = (tree: OutlineTree, mapper: ReturnType<typeof createPositionMapper>): DocumentSymbol | null => {
  const name = getSymbolName(tree);
  const kind = KIND_MAP[tree.kind] ?? SymbolKind.Variable;

  const startTs = mapper.graphqlToTs(tree.startPosition);
  const endTs = tree.endPosition ? mapper.graphqlToTs(tree.endPosition) : startTs;

  const range = {
    start: { line: startTs.line, character: startTs.character },
    end: { line: endTs.line, character: endTs.character },
  };

  const children: DocumentSymbol[] = [];
  for (const child of tree.children) {
    const converted = convertTree(child, mapper);
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
    const { preprocessed } = preprocessFragmentArgs(template.content);
    const outline = getOutline(preprocessed);
    if (!outline) {
      continue;
    }

    const mapper = createPositionMapper({
      tsSource,
      contentStartOffset: template.contentRange.start,
      graphqlContent: template.content,
    });

    for (const tree of outline.outlineTrees as unknown as OutlineTree[]) {
      const symbol = convertTree(tree, mapper);
      if (symbol) {
        symbols.push(symbol);
      }
    }
  }

  return symbols;
};

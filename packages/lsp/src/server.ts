/**
 * LSP server: wires all components together via vscode-languageserver.
 * @module
 */

import { fileURLToPath } from "node:url";
import { createGraphqlSystemIdentifyHelper } from "@soda-gql/builder";
import { loadConfigFrom } from "@soda-gql/config";
import {
  type Connection,
  createConnection,
  DidChangeWatchedFilesNotification,
  FileChangeType,
  type InitializeResult,
  ProposedFeatures,
  type TextDocumentChangeEvent,
  TextDocumentSyncKind,
  TextDocuments,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import type { DocumentManager } from "./document-manager";
import { createDocumentManager } from "./document-manager";
import { handleCodeAction } from "./handlers/code-action";
import { handleCompletion } from "./handlers/completion";
import { handleDefinition } from "./handlers/definition";
import { computeTemplateDiagnostics } from "./handlers/diagnostics";
import { handleDocumentSymbol } from "./handlers/document-symbol";
import { handleFormatting } from "./handlers/formatting";
import { handleHover } from "./handlers/hover";
import { handleReferences } from "./handlers/references";
import { handlePrepareRename, handleRename } from "./handlers/rename";
import type { SchemaResolver } from "./schema-resolver";
import { createSchemaResolver } from "./schema-resolver";

export type LspServerOptions = {
  readonly connection?: Connection;
};

export const createLspServer = (options?: LspServerOptions) => {
  const connection = options?.connection ?? createConnection(ProposedFeatures.all);
  const documents = new TextDocuments(TextDocument);

  let schemaResolver: SchemaResolver | undefined;
  let documentManager: DocumentManager | undefined;

  const publishDiagnosticsForDocument = (uri: string) => {
    if (!schemaResolver || !documentManager) {
      return;
    }

    const state = documentManager.get(uri);
    if (!state) {
      connection.sendDiagnostics({ uri, diagnostics: [] });
      return;
    }

    const allDiagnostics = state.templates.flatMap((template) => {
      const entry = schemaResolver!.getSchema(template.schemaName);
      if (!entry) {
        return [];
      }
      const externalFragments = documentManager!.getExternalFragments(uri, template.schemaName).map((f) => f.definition);
      return [...computeTemplateDiagnostics({ template, schema: entry.schema, tsSource: state.source, externalFragments })];
    });

    connection.sendDiagnostics({ uri, diagnostics: allDiagnostics });
  };

  const publishDiagnosticsForAllOpen = () => {
    for (const doc of documents.all()) {
      publishDiagnosticsForDocument(doc.uri);
    }
  };

  connection.onInitialize((params): InitializeResult => {
    const rootUri = params.rootUri ?? params.rootPath;
    if (!rootUri) {
      connection.window.showErrorMessage("soda-gql LSP: no workspace root provided");
      return { capabilities: {} };
    }

    // Convert URI to path
    const rootPath = rootUri.startsWith("file://") ? fileURLToPath(rootUri) : rootUri;

    const configResult = loadConfigFrom(rootPath);
    if (configResult.isErr()) {
      connection.window.showErrorMessage(`soda-gql LSP: failed to load config: ${configResult.error.message}`);
      return { capabilities: {} };
    }

    const config = configResult.value;
    const helper = createGraphqlSystemIdentifyHelper(config);

    const resolverResult = createSchemaResolver(config);
    if (resolverResult.isErr()) {
      connection.window.showErrorMessage(`soda-gql LSP: ${resolverResult.error.message}`);
      return { capabilities: {} };
    }

    schemaResolver = resolverResult.value;
    documentManager = createDocumentManager(helper);

    return {
      capabilities: {
        textDocumentSync: TextDocumentSyncKind.Full,
        completionProvider: {
          triggerCharacters: ["{", "(", ":", "@", "$", " ", "\n", "."],
        },
        hoverProvider: true,
        documentSymbolProvider: true,
        definitionProvider: true,
        referencesProvider: true,
        renameProvider: { prepareProvider: true },
        documentFormattingProvider: true,
        codeActionProvider: {
          codeActionKinds: ["refactor.extract"],
        },
      },
    };
  });

  connection.onInitialized(() => {
    // Register for file watcher on .graphql files
    connection.client.register(DidChangeWatchedFilesNotification.type, {
      watchers: [{ globPattern: "**/*.graphql" }],
    });
  });

  documents.onDidChangeContent((change: TextDocumentChangeEvent<TextDocument>) => {
    if (!documentManager) {
      return;
    }
    documentManager.update(change.document.uri, change.document.version, change.document.getText());
    publishDiagnosticsForDocument(change.document.uri);
  });

  documents.onDidClose((change: TextDocumentChangeEvent<TextDocument>) => {
    if (!documentManager) {
      return;
    }
    documentManager.remove(change.document.uri);
    connection.sendDiagnostics({ uri: change.document.uri, diagnostics: [] });
  });

  connection.onCompletion((params) => {
    if (!documentManager || !schemaResolver) {
      return [];
    }

    const template = documentManager.findTemplateAtOffset(
      params.textDocument.uri,
      // We need to convert LSP position to offset
      positionToOffset(documents.get(params.textDocument.uri)?.getText() ?? "", params.position),
    );

    if (!template) {
      return [];
    }

    const entry = schemaResolver.getSchema(template.schemaName);
    if (!entry) {
      return [];
    }

    const doc = documents.get(params.textDocument.uri);
    if (!doc) {
      return [];
    }

    const externalFragments = documentManager
      .getExternalFragments(params.textDocument.uri, template.schemaName)
      .map((f) => f.definition);

    return handleCompletion({
      template,
      schema: entry.schema,
      tsSource: doc.getText(),
      tsPosition: { line: params.position.line, character: params.position.character },
      externalFragments,
    });
  });

  connection.onHover((params) => {
    if (!documentManager || !schemaResolver) {
      return null;
    }

    const doc = documents.get(params.textDocument.uri);
    if (!doc) {
      return null;
    }

    const template = documentManager.findTemplateAtOffset(
      params.textDocument.uri,
      positionToOffset(doc.getText(), params.position),
    );

    if (!template) {
      return null;
    }

    const entry = schemaResolver.getSchema(template.schemaName);
    if (!entry) {
      return null;
    }

    return handleHover({
      template,
      schema: entry.schema,
      tsSource: doc.getText(),
      tsPosition: { line: params.position.line, character: params.position.character },
    });
  });

  connection.onDefinition(async (params) => {
    if (!documentManager || !schemaResolver) {
      return [];
    }

    const doc = documents.get(params.textDocument.uri);
    if (!doc) {
      return [];
    }

    const template = documentManager.findTemplateAtOffset(
      params.textDocument.uri,
      positionToOffset(doc.getText(), params.position),
    );

    if (!template) {
      return [];
    }

    const externalFragments = documentManager.getExternalFragments(params.textDocument.uri, template.schemaName);

    return handleDefinition({
      template,
      tsSource: doc.getText(),
      tsPosition: { line: params.position.line, character: params.position.character },
      externalFragments,
    });
  });

  connection.onReferences((params) => {
    if (!documentManager || !schemaResolver) {
      return [];
    }

    const doc = documents.get(params.textDocument.uri);
    if (!doc) {
      return [];
    }

    const template = documentManager.findTemplateAtOffset(
      params.textDocument.uri,
      positionToOffset(doc.getText(), params.position),
    );

    if (!template) {
      return [];
    }

    return handleReferences({
      template,
      tsSource: doc.getText(),
      tsPosition: { line: params.position.line, character: params.position.character },
      allFragments: documentManager.getAllFragments(template.schemaName),
      findSpreadLocations: (name) => documentManager!.findFragmentSpreadLocations(name, template.schemaName),
    });
  });

  connection.onPrepareRename((params) => {
    if (!documentManager) {
      return null;
    }

    const doc = documents.get(params.textDocument.uri);
    if (!doc) {
      return null;
    }

    const template = documentManager.findTemplateAtOffset(
      params.textDocument.uri,
      positionToOffset(doc.getText(), params.position),
    );

    if (!template) {
      return null;
    }

    return handlePrepareRename({
      template,
      tsSource: doc.getText(),
      tsPosition: { line: params.position.line, character: params.position.character },
    });
  });

  connection.onRenameRequest((params) => {
    if (!documentManager || !schemaResolver) {
      return null;
    }

    const doc = documents.get(params.textDocument.uri);
    if (!doc) {
      return null;
    }

    const template = documentManager.findTemplateAtOffset(
      params.textDocument.uri,
      positionToOffset(doc.getText(), params.position),
    );

    if (!template) {
      return null;
    }

    return handleRename({
      template,
      tsSource: doc.getText(),
      tsPosition: { line: params.position.line, character: params.position.character },
      newName: params.newName,
      allFragments: documentManager.getAllFragments(template.schemaName),
      findSpreadLocations: (name) => documentManager!.findFragmentSpreadLocations(name, template.schemaName),
    });
  });

  connection.onDocumentSymbol((params) => {
    if (!documentManager) {
      return [];
    }

    const state = documentManager.get(params.textDocument.uri);
    if (!state) {
      return [];
    }

    return handleDocumentSymbol({
      templates: state.templates,
      tsSource: state.source,
    });
  });

  connection.onDocumentFormatting((params) => {
    if (!documentManager) {
      return [];
    }

    const state = documentManager.get(params.textDocument.uri);
    if (!state) {
      return [];
    }

    return handleFormatting({
      templates: state.templates,
      tsSource: state.source,
    });
  });

  connection.onCodeAction((params) => {
    if (!documentManager || !schemaResolver) {
      return [];
    }

    const doc = documents.get(params.textDocument.uri);
    if (!doc) {
      return [];
    }

    const template = documentManager.findTemplateAtOffset(
      params.textDocument.uri,
      positionToOffset(doc.getText(), params.range.start),
    );

    if (!template) {
      return [];
    }

    const entry = schemaResolver.getSchema(template.schemaName);
    if (!entry) {
      return [];
    }

    return handleCodeAction({
      template,
      schema: entry.schema,
      tsSource: doc.getText(),
      uri: params.textDocument.uri,
      selectionRange: {
        start: { line: params.range.start.line, character: params.range.start.character },
        end: { line: params.range.end.line, character: params.range.end.character },
      },
    });
  });

  connection.onDidChangeWatchedFiles((_params) => {
    if (!schemaResolver) {
      return;
    }

    // Check if any .graphql files changed
    const graphqlChanged = _params.changes.some(
      (change) =>
        change.uri.endsWith(".graphql") && (change.type === FileChangeType.Changed || change.type === FileChangeType.Created),
    );

    if (graphqlChanged) {
      const result = schemaResolver.reloadAll();
      if (result.isOk()) {
        publishDiagnosticsForAllOpen();
      } else {
        connection.window.showErrorMessage(`soda-gql LSP: schema reload failed: ${result.error.message}`);
      }
    }
  });

  documents.listen(connection);

  return {
    start: () => {
      connection.listen();
    },
  };
};

/** Convert LSP Position to byte offset in source text. */
const positionToOffset = (source: string, position: { line: number; character: number }): number => {
  let line = 0;
  let offset = 0;
  while (line < position.line && offset < source.length) {
    if (source.charCodeAt(offset) === 10) {
      line++;
    }
    offset++;
  }
  return offset + position.character;
};

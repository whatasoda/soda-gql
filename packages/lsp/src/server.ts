/**
 * LSP server: wires all components together via vscode-languageserver.
 * @module
 */

import { fileURLToPath } from "node:url";
import { findAllConfigFiles, findConfigFile } from "@soda-gql/config";
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
import type { ConfigRegistry } from "./config-registry";
import { createConfigRegistry } from "./config-registry";
import { handleCodeAction } from "./handlers/code-action";
import { handleCompletion } from "./handlers/completion";
import { handleDefinition } from "./handlers/definition";
import { computeTemplateDiagnostics } from "./handlers/diagnostics";
import { handleDocumentSymbol } from "./handlers/document-symbol";
import { handleFormatting } from "./handlers/formatting";
import { handleHover } from "./handlers/hover";
import { handleReferences } from "./handlers/references";
import { handlePrepareRename, handleRename } from "./handlers/rename";

export type LspServerOptions = {
  readonly connection?: Connection;
};

export const createLspServer = (options?: LspServerOptions) => {
  const connection = options?.connection ?? createConnection(ProposedFeatures.all);
  const documents = new TextDocuments(TextDocument);

  let registry: ConfigRegistry | undefined;

  const publishDiagnosticsForDocument = (uri: string) => {
    if (!registry) {
      return;
    }

    const ctx = registry.resolveForUri(uri);
    if (!ctx) {
      connection.sendDiagnostics({ uri, diagnostics: [] });
      return;
    }

    const state = ctx.documentManager.get(uri);
    if (!state) {
      connection.sendDiagnostics({ uri, diagnostics: [] });
      return;
    }

    const allDiagnostics = state.templates.flatMap((template) => {
      const entry = ctx.schemaResolver.getSchema(template.schemaName);
      if (!entry) {
        return [];
      }
      const externalFragments = ctx.documentManager.getExternalFragments(uri, template.schemaName).map((f) => f.definition);
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

    // Discover all config files under the workspace
    let configPaths = findAllConfigFiles(rootPath);

    if (configPaths.length === 0) {
      // Fallback: try walking up from rootPath (for when workspace root != config dir)
      const singleConfigPath = findConfigFile(rootPath);
      if (!singleConfigPath) {
        connection.window.showErrorMessage("soda-gql LSP: no config file found");
        return { capabilities: {} };
      }
      configPaths = [singleConfigPath];
    }

    const registryResult = createConfigRegistry(configPaths);
    if (registryResult.isErr()) {
      connection.window.showErrorMessage(`soda-gql LSP: ${registryResult.error.message}`);
      return { capabilities: {} };
    }

    registry = registryResult.value;

    return {
      capabilities: {
        textDocumentSync: TextDocumentSyncKind.Full,
        hoverProvider: true,
        documentSymbolProvider: true,
        definitionProvider: true,
        referencesProvider: true,
        renameProvider: { prepareProvider: true },
        documentFormattingProvider: true,
        completionProvider: {
          triggerCharacters: ["{", "(", ":", "@", "$", " ", "\n", "."],
        },
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
    if (!registry) {
      return;
    }
    const ctx = registry.resolveForUri(change.document.uri);
    if (!ctx) {
      return;
    }
    ctx.documentManager.update(change.document.uri, change.document.version, change.document.getText());
    publishDiagnosticsForDocument(change.document.uri);
  });

  documents.onDidClose((change: TextDocumentChangeEvent<TextDocument>) => {
    if (!registry) {
      return;
    }
    const ctx = registry.resolveForUri(change.document.uri);
    if (ctx) {
      ctx.documentManager.remove(change.document.uri);
    }
    connection.sendDiagnostics({ uri: change.document.uri, diagnostics: [] });
  });

  connection.onCompletion((params) => {
    if (!registry) {
      return [];
    }

    const ctx = registry.resolveForUri(params.textDocument.uri);
    if (!ctx) {
      return [];
    }

    const template = ctx.documentManager.findTemplateAtOffset(
      params.textDocument.uri,
      positionToOffset(documents.get(params.textDocument.uri)?.getText() ?? "", params.position),
    );

    if (!template) {
      return [];
    }

    const entry = ctx.schemaResolver.getSchema(template.schemaName);
    if (!entry) {
      return [];
    }

    const doc = documents.get(params.textDocument.uri);
    if (!doc) {
      return [];
    }

    const externalFragments = ctx.documentManager
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
    if (!registry) {
      return null;
    }

    const ctx = registry.resolveForUri(params.textDocument.uri);
    if (!ctx) {
      return null;
    }

    const doc = documents.get(params.textDocument.uri);
    if (!doc) {
      return null;
    }

    const template = ctx.documentManager.findTemplateAtOffset(
      params.textDocument.uri,
      positionToOffset(doc.getText(), params.position),
    );

    if (!template) {
      return null;
    }

    const entry = ctx.schemaResolver.getSchema(template.schemaName);
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
    if (!registry) {
      return [];
    }

    const ctx = registry.resolveForUri(params.textDocument.uri);
    if (!ctx) {
      return [];
    }

    const doc = documents.get(params.textDocument.uri);
    if (!doc) {
      return [];
    }

    const template = ctx.documentManager.findTemplateAtOffset(
      params.textDocument.uri,
      positionToOffset(doc.getText(), params.position),
    );

    if (!template) {
      return [];
    }

    const externalFragments = ctx.documentManager.getExternalFragments(params.textDocument.uri, template.schemaName);
    const entry = ctx.schemaResolver.getSchema(template.schemaName);

    return handleDefinition({
      template,
      tsSource: doc.getText(),
      tsPosition: { line: params.position.line, character: params.position.character },
      externalFragments,
      schema: entry?.schema,
      schemaFiles: entry?.files,
    });
  });

  connection.onReferences((params) => {
    if (!registry) {
      return [];
    }

    const ctx = registry.resolveForUri(params.textDocument.uri);
    if (!ctx) {
      return [];
    }

    const doc = documents.get(params.textDocument.uri);
    if (!doc) {
      return [];
    }

    const template = ctx.documentManager.findTemplateAtOffset(
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
      allFragments: ctx.documentManager.getAllFragments(template.schemaName),
      findSpreadLocations: (name) => ctx.documentManager.findFragmentSpreadLocations(name, template.schemaName),
    });
  });

  connection.onPrepareRename((params) => {
    if (!registry) {
      return null;
    }

    const ctx = registry.resolveForUri(params.textDocument.uri);
    if (!ctx) {
      return null;
    }

    const doc = documents.get(params.textDocument.uri);
    if (!doc) {
      return null;
    }

    const template = ctx.documentManager.findTemplateAtOffset(
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
    if (!registry) {
      return null;
    }

    const ctx = registry.resolveForUri(params.textDocument.uri);
    if (!ctx) {
      return null;
    }

    const doc = documents.get(params.textDocument.uri);
    if (!doc) {
      return null;
    }

    const template = ctx.documentManager.findTemplateAtOffset(
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
      allFragments: ctx.documentManager.getAllFragments(template.schemaName),
      findSpreadLocations: (name) => ctx.documentManager.findFragmentSpreadLocations(name, template.schemaName),
    });
  });

  connection.onDocumentSymbol((params) => {
    if (!registry) {
      return [];
    }

    const ctx = registry.resolveForUri(params.textDocument.uri);
    if (!ctx) {
      return [];
    }

    const state = ctx.documentManager.get(params.textDocument.uri);
    if (!state) {
      return [];
    }

    return handleDocumentSymbol({
      templates: state.templates,
      tsSource: state.source,
    });
  });

  connection.onDocumentFormatting((params) => {
    if (!registry) {
      return [];
    }

    const ctx = registry.resolveForUri(params.textDocument.uri);
    if (!ctx) {
      return [];
    }

    const state = ctx.documentManager.get(params.textDocument.uri);
    if (!state) {
      return [];
    }

    return handleFormatting({
      templates: state.templates,
      tsSource: state.source,
    });
  });

  connection.onCodeAction((params) => {
    if (!registry) {
      return [];
    }

    const ctx = registry.resolveForUri(params.textDocument.uri);
    if (!ctx) {
      return [];
    }

    const doc = documents.get(params.textDocument.uri);
    if (!doc) {
      return [];
    }

    const template = ctx.documentManager.findTemplateAtOffset(
      params.textDocument.uri,
      positionToOffset(doc.getText(), params.range.start),
    );

    if (!template) {
      return [];
    }

    const entry = ctx.schemaResolver.getSchema(template.schemaName);
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
    if (!registry) {
      return;
    }

    // Check if any .graphql files changed
    const graphqlChanged = _params.changes.some(
      (change) =>
        change.uri.endsWith(".graphql") && (change.type === FileChangeType.Changed || change.type === FileChangeType.Created),
    );

    if (graphqlChanged) {
      const result = registry.reloadAllSchemas();
      publishDiagnosticsForAllOpen();
      if (result.isErr()) {
        for (const error of result.error) {
          connection.window.showErrorMessage(`soda-gql LSP: schema reload failed: ${error.message}`);
        }
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

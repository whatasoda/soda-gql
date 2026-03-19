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
  type InitializeParams,
  type InitializeResult,
  ProposedFeatures,
  type TextDocumentChangeEvent,
  TextDocumentSyncKind,
  TextDocuments,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import type { ConfigRegistry } from "./config-registry";
import { createConfigRegistry } from "./config-registry";
import { lspErrors } from "./errors";
import { resolveFieldTree } from "./field-tree-resolver";
import { handleCodeAction } from "./handlers/code-action";
import { handleCompletion } from "./handlers/completion";
import { handleDefinition, resolveTypeNameToSchemaDefinition } from "./handlers/definition";
import { computeTemplateDiagnostics } from "./handlers/diagnostics";
import { handleDocumentSymbol } from "./handlers/document-symbol";
import { handleFieldTreeCompletion } from "./handlers/field-tree-completion";
import { handleFieldTreeHover } from "./handlers/field-tree-hover";
import { handleFieldTreeDefinition } from "./handlers/field-tree-definition";
import { handleFormatting } from "./handlers/formatting";
import { handleHover } from "./handlers/hover";
import { handleReferences } from "./handlers/references";
import { handlePrepareRename, handleRename } from "./handlers/rename";

export type LspServerOptions = {
  readonly connection?: Connection;
  readonly initializeParams?: InitializeParams;
};

/** Server capabilities shared between direct and proxy initialization. */
const serverCapabilities = {
  textDocumentSync: TextDocumentSyncKind.Full,
  hoverProvider: true,
  documentSymbolProvider: true,
  definitionProvider: true,
  referencesProvider: true,
  renameProvider: { prepareProvider: true },
  documentFormattingProvider: true,
  completionProvider: {
    triggerCharacters: ["{", "(", ":", "@", "$", " ", "\n", ".", '"'],
  },
  codeActionProvider: {
    codeActionKinds: ["refactor.extract"],
  },
} satisfies InitializeResult["capabilities"];

/** Initialize the LSP server from InitializeParams. Used by both direct and proxy modes. */
const initializeFromParams = (
  params: InitializeParams,
  connection: Connection,
): { result: InitializeResult; registry: ConfigRegistry | undefined } => {
  const roots = resolveWorkspaceRoots(params);
  if (roots.length === 0) {
    connection.window.showErrorMessage("soda-gql LSP: no workspace root provided");
    return { result: { capabilities: {} }, registry: undefined };
  }

  const configPaths = discoverConfigs(roots);
  if (configPaths.length === 0) {
    connection.window.showErrorMessage("soda-gql LSP: no config file found");
    return { result: { capabilities: {} }, registry: undefined };
  }

  const registryResult = createConfigRegistry(configPaths);
  if (registryResult.isErr()) {
    connection.window.showErrorMessage(`soda-gql LSP: ${registryResult.error.message}`);
    return { result: { capabilities: {} }, registry: undefined };
  }

  return {
    result: { capabilities: serverCapabilities },
    registry: registryResult.value,
  };
};

export const createLspServer = (options?: LspServerOptions) => {
  const connection = options?.connection ?? createConnection(ProposedFeatures.all);
  const documents = new TextDocuments(TextDocument);

  let registry: ConfigRegistry | undefined;
  const swcNotification: SwcNotificationState = { shown: false };

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

  let initializeResult: InitializeResult | undefined;

  if (options?.initializeParams) {
    const init = initializeFromParams(options.initializeParams, connection);
    registry = init.registry;
    initializeResult = init.result;
  } else {
    connection.onInitialize((params): InitializeResult => {
      const init = initializeFromParams(params, connection);
      registry = init.registry;
      return init.result;
    });
  }

  connection.onInitialized(() => {
    // Register for file watcher on .graphql schema files and config files
    connection.client.register(DidChangeWatchedFilesNotification.type, {
      watchers: [{ globPattern: "**/*.graphql" }, { globPattern: "**/soda-gql.config.*" }],
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
    const state = ctx.documentManager.update(change.document.uri, change.document.version, change.document.getText());
    checkSwcUnavailable(state.swcUnavailable, swcNotification, (msg) => connection.window.showErrorMessage(msg));
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

    const doc = documents.get(params.textDocument.uri);
    if (!doc) {
      return [];
    }

    const tsSource = doc.getText();
    const offset = positionToOffset(tsSource, params.position);

    // Field tree dispatch: callback builder field selection
    const untypedTree = ctx.documentManager.findFieldTreeAtOffset(params.textDocument.uri, offset);
    if (untypedTree) {
      const treeEntry = ctx.schemaResolver.getSchema(untypedTree.schemaName);
      if (treeEntry) {
        const typedTree = resolveFieldTree(untypedTree, treeEntry.schema);
        if (typedTree) {
          return handleFieldTreeCompletion({
            fieldTree: typedTree,
            schema: treeEntry.schema,
            tsSource,
            tsPosition: { line: params.position.line, character: params.position.character },
            offset,
          });
        }
      }
    }

    // Template dispatch: tagged templates and callback-variables
    const template = ctx.documentManager.findTemplateAtOffset(params.textDocument.uri, offset);

    if (!template) {
      return [];
    }

    const entry = ctx.schemaResolver.getSchema(template.schemaName);
    if (!entry) {
      return [];
    }

    const externalFragments = ctx.documentManager
      .getExternalFragments(params.textDocument.uri, template.schemaName)
      .map((f) => f.definition);

    return handleCompletion({
      template,
      schema: entry.schema,
      tsSource,
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

    const tsSource = doc.getText();
    const offset = positionToOffset(tsSource, params.position);

    // Field tree dispatch: callback builder field selection
    const untypedTree = ctx.documentManager.findFieldTreeAtOffset(params.textDocument.uri, offset);
    if (untypedTree) {
      const treeEntry = ctx.schemaResolver.getSchema(untypedTree.schemaName);
      if (treeEntry) {
        const typedTree = resolveFieldTree(untypedTree, treeEntry.schema);
        if (typedTree) {
          return handleFieldTreeHover({ fieldTree: typedTree, tsSource, offset });
        }
      }
    }

    // Template dispatch: tagged templates and callback-variables
    const template = ctx.documentManager.findTemplateAtOffset(params.textDocument.uri, offset);

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
      tsSource,
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

    const tsSource = doc.getText();
    const offset = positionToOffset(tsSource, params.position);

    // Field tree dispatch: callback builder field selection
    const untypedTree = ctx.documentManager.findFieldTreeAtOffset(params.textDocument.uri, offset);
    if (untypedTree) {
      const treeEntry = ctx.schemaResolver.getSchema(untypedTree.schemaName);
      if (treeEntry?.files) {
        const typedTree = resolveFieldTree(untypedTree, treeEntry.schema);
        if (typedTree) {
          return handleFieldTreeDefinition({
            fieldTree: typedTree,
            schema: treeEntry.schema,
            tsSource,
            tsPosition: { line: params.position.line, character: params.position.character },
            offset,
            schemaFiles: treeEntry.files,
          });
        }
      }
    }

    // Template dispatch: tagged templates and callback-variables
    const template = ctx.documentManager.findTemplateAtOffset(params.textDocument.uri, offset);

    if (!template) {
      // Try fragment type name navigation (typeNameSpan is outside contentRange)
      const typeNameTemplate = ctx.documentManager.findTemplateByTypeNameOffset(params.textDocument.uri, offset);
      if (typeNameTemplate?.typeName) {
        const typeNameEntry = ctx.schemaResolver.getSchema(typeNameTemplate.schemaName);
        if (typeNameEntry?.files) {
          return resolveTypeNameToSchemaDefinition(typeNameTemplate.typeName, typeNameEntry.files);
        }
      }
      return [];
    }

    const externalFragments = ctx.documentManager.getExternalFragments(params.textDocument.uri, template.schemaName);
    const entry = ctx.schemaResolver.getSchema(template.schemaName);

    return handleDefinition({
      template,
      tsSource,
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

    // Notify user to restart when config file changes
    const configChanged = _params.changes.some(
      (change) =>
        /soda-gql\.config\.[cm]?[jt]s$/.test(change.uri) &&
        (change.type === FileChangeType.Changed || change.type === FileChangeType.Created),
    );
    if (configChanged) {
      connection.window.showInformationMessage("soda-gql: config file changed. Restart the language server to apply.");
    }
  });

  documents.listen(connection);

  return {
    start: () => {
      connection.listen();
    },
    initializeResult,
  };
};

/** One-time SWC unavailable notification state. */
export type SwcNotificationState = { shown: boolean };

/** Check if SWC is unavailable and show a one-time error notification. */
export const checkSwcUnavailable = (
  swcUnavailable: boolean | undefined,
  state: SwcNotificationState,
  showError: (message: string) => void,
): void => {
  if (swcUnavailable && !state.shown) {
    state.shown = true;
    showError(`soda-gql LSP: ${lspErrors.swcResolutionFailed().message}`);
  }
};

/** Extract workspace root paths from LSP initialize params. */
const resolveWorkspaceRoots = (params: InitializeParams): string[] => {
  if (params.workspaceFolders && params.workspaceFolders.length > 0) {
    return params.workspaceFolders.map((f) => (f.uri.startsWith("file://") ? fileURLToPath(f.uri) : f.uri));
  }
  const rootUri = params.rootUri ?? params.rootPath;
  if (rootUri) {
    return [rootUri.startsWith("file://") ? fileURLToPath(rootUri) : rootUri];
  }
  return [];
};

/** Discover config files across multiple workspace roots (deduplicated). */
const discoverConfigs = (roots: string[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const root of roots) {
    const fromRoot = findAllConfigFiles(root);
    if (fromRoot.length > 0) {
      for (const p of fromRoot) {
        if (!seen.has(p)) {
          seen.add(p);
          result.push(p);
        }
      }
    } else {
      // Per-root fallback: walk up from this root if findAllConfigFiles found nothing
      const single = findConfigFile(root);
      if (single && !seen.has(single)) {
        seen.add(single);
        result.push(single);
      }
    }
  }
  return result;
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

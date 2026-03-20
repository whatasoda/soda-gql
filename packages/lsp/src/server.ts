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
import type { ConfigContext, ConfigRegistry } from "./config-registry";
import { createConfigRegistry } from "./config-registry";
import { lspErrors } from "./errors";
import { resolveFieldTree, type TypedFieldTree } from "./field-tree-resolver";
import { handleCodeAction } from "./handlers/code-action";
import { handleCompletion } from "./handlers/completion";
import { handleDefinition, resolveTypeNameToSchemaDefinition } from "./handlers/definition";
import { computeTemplateDiagnostics } from "./handlers/diagnostics";
import { computeFieldTreeDiagnostics } from "./handlers/field-tree-diagnostics";
import { handleDocumentSymbol } from "./handlers/document-symbol";
import { handleFieldTreeCompletion } from "./handlers/field-tree-completion";
import { handleFieldTreeHover } from "./handlers/field-tree-hover";
import { handleFieldTreeDefinition } from "./handlers/field-tree-definition";
import { handleFormatting } from "./handlers/formatting";
import { handleHover } from "./handlers/hover";
import { handleReferences } from "./handlers/references";
import { handlePrepareRename, handleRename } from "./handlers/rename";
import type { SchemaEntry } from "./schema-resolver";
import type { ExtractedTemplate } from "./types";

export type LspServerOptions = {
  readonly connection?: Connection;
  readonly initializeParams?: InitializeParams;
};

/** Discriminated union describing what LSP context was resolved at a given position. */
type ResolvedPositionContext =
  | {
      kind: "fieldTree";
      ctx: ConfigContext;
      tsSource: string;
      offset: number;
      tsPosition: { line: number; character: number };
      typedTree: TypedFieldTree;
      schema: import("graphql").GraphQLSchema;
      schemaEntry: SchemaEntry;
    }
  | {
      kind: "template";
      ctx: ConfigContext;
      tsSource: string;
      offset: number;
      tsPosition: { line: number; character: number };
      template: ExtractedTemplate;
      schemaEntry: SchemaEntry | undefined;
    }
  | undefined;

/**
 * Shared 3-phase dispatch: registry/ctx/doc guard → field-tree → template.
 * Used by completion, hover, and definition handlers.
 */
const resolvePositionContext = (
  registry: ConfigRegistry | undefined,
  documents: TextDocuments<TextDocument>,
  uri: string,
  position: { line: number; character: number },
): ResolvedPositionContext => {
  if (!registry) {
    return undefined;
  }

  const ctx = registry.resolveForUri(uri);
  if (!ctx) {
    return undefined;
  }

  const doc = documents.get(uri);
  if (!doc) {
    return undefined;
  }

  const tsSource = doc.getText();
  const offset = positionToOffset(tsSource, position);
  const tsPosition = { line: position.line, character: position.character };

  // Field tree dispatch: callback builder field selection
  const untypedTree = ctx.documentManager.findFieldTreeAtOffset(uri, offset);
  if (untypedTree) {
    const schemaEntry = ctx.schemaResolver.getSchema(untypedTree.schemaName);
    if (schemaEntry) {
      const typedTree = resolveFieldTree(untypedTree, schemaEntry.schema);
      if (typedTree) {
        return { kind: "fieldTree", ctx, tsSource, offset, tsPosition, typedTree, schema: schemaEntry.schema, schemaEntry };
      }
    }
  }

  // Template dispatch: tagged templates and callback-variables
  const template = ctx.documentManager.findTemplateAtOffset(uri, offset);
  if (!template) {
    return undefined;
  }

  const schemaEntry = ctx.schemaResolver.getSchema(template.schemaName);
  return { kind: "template", ctx, tsSource, offset, tsPosition, template, schemaEntry };
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

    const templateDiagnostics = state.templates.flatMap((template) => {
      const entry = ctx.schemaResolver.getSchema(template.schemaName);
      if (!entry) {
        return [];
      }
      const externalFragments = ctx.documentManager.getExternalFragments(uri, template.schemaName).map((f) => f.definition);
      return [...computeTemplateDiagnostics({ template, schema: entry.schema, tsSource: state.source, externalFragments })];
    });

    const fieldTreeDiagnostics = state.fieldTrees.flatMap((tree) => {
      const entry = ctx.schemaResolver.getSchema(tree.schemaName);
      if (!entry) {
        return [];
      }
      const typedTree = resolveFieldTree(tree, entry.schema);
      if (!typedTree) {
        return [];
      }
      return [...computeFieldTreeDiagnostics({ fieldTree: typedTree, tsSource: state.source })];
    });

    connection.sendDiagnostics({ uri, diagnostics: [...templateDiagnostics, ...fieldTreeDiagnostics] });
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
    const resolved = resolvePositionContext(registry, documents, params.textDocument.uri, params.position);

    if (!resolved) {
      return [];
    }

    if (resolved.kind === "fieldTree") {
      return handleFieldTreeCompletion({
        fieldTree: resolved.typedTree,
        schema: resolved.schema,
        tsSource: resolved.tsSource,
        tsPosition: resolved.tsPosition,
        offset: resolved.offset,
      });
    }

    // resolved.kind === "template"
    if (!resolved.schemaEntry) {
      return [];
    }

    const externalFragments = resolved.ctx.documentManager
      .getExternalFragments(params.textDocument.uri, resolved.template.schemaName)
      .map((f) => f.definition);

    return handleCompletion({
      template: resolved.template,
      schema: resolved.schemaEntry.schema,
      tsSource: resolved.tsSource,
      tsPosition: resolved.tsPosition,
      externalFragments,
    });
  });

  connection.onHover((params) => {
    const resolved = resolvePositionContext(registry, documents, params.textDocument.uri, params.position);

    if (!resolved) {
      return null;
    }

    if (resolved.kind === "fieldTree") {
      return handleFieldTreeHover({ fieldTree: resolved.typedTree, offset: resolved.offset });
    }

    // resolved.kind === "template"
    if (!resolved.schemaEntry) {
      return null;
    }

    return handleHover({
      template: resolved.template,
      schema: resolved.schemaEntry.schema,
      tsSource: resolved.tsSource,
      tsPosition: resolved.tsPosition,
    });
  });

  connection.onDefinition(async (params) => {
    const resolved = resolvePositionContext(registry, documents, params.textDocument.uri, params.position);

    if (!resolved) {
      // resolvePositionContext returns undefined when no field tree or template found.
      // For definition, also try fragment type name navigation as a fallback.
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
      const offset = positionToOffset(doc.getText(), params.position);
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

    if (resolved.kind === "fieldTree") {
      if (!resolved.schemaEntry.files) {
        return [];
      }
      return handleFieldTreeDefinition({
        fieldTree: resolved.typedTree,
        schema: resolved.schema,
        tsSource: resolved.tsSource,
        tsPosition: resolved.tsPosition,
        offset: resolved.offset,
        schemaFiles: resolved.schemaEntry.files,
      });
    }

    // resolved.kind === "template"
    const externalFragments = resolved.ctx.documentManager.getExternalFragments(
      params.textDocument.uri,
      resolved.template.schemaName,
    );

    return handleDefinition({
      template: resolved.template,
      tsSource: resolved.tsSource,
      tsPosition: resolved.tsPosition,
      externalFragments,
      schema: resolved.schemaEntry?.schema,
      schemaFiles: resolved.schemaEntry?.files,
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

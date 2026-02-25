/**
 * TypeScript Language Service Plugin for soda-gql.
 *
 * Provides GraphQL field completion inside soda-gql tagged template literals
 * by intercepting `getCompletionsAtPosition` within tsserver.
 */
import type ts from "typescript";
import { getGraphQLCompletions } from "./completion";
import { createSchemaProvider, type SchemaProvider } from "./schema-provider";
import { findTemplateAtPosition } from "./template-detector";

interface PluginCreateInfo {
  project: ts.server.Project;
  languageService: ts.LanguageService;
  languageServiceHost: ts.LanguageServiceHost;
  serverHost: ts.server.ServerHost;
  config: Record<string, unknown>;
}

function init(modules: { typescript: typeof ts }): ts.server.PluginModule {
  const typescript = modules.typescript;

  function create(info: PluginCreateInfo): ts.LanguageService {
    const projectDir = info.project.getCurrentDirectory();
    const configPath = typeof info.config.configPath === "string" ? info.config.configPath : undefined;
    let schemaProvider: SchemaProvider;

    try {
      schemaProvider = createSchemaProvider(projectDir, configPath);
    } catch {
      // If schema loading fails, return unmodified language service
      return info.languageService;
    }

    const proxy = Object.create(null) as ts.LanguageService;
    for (const k of Object.keys(info.languageService) as Array<keyof ts.LanguageService>) {
      const x = info.languageService[k];
      // biome-ignore lint/suspicious/noExplicitAny: proxy delegation requires dynamic assignment
      (proxy as any)[k] = typeof x === "function" ? x.bind(info.languageService) : x;
    }

    proxy.getCompletionsAtPosition = (fileName, position, options, formattingSettings) => {
      const program = info.languageService.getProgram();
      if (program) {
        const sourceFile = program.getSourceFile(fileName);
        if (sourceFile) {
          const templateInfo = findTemplateAtPosition(sourceFile, position, typescript);
          if (templateInfo) {
            const schema = schemaProvider.getSchema(templateInfo.schemaName);
            if (schema) {
              const entries = getGraphQLCompletions(templateInfo, schema, position);
              if (entries.length > 0) {
                return {
                  isGlobalCompletion: false,
                  isMemberCompletion: false,
                  isNewIdentifierLocation: false,
                  entries,
                };
              }
            }
          }
        }
      }

      // Fall through to original language service
      return info.languageService.getCompletionsAtPosition(fileName, position, options, formattingSettings);
    };

    return proxy;
  }

  return { create };
}

export default init;

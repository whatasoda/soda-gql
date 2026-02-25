/**
 * TypeScript Language Service Plugin for soda-gql.
 *
 * Provides GraphQL field completion inside soda-gql tagged template literals
 * by intercepting `getCompletionsAtPosition` within tsserver.
 */
import type ts from "typescript";

interface PluginCreateInfo {
  project: ts.server.Project;
  languageService: ts.LanguageService;
  languageServiceHost: ts.LanguageServiceHost;
  serverHost: ts.server.ServerHost;
  config: Record<string, unknown>;
}

function init(modules: { typescript: typeof ts }): ts.server.PluginModule {
  const _ts = modules.typescript;

  function create(info: PluginCreateInfo): ts.LanguageService {
    const proxy = Object.create(null) as ts.LanguageService;
    for (const k of Object.keys(info.languageService) as Array<
      keyof ts.LanguageService
    >) {
      const x = info.languageService[k];
      // biome-ignore lint/suspicious/noExplicitAny: proxy delegation requires dynamic assignment
      (proxy as any)[k] = typeof x === "function" ? x.bind(info.languageService) : x;
    }

    // TODO: Wire getCompletionsAtPosition override in Phase 2
    void _ts;

    return proxy;
  }

  return { create };
}

export default init;

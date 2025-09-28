import ts from "typescript";
import { dirname, isAbsolute, join } from "node:path";
import { getProjectRoot } from "./index.ts";

export type TypeCheckInput = {
  path: string;
  content: string;
};

export type TypeCheckOptions = {
  tsconfigPath?: string;
};

const runtimeStubContent = `declare module "@soda-gql/runtime" {
  export namespace graphql {
    export type DocumentNode = unknown;
  }
  export type graphql = graphql.DocumentNode;
  type RuntimeBuilder = (...args: any[]) => unknown;

  export type RuntimeQueryConfig = {
    name: string;
    document: unknown;
    variableNames: readonly string[];
    getSlices: RuntimeBuilder;
    projectionPathGraph?: unknown;
  };

  export type RuntimeModelConfig = {
    typename: string;
    variables?: unknown;
    transform: RuntimeBuilder;
  };

  export type RuntimeSliceConfig = {
    rootFieldKeys: readonly string[];
    projections: unknown;
  };

  export type RuntimeFragmentConfig = {
    name?: string;
    fragment: unknown;
    variableNames?: readonly string[];
    getRemote?: RuntimeBuilder;
  };

  export type Model = {
    fragment: RuntimeBuilder;
    transform: RuntimeBuilder;
    typename: string;
  };

  export type Slice = RuntimeBuilder;

  export const gqlRuntime: {
    query: (config: RuntimeQueryConfig) => unknown;
    model: (config: RuntimeModelConfig) => Model;
    querySlice: (config: RuntimeSliceConfig) => Slice;
    fragment: (config: RuntimeFragmentConfig) => unknown;
    mutation: (config: RuntimeQueryConfig) => unknown;
    subscription: (config: RuntimeQueryConfig) => unknown;
    mutationSlice: (config: RuntimeSliceConfig) => Slice;
    subscriptionSlice: (config: RuntimeSliceConfig) => Slice;
    handleProjectionBuilder: RuntimeBuilder;
  };
}

declare module "@/graphql-runtime" {
  export * from "@soda-gql/runtime";
}
`;

const graphqlSystemStubContent = `declare module "@/graphql-system" {
  type ScalarHelper = (...args: any[]) => unknown;

  type GraphqlHelpers = {
    query: (...args: any[]) => unknown;
    model: (...args: any[]) => unknown;
    querySlice: (...args: any[]) => unknown;
    fragment: (...args: any[]) => unknown;
    scalar: ScalarHelper;
  };

  export const gql: {
    default: (factory: (helpers: GraphqlHelpers) => unknown) => unknown;
    query: (...args: any[]) => unknown;
    model: (...args: any[]) => unknown;
    querySlice: (...args: any[]) => unknown;
    fragment: (...args: any[]) => unknown;
    scalar: ScalarHelper;
  };
}
`;

const createFormatHost = (
  projectRoot: string,
  useCaseSensitiveFileNames: boolean,
): ts.FormatDiagnosticsHost => {
  return {
    getCanonicalFileName: (fileName) => (useCaseSensitiveFileNames ? fileName : fileName.toLowerCase()),
    getCurrentDirectory: () => projectRoot,
    getNewLine: () => ts.sys.newLine,
  };
};

export const typeCheckFiles = async (
  files: TypeCheckInput[],
  options: TypeCheckOptions = {},
): Promise<void> => {
  if (files.length === 0) {
    return;
  }

  const projectRoot = getProjectRoot();
  const tsconfigPath = options.tsconfigPath ?? join(projectRoot, "tsconfig.base.json");

  const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
  if (configFile.error) {
    const formatHost = createFormatHost(projectRoot, ts.sys.useCaseSensitiveFileNames);
    throw new Error(
      `Failed to read TypeScript config at ${tsconfigPath}:\n${ts.formatDiagnosticsWithColorAndContext([configFile.error], formatHost)}`,
    );
  }

  const parsedConfig = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    dirname(tsconfigPath),
    undefined,
    tsconfigPath,
  );

  if (parsedConfig.errors.length > 0) {
    const formatHost = createFormatHost(projectRoot, ts.sys.useCaseSensitiveFileNames);
    throw new Error(
      `Failed to parse TypeScript config at ${tsconfigPath}:\n${ts.formatDiagnosticsWithColorAndContext(parsedConfig.errors, formatHost)}`,
    );
  }

  const compilerOptions: ts.CompilerOptions = {
    ...parsedConfig.options,
    noEmit: true,
  };

  compilerOptions.strict = false;
  compilerOptions.noImplicitAny = false;

  const projectBaseUrl = compilerOptions.baseUrl ?? projectRoot;
  const typeCheckPathPrefix = "tests/__typecheck__";
  const runtimeStubPath = join(projectRoot, typeCheckPathPrefix, "runtime.d.ts");
  const graphqlSystemStubPath = join(projectRoot, typeCheckPathPrefix, "graphql-system.d.ts");

  compilerOptions.baseUrl = projectBaseUrl;
  compilerOptions.paths = {
    ...(compilerOptions.paths ?? {}),
    "@soda-gql/runtime": [join(typeCheckPathPrefix, "runtime")],
    "@/graphql-runtime": [join(typeCheckPathPrefix, "runtime")],
    "@/graphql-runtime/*": [join(typeCheckPathPrefix, "runtime")],
    "@/graphql-system": [join(typeCheckPathPrefix, "graphql-system")],
    "@/graphql-system/*": [join(typeCheckPathPrefix, "graphql-system")],
  };

  const compilerHost = ts.createCompilerHost(compilerOptions, true);
  const useCaseSensitiveFileNames = compilerHost.useCaseSensitiveFileNames?.() ?? ts.sys.useCaseSensitiveFileNames;

  const stubModuleEntries = new Map<string, string>([
    ["@soda-gql/runtime", runtimeStubPath],
    ["@/graphql-runtime", runtimeStubPath],
    ["@/graphql-system", graphqlSystemStubPath],
  ]);

  const originalResolveModuleNames = compilerHost.resolveModuleNames?.bind(compilerHost);
  compilerHost.resolveModuleNames = (moduleNames, containingFile, ...rest) => {
    const fallbackResolutions = originalResolveModuleNames?.(moduleNames, containingFile, ...rest) ?? [];

    return moduleNames.map((moduleName, index) => {
      const directStub = stubModuleEntries.get(moduleName);
      if (directStub) {
        return {
          resolvedFileName: directStub,
          extension: ts.Extension.Dts,
          isExternalLibraryImport: false,
        } satisfies ts.ResolvedModuleFull;
      }

      if (moduleName.startsWith("@/graphql-system/")) {
        return {
          resolvedFileName: graphqlSystemStubPath,
          extension: ts.Extension.Dts,
          isExternalLibraryImport: false,
        } satisfies ts.ResolvedModuleFull;
      }

      if (moduleName.startsWith("@/graphql-runtime/")) {
        return {
          resolvedFileName: runtimeStubPath,
          extension: ts.Extension.Dts,
          isExternalLibraryImport: false,
        } satisfies ts.ResolvedModuleFull;
      }

      const fallbackResolution = fallbackResolutions[index];
      if (fallbackResolution) {
        return fallbackResolution;
      }

      const resolution = ts.resolveModuleName(moduleName, containingFile, compilerOptions, ts.sys);
      return resolution.resolvedModule;
    });
  };

  const normalizePath = (filePath: string): string => {
    const resolved = ts.sys.resolvePath(filePath);
    return useCaseSensitiveFileNames ? resolved : resolved.toLowerCase();
  };

  const allFiles = [
    ...files,
    { path: runtimeStubPath, content: runtimeStubContent },
    { path: graphqlSystemStubPath, content: graphqlSystemStubContent },
  ];

  const virtualFiles = allFiles.map((file, index) => {
    const absolutePath = isAbsolute(file.path) ? file.path : join(projectRoot, file.path);
    const resolvedPath = ts.sys.resolvePath(absolutePath);

    return {
      id: index,
      absolutePath: resolvedPath,
      normalizedPath: normalizePath(resolvedPath),
      content: file.content,
    };
  });

  const fileContentMap = new Map<string, { path: string; content: string }>();
  for (const file of virtualFiles) {
    fileContentMap.set(file.normalizedPath, { path: file.absolutePath, content: file.content });
  }

  const originalReadFile = compilerHost.readFile?.bind(compilerHost) ?? ts.sys.readFile;
  const originalFileExists = compilerHost.fileExists?.bind(compilerHost) ?? ts.sys.fileExists;
  const originalGetSourceFile = compilerHost.getSourceFile.bind(compilerHost);

  compilerHost.readFile = (fileName: string): string | undefined => {
    const normalized = normalizePath(fileName);
    const virtualFile = fileContentMap.get(normalized);
    if (virtualFile) {
      return virtualFile.content;
    }

    return originalReadFile(fileName);
  };

  compilerHost.fileExists = (fileName: string): boolean => {
    const normalized = normalizePath(fileName);
    if (fileContentMap.has(normalized)) {
      return true;
    }

    return originalFileExists(fileName);
  };

  compilerHost.getSourceFile = (
    fileName,
    languageVersion,
    onError,
    shouldCreateNewSourceFile,
  ) => {
    const normalized = normalizePath(fileName);
    const virtualFile = fileContentMap.get(normalized);
    if (virtualFile) {
      return ts.createSourceFile(virtualFile.path, virtualFile.content, languageVersion, true, ts.ScriptKind.TS);
    }

    return originalGetSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile);
  };

  const rootNames = virtualFiles.map((file) => file.absolutePath);
  const program = ts.createProgram(rootNames, compilerOptions, compilerHost);

  const diagnostics = [
    ...program.getConfigFileParsingDiagnostics(),
    ...program.getOptionsDiagnostics(),
    ...program.getSyntacticDiagnostics(),
    ...program.getGlobalDiagnostics(),
    ...program.getSemanticDiagnostics(),
  ];

  if (diagnostics.length > 0) {
    const formatHost = createFormatHost(projectRoot, useCaseSensitiveFileNames);
    const formatted = ts.formatDiagnosticsWithColorAndContext(diagnostics, formatHost);
    throw new Error(`TypeScript type check failed:\n${formatted}`);
  }
};

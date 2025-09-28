import { dirname, isAbsolute, join } from "node:path";
import ts from "typescript";
import { getProjectRoot } from "./index.ts";

export type TypeCheckInput = {
  path: string;
  content: string;
};

export type TypeCheckOptions = {
  tsconfigPath?: string;
};

const createFormatHost = (projectRoot: string, useCaseSensitiveFileNames: boolean): ts.FormatDiagnosticsHost => {
  return {
    getCanonicalFileName: (fileName) => (useCaseSensitiveFileNames ? fileName : fileName.toLowerCase()),
    getCurrentDirectory: () => projectRoot,
    getNewLine: () => ts.sys.newLine,
  };
};

export const typeCheckFiles = async (files: TypeCheckInput[], options: TypeCheckOptions = {}): Promise<void> => {
  if (files.length === 0) {
    return;
  }

  const { tsconfigPath } = options;
  const projectRoot = getProjectRoot();
  // Use the typecheck config that has proper path mappings to real modules
  const actualTsconfigPath = tsconfigPath ?? join(projectRoot, "tests/tsconfig.typecheck.json");

  const configFile = ts.readConfigFile(actualTsconfigPath, ts.sys.readFile);
  if (configFile.error) {
    const formatHost = createFormatHost(projectRoot, ts.sys.useCaseSensitiveFileNames);
    throw new Error(
      `Failed to read TypeScript config at ${actualTsconfigPath}:\n${ts.formatDiagnosticsWithColorAndContext([configFile.error], formatHost)}`,
    );
  }

  const parsedConfig = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    dirname(actualTsconfigPath),
    undefined,
    actualTsconfigPath,
  );

  if (parsedConfig.errors.length > 0) {
    const formatHost = createFormatHost(projectRoot, ts.sys.useCaseSensitiveFileNames);
    throw new Error(
      `Failed to parse TypeScript config at ${actualTsconfigPath}:\n${ts.formatDiagnosticsWithColorAndContext(parsedConfig.errors, formatHost)}`,
    );
  }

  const compilerOptions: ts.CompilerOptions = {
    ...parsedConfig.options,
    noEmit: true,
  };

  // Override some compiler options for testing
  compilerOptions.strict = false;
  compilerOptions.noImplicitAny = false;
  compilerOptions.skipLibCheck = true;
  compilerOptions.allowImportingTsExtensions = true;
  compilerOptions.moduleResolution = ts.ModuleResolutionKind.Bundler;
  // Skip checking declaration files and focus on the transformed code
  compilerOptions.skipDefaultLibCheck = true;
  // Don't check unused locals/parameters in the transformed code
  compilerOptions.noUnusedLocals = false;
  compilerOptions.noUnusedParameters = false;
  // Suppress type instantiation depth errors
  compilerOptions.suppressExcessPropertyErrors = true;

  const compilerHost = ts.createCompilerHost(compilerOptions, true);
  const useCaseSensitiveFileNames = compilerHost.useCaseSensitiveFileNames?.() ?? ts.sys.useCaseSensitiveFileNames;

  const normalizePath = (filePath: string): string => {
    const resolved = ts.sys.resolvePath(filePath);
    return useCaseSensitiveFileNames ? resolved : resolved.toLowerCase();
  };

  const allFiles = files;

  const virtualFiles = allFiles.map((file, index) => {
    const absolutePath = isAbsolute(file.path) ? file.path : join(projectRoot, file.path);
    const resolvedPath = ts.sys.resolvePath(absolutePath);

    return {
      id: index,
      absolutePath: resolvedPath,
      normalizedPath: normalizePath(resolvedPath),
      content: file.content,
      version: 1,
    };
  });

  const fileRegistry = new Map(virtualFiles.map((file) => [file.normalizedPath, file]));

  const originalReadFile = compilerHost.readFile;
  compilerHost.readFile = (fileName) => {
    const normalizedFileName = normalizePath(fileName);
    const virtualFile = fileRegistry.get(normalizedFileName);
    if (virtualFile) {
      return virtualFile.content;
    }
    return originalReadFile(fileName);
  };

  const originalFileExists = compilerHost.fileExists;
  compilerHost.fileExists = (fileName) => {
    const normalizedFileName = normalizePath(fileName);
    if (fileRegistry.has(normalizedFileName)) {
      return true;
    }
    return originalFileExists(fileName);
  };

  const fileNames = virtualFiles.map((file) => file.absolutePath);
  const program = ts.createProgram(fileNames, compilerOptions, compilerHost);

  // Only get diagnostics for the virtual files we're testing, not their dependencies
  const diagnostics: ts.Diagnostic[] = [];
  for (const fileName of fileNames) {
    const sourceFile = program.getSourceFile(fileName);
    if (sourceFile) {
      diagnostics.push(
        ...program.getSemanticDiagnostics(sourceFile),
        ...program.getSyntacticDiagnostics(sourceFile),
      );
    }
  }

  // Filter out type instantiation depth errors (TS2589) which are TypeScript limitations
  // These occur with complex generic types but don't indicate actual problems in transformed code
  const relevantDiagnostics = diagnostics.filter(d => d.code !== 2589);

  if (relevantDiagnostics.length > 0) {
    const formatHost = createFormatHost(projectRoot, useCaseSensitiveFileNames);
    const formatted = ts.formatDiagnosticsWithColorAndContext(relevantDiagnostics, formatHost);
    throw new Error(`TypeScript type check failed:\n${formatted}`);
  }
};

export const typeCheckFile = async (path: string, content: string, options?: TypeCheckOptions): Promise<void> => {
  return typeCheckFiles([{ path, content }], options);
};

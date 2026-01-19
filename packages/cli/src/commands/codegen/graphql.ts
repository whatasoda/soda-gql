/**
 * Codegen graphql subcommand - generates compat code from .graphql files.
 * @module
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative, resolve } from "node:path";
import { normalizePath } from "@soda-gql/common";
import type { EnrichedFragment, EnrichedOperation, ParseResult } from "@soda-gql/codegen";
import { emitFragment, emitOperation, loadSchema, parseGraphqlSource, transformParsedGraphql } from "@soda-gql/codegen";
import { loadConfig } from "@soda-gql/config";
import { Glob } from "bun";
import { err, ok } from "neverthrow";
import { type CliResult, cliErrors } from "../../errors";
import { CodegenGraphqlArgsSchema } from "../../schemas/args";
import type { CommandResult, CommandSuccess } from "../../types";
import { parseArgs } from "../../utils/parse-args";

type ParsedGraphqlArgs = {
  schemaName: string;
  schemaFiles: readonly string[];
  inputPatterns: readonly string[];
  /** Output file suffix (e.g., ".compat.ts", ".generated.ts") */
  suffix: string;
  /** Resolved absolute path to graphql-system directory (config.outdir) */
  graphqlSystemDir: string;
};

const parseGraphqlArgs = (argv: readonly string[]): CliResult<ParsedGraphqlArgs> => {
  const parsed = parseArgs([...argv], CodegenGraphqlArgsSchema);

  if (!parsed.isOk()) {
    return err(cliErrors.argsInvalid("codegen graphql", parsed.error));
  }

  const args = parsed.value;

  // Load config from @soda-gql/config
  const configResult = loadConfig(args.config);
  if (configResult.isErr()) {
    return err(cliErrors.fromConfig(configResult.error));
  }

  const config = configResult.value;

  // Get schema name (required if multiple schemas, or use the only one)
  const schemaNames = Object.keys(config.schemas ?? {});
  if (schemaNames.length === 0) {
    return err(cliErrors.argsInvalid("codegen graphql", "No schemas configured in soda-gql.config.ts"));
  }

  let schemaName = args.schema;
  if (!schemaName) {
    const firstSchema = schemaNames[0];
    if (schemaNames.length > 1 || !firstSchema) {
      return err(
        cliErrors.argsInvalid(
          "codegen graphql",
          `Multiple schemas configured. Use --schema to specify: ${schemaNames.join(", ")}`,
        ),
      );
    }
    schemaName = firstSchema;
  }

  const schemaConfig = config.schemas?.[schemaName];
  if (!schemaConfig) {
    return err(cliErrors.argsInvalid("codegen graphql", `Schema "${schemaName}" not found in config`));
  }

  // Get input patterns from args
  let inputPatterns: readonly string[] = [];
  if (args.input) {
    inputPatterns = Array.isArray(args.input) ? args.input : [args.input];
  }

  if (inputPatterns.length === 0) {
    return err(
      cliErrors.argsInvalid("codegen graphql", "No input patterns provided. Use --input to specify .graphql file patterns"),
    );
  }

  // Get suffix from CLI args or config
  const suffix = args.suffix ?? config.codegen.graphql.suffix;

  return ok({
    schemaName,
    schemaFiles: schemaConfig.schema,
    inputPatterns,
    suffix,
    graphqlSystemDir: resolve(config.outdir),
  });
};

type GeneratedFile = {
  inputPath: string;
  outputPath: string;
  content: string;
};

type GraphqlGenerationResult = {
  files: GeneratedFile[];
  operationCount: number;
  fragmentCount: number;
};

const generateCompatFiles = async (args: ParsedGraphqlArgs): Promise<CliResult<GraphqlGenerationResult>> => {
  // Load schema
  const schemaResult = loadSchema(args.schemaFiles.map((s) => resolve(s)));
  if (schemaResult.isErr()) {
    return err(cliErrors.fromCodegen(schemaResult.error));
  }
  const schemaDocument = schemaResult.value;

  // Find all .graphql files matching input patterns
  const graphqlFiles: string[] = [];
  for (const pattern of args.inputPatterns) {
    const glob = new Glob(pattern);
    for await (const file of glob.scan({ cwd: process.cwd(), absolute: true })) {
      if (file.endsWith(".graphql") || file.endsWith(".gql")) {
        graphqlFiles.push(file);
      }
    }
  }

  if (graphqlFiles.length === 0) {
    return err(
      cliErrors.argsInvalid("codegen graphql", `No .graphql files found matching patterns: ${args.inputPatterns.join(", ")}`),
    );
  }

  // Track all fragments for cross-file imports
  const fragmentsByName = new Map<string, { file: string; outputPath: string }>();
  // Cache parsed results to avoid re-reading and re-parsing files
  const parseCache = new Map<string, ParseResult>();

  // First pass: collect all fragments and cache parse results
  for (const file of graphqlFiles) {
    const source = await readFile(file, "utf-8");
    const parseResult = parseGraphqlSource(source, file);
    if (parseResult.isErr()) {
      return err(cliErrors.parseError(parseResult.error.message, file));
    }

    const parsed = parseResult.value;
    parseCache.set(file, parsed);

    const outputBase = basename(file).replace(/\.(graphql|gql)$/, args.suffix);
    const outputPath = join(dirname(file), outputBase);

    for (const frag of parsed.fragments) {
      const existing = fragmentsByName.get(frag.name);
      if (existing && existing.file !== file) {
        return err(cliErrors.duplicateFragment(frag.name, existing.file, file));
      }
      fragmentsByName.set(frag.name, { file, outputPath });
    }
  }

  // Second pass: generate code (using cached parse results)
  const files: GeneratedFile[] = [];
  let operationCount = 0;
  let fragmentCount = 0;

  for (const file of graphqlFiles) {
    // Use cached parse result instead of re-reading file
    const parsed = parseCache.get(file);
    if (!parsed) {
      throw new Error(`Internal error: parse cache missing for ${file}`);
    }

    const transformResult = transformParsedGraphql(parsed, { schemaDocument });
    if (transformResult.isErr()) {
      const error = transformResult.error;
      return err(cliErrors.parseError(error.message, file));
    }

    const { operations, fragments } = transformResult.value;

    const outputBase = basename(file).replace(/\.(graphql|gql)$/, args.suffix);
    const outputPath = join(dirname(file), outputBase);

    // Build fragment imports map for this file
    const fragmentImports = new Map<string, string>();
    const collectDeps = (deps: readonly string[]): CliResult<void> => {
      for (const fragName of deps) {
        const fragInfo = fragmentsByName.get(fragName);
        if (!fragInfo) {
          return err(cliErrors.fragmentNotFound(fragName, file));
        }
        if (fragInfo.outputPath !== outputPath) {
          // Calculate relative import path (normalize for cross-platform compatibility)
          const relativePath = normalizePath(relative(dirname(outputPath), fragInfo.outputPath)).replace(/\.ts$/, "");
          const importPath = relativePath.startsWith(".") ? relativePath : `./${relativePath}`;
          fragmentImports.set(fragName, importPath);
        }
      }
      return ok(undefined);
    };

    // Collect dependencies from operations and fragments
    for (const op of operations) {
      const result = collectDeps(op.fragmentDependencies);
      if (result.isErr()) {
        return err(result.error);
      }
    }
    for (const frag of fragments) {
      const result = collectDeps(frag.fragmentDependencies);
      if (result.isErr()) {
        return err(result.error);
      }
    }

    // Calculate graphqlSystemPath as relative path from output file (normalize for cross-platform compatibility)
    const graphqlSystemRelative = normalizePath(relative(dirname(outputPath), args.graphqlSystemDir));
    const graphqlSystemPath = graphqlSystemRelative.startsWith(".") ? graphqlSystemRelative : `./${graphqlSystemRelative}`;

    // Generate code
    const emitOptions = {
      schemaName: args.schemaName,
      graphqlSystemPath,
      fragmentImports,
      schemaDocument,
    };

    const parts: string[] = [];

    for (const op of operations) {
      const emitResult = emitOperation(op as EnrichedOperation, emitOptions);
      if (emitResult.isErr()) {
        return err(cliErrors.parseError(emitResult.error.message, file));
      }
      parts.push(emitResult.value);
      operationCount++;
    }

    for (const frag of fragments) {
      const emitResult = emitFragment(frag as EnrichedFragment, emitOptions);
      if (emitResult.isErr()) {
        return err(cliErrors.parseError(emitResult.error.message, file));
      }
      parts.push(emitResult.value);
      fragmentCount++;
    }

    if (parts.length > 0) {
      files.push({
        inputPath: file,
        outputPath,
        content: parts.join("\n\n"),
      });
    }
  }

  return ok({ files, operationCount, fragmentCount });
};

const writeGeneratedFiles = async (files: GeneratedFile[]): Promise<CliResult<void>> => {
  for (const file of files) {
    // Ensure directory exists
    const dir = dirname(file.outputPath);
    await mkdir(dir, { recursive: true });

    // Write file
    await writeFile(file.outputPath, file.content, "utf-8");
  }
  return ok(undefined);
};

const formatSuccess = (result: GraphqlGenerationResult): string => {
  const lines = [
    `Generated ${result.operationCount} operation(s) and ${result.fragmentCount} fragment(s) from ${result.files.length} file(s):`,
  ];
  for (const file of result.files) {
    lines.push(`  ${relative(process.cwd(), file.outputPath)}`);
  }
  return lines.join("\n");
};

export const GRAPHQL_HELP = `Usage: soda-gql codegen graphql [options]

Generate TypeScript compat code from .graphql operation files.
Output files are created alongside input files.

Options:
  --config <path>    Path to soda-gql.config.ts
  --schema <name>    Schema name (required if multiple schemas configured)
  --input <glob>     Glob pattern for .graphql files (repeatable)
  --suffix <ext>     Output file suffix (default: ".compat.ts")
  --help, -h         Show this help message

Examples:
  soda-gql codegen graphql --input "src/**/*.graphql"
  soda-gql codegen graphql --input "queries/*.graphql" --suffix ".generated.ts"
`;

type GraphqlCommandResult = CommandResult<CommandSuccess & { data?: GraphqlGenerationResult }>;

export const graphqlCommand = async (argv: readonly string[]): Promise<GraphqlCommandResult> => {
  if (argv.includes("--help") || argv.includes("-h")) {
    return ok({ message: GRAPHQL_HELP });
  }

  const parsed = parseGraphqlArgs(argv);
  if (parsed.isErr()) {
    return err(parsed.error);
  }

  const result = await generateCompatFiles(parsed.value);
  if (result.isErr()) {
    return err(result.error);
  }

  const writeResult = await writeGeneratedFiles(result.value.files);
  if (writeResult.isErr()) {
    return err(writeResult.error);
  }

  return ok({ message: formatSuccess(result.value), data: result.value });
};

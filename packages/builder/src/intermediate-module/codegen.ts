import type { ModuleImport } from "../ast";
import type { DependencyGraphNode, ModuleSummary } from "../dependency-graph";
import type { FileGroup } from "./analysis";
import { resolveImportPath } from "./analysis";

const formatFactory = (expression: string): string => {
  const trimmed = expression.trim();
  if (!trimmed.includes("\n")) {
    return trimmed;
  }

  const lines = trimmed.split("\n").map((line) => line.trimEnd());
  const indented = lines.map((line, index) => (index === 0 ? line : `    ${line}`)).join("\n");

  return `(\n    ${indented}\n  )`;
};

type TreeNode = {
  expression?: string; // Leaf node with actual expression
  canonicalId?: string; // Canonical ID for this node
  children: Map<string, TreeNode>; // Branch node with children
};

const buildTree = (nodes: DependencyGraphNode[]): Map<string, TreeNode> => {
  const roots = new Map<string, TreeNode>();

  nodes.forEach((node) => {
    const parts = node.localPath.split(".");
    const expressionText = node.definition.expression.trim();

    if (parts.length === 1) {
      // Top-level export
      const rootName = parts[0];
      if (rootName) {
        roots.set(rootName, {
          expression: expressionText,
          canonicalId: node.id,
          children: new Map(),
        });
      }
    } else {
      // Nested export
      const rootName = parts[0];
      if (!rootName) return;

      let root = roots.get(rootName);
      if (!root) {
        root = { children: new Map() };
        roots.set(rootName, root);
      }

      let current = root;
      for (let i = 1; i < parts.length - 1; i++) {
        const part = parts[i];
        if (!part) continue;

        let child = current.children.get(part);
        if (!child) {
          child = { children: new Map() };
          current.children.set(part, child);
        }
        current = child;
      }

      const leafName = parts[parts.length - 1];
      if (leafName) {
        current.children.set(leafName, {
          expression: expressionText,
          canonicalId: node.id,
          children: new Map(),
        });
      }
    }
  });

  return roots;
};

/**
 * Check if a string is a valid JavaScript identifier
 */
const isValidIdentifier = (name: string): boolean => {
  // JavaScript identifier regex: starts with letter, _, or $, followed by letters, digits, _, or $
  return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name) && !isReservedWord(name);
};

/**
 * Check if a string is a JavaScript reserved word
 */
const isReservedWord = (name: string): boolean => {
  const reserved = new Set([
    "break",
    "case",
    "catch",
    "class",
    "const",
    "continue",
    "debugger",
    "default",
    "delete",
    "do",
    "else",
    "export",
    "extends",
    "finally",
    "for",
    "function",
    "if",
    "import",
    "in",
    "instanceof",
    "new",
    "return",
    "super",
    "switch",
    "this",
    "throw",
    "try",
    "typeof",
    "var",
    "void",
    "while",
    "with",
    "yield",
    "let",
    "static",
    "enum",
    "await",
    "implements",
    "interface",
    "package",
    "private",
    "protected",
    "public",
  ]);
  return reserved.has(name);
};

/**
 * Format a key for use in an object literal
 * Invalid identifiers are quoted, valid ones are not
 */
const formatObjectKey = (key: string): string => {
  return isValidIdentifier(key) ? key : `"${key}"`;
};

const renderTreeNode = (node: TreeNode, indent: number): string => {
  if (node.expression && node.children.size === 0 && node.canonicalId) {
    // Leaf node - use addBuilder
    const expr = formatFactory(node.expression);
    return `registry.addBuilder("${node.canonicalId}", () => ${expr})`;
  }

  // Branch node - render nested object
  const indentStr = "  ".repeat(indent);
  const entries = Array.from(node.children.entries()).map(([key, child]) => {
    const value = renderTreeNode(child, indent + 1);
    const formattedKey = formatObjectKey(key);
    return `${indentStr}  ${formattedKey}: ${value},`;
  });

  if (entries.length === 0) {
    return "{}";
  }

  return `{\n${entries.join("\n")}\n${indentStr}}`;
};

const buildNestedObject = (nodes: DependencyGraphNode[]): string => {
  const tree = buildTree(nodes);
  const declarations: string[] = [];
  const returnEntries: string[] = [];

  tree.forEach((node, rootName) => {
    if (node.children.size > 0) {
      // Has children - create a const declaration
      const objectLiteral = renderTreeNode(node, 2);
      declarations.push(`    const ${rootName} = ${objectLiteral};`);
      returnEntries.push(rootName);
    } else if (node.expression && node.canonicalId) {
      // Single export - use addBuilder
      const expr = formatFactory(node.expression);
      declarations.push(`    const ${rootName} = registry.addBuilder("${node.canonicalId}", () => ${expr});`);
      returnEntries.push(rootName);
    }
  });

  const returnStatement =
    returnEntries.length > 0
      ? `    return {\n${returnEntries.map((name) => `        ${name},`).join("\n")}\n    };`
      : "    return {};";

  if (declarations.length === 0) {
    return returnStatement;
  }

  return `${declarations.join("\n")}\n${returnStatement}`;
};

/**
 * Render import statements for the intermediate module using ModuleSummary.
 * Only includes imports from modules that have gql exports.
 */
const renderImportStatements = (
  summary: ModuleSummary,
  summaries: Map<string, ModuleSummary>,
): { imports: string; importedRootNames: Set<string>; namespaceImports: Set<string> } => {
  const importLines: string[] = [];
  const importedRootNames = new Set<string>();
  const namespaceImports = new Set<string>();

  // Group imports by resolved file path
  const importsByFile = new Map<string, ModuleImport[]>();

  summary.runtimeImports.forEach((imp) => {
    // Skip non-relative imports (external packages)
    if (!imp.source.startsWith(".")) {
      return;
    }

    const resolvedPath = resolveImportPath(summary.filePath, imp.source, summaries);
    if (!resolvedPath) {
      return;
    }

    const targetSummary = summaries.get(resolvedPath);
    if (!targetSummary) {
      return;
    }

    // Only include imports from modules with gql exports
    if (targetSummary.gqlExports.length === 0) {
      return;
    }

    const imports = importsByFile.get(resolvedPath) ?? [];
    imports.push(imp);
    importsByFile.set(resolvedPath, imports);
  });

  // Render registry.import() for each file
  importsByFile.forEach((imports, filePath) => {
    // Check if this is a namespace import
    const namespaceImport = imports.find((imp) => imp.kind === "namespace");

    if (namespaceImport) {
      // Namespace import: const foo = registry.import("path");
      importLines.push(`    const ${namespaceImport.local} = registry.import("${filePath}");`);
      namespaceImports.add(namespaceImport.local);
      importedRootNames.add(namespaceImport.local);
    } else {
      // Named imports: const { a, b } = registry.import("path");
      const rootNames = new Set<string>();

      imports.forEach((imp) => {
        if (imp.kind === "named" || imp.kind === "default") {
          rootNames.add(imp.local);
          importedRootNames.add(imp.local);
        }
      });

      if (rootNames.size > 0) {
        const destructured = Array.from(rootNames).sort().join(", ");
        importLines.push(`    const { ${destructured} } = registry.import("${filePath}");`);
      }
    }
  });

  return {
    imports: importLines.length > 0 ? `\n${importLines.join("\n")}\n` : "",
    importedRootNames,
    namespaceImports,
  };
};

const renderRegistryBlock = (fileGroup: FileGroup, summaries: Map<string, ModuleSummary>): string => {
  const { filePath, nodes } = fileGroup;

  // Get the module summary for this file
  const summary = summaries.get(filePath) ?? ({ filePath, runtimeImports: [], gqlExports: [] } satisfies ModuleSummary);

  const { imports } = renderImportStatements(summary, summaries);
  const body = buildNestedObject(nodes);

  return `registry.register("${filePath}", () => {${imports}\n${body}\n});`;
};

export type IntermediateModuleSourceInput = {
  readonly fileGroups: FileGroup[];
  readonly summaries: Map<string, ModuleSummary>;
  readonly gqlImportPath: string;
};

/**
 * Build the complete intermediate module source code.
 */
export const buildIntermediateModuleSource = ({
  fileGroups,
  summaries,
  gqlImportPath,
}: IntermediateModuleSourceInput): string => {
  const registryBlocks = fileGroups.map((group) => renderRegistryBlock(group, summaries));

  const imports = [
    `import { gql } from "${gqlImportPath}";`,
    `import { createPseudoModuleRegistry, createIssueRegistry, setActiveRegistry } from "@soda-gql/core";`,
  ];

  const registrySection = `// Initialize issue registry for build-time validation
export const issueRegistry = createIssueRegistry();
setActiveRegistry(issueRegistry);`;

  const pseudoRegistrySection = `const registry = createPseudoModuleRegistry();`;

  const registryBlocksSection = registryBlocks.join("\n\n");

  const evaluationSection = `export const { models, slices, operations } = registry.evaluate();`;

  return `${imports.join("\n")}\n\n${registrySection}\n\n${pseudoRegistrySection}\n\n${registryBlocksSection}\n\n${evaluationSection}\n`;
};

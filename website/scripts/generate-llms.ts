import fs from "node:fs/promises";
import path from "node:path";

// --- Types ---

interface SidebarItem {
  text: string;
  link: string;
}

interface SidebarGroup {
  text: string;
  items: SidebarItem[];
}

type SidebarConfig = Record<string, SidebarGroup[]>;

interface GenerateConfig {
  siteTitle: string;
  siteDescription: string;
  siteUrl: string;
  docsRoot: string;
  outputRoot: string;
  sidebar: SidebarConfig;
}

// --- Container directive conversion ---

function convertContainerDirectives(content: string): string {
  return content.replace(
    /^:::(tip|warning|info|note|danger|caution)(?: (.+))?\n([\s\S]*?)^:::/gm,
    (_match, type: string, title: string | undefined, body: string) => {
      const label = title
        ? `**${capitalize(type)}: ${title.trim()}**`
        : `**${capitalize(type)}:**`;
      const trimmedBody = body.trim();
      const lines = trimmedBody ? trimmedBody.split("\n") : [];
      return [label, ...lines].map((line) => `> ${line}`).join("\n");
    },
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// --- Path resolution ---

function linkToSourcePath(docsRoot: string, link: string): string {
  const trimmed = link.endsWith("/") ? link + "index" : link;
  return path.join(docsRoot, trimmed + ".md");
}

function linkToOutputMdPath(link: string): string {
  const trimmed = link.endsWith("/") ? link + "index" : link;
  return trimmed + ".md";
}

// --- Generate cleaned markdown ---

async function generateCleanMarkdown(
  sourcePath: string,
  outputPath: string,
): Promise<string> {
  const raw = await fs.readFile(sourcePath, "utf-8");
  const cleaned = convertContainerDirectives(raw);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, cleaned, "utf-8");
  return cleaned;
}

// --- Generate llms.txt ---

function generateLlmsTxt(config: GenerateConfig): string {
  const lines: string[] = [];
  lines.push(`# ${config.siteTitle}`);
  lines.push("");
  lines.push(`> ${config.siteDescription}`);
  lines.push("");

  for (const groups of Object.values(config.sidebar)) {
    for (const group of groups) {
      lines.push(`## ${group.text}`);
      lines.push("");
      for (const item of group.items) {
        const mdPath = linkToOutputMdPath(item.link);
        lines.push(`- [${item.text}](${config.siteUrl}${mdPath})`);
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}

// --- Generate llms-full.txt ---

function generateLlmsFullTxt(
  config: GenerateConfig,
  contents: Map<string, string>,
): string {
  const lines: string[] = [];
  lines.push(`# ${config.siteTitle}`);
  lines.push("");
  lines.push(`> ${config.siteDescription}`);
  lines.push("");

  for (const groups of Object.values(config.sidebar)) {
    for (const group of groups) {
      for (const item of group.items) {
        const mdPath = linkToOutputMdPath(item.link);
        const content = contents.get(mdPath);
        if (content) {
          lines.push("---");
          lines.push("");
          lines.push(content);
          lines.push("");
        }
      }
    }
  }

  return lines.join("\n");
}

// --- Main ---

async function main(): Promise<void> {
  const scriptDir = import.meta.dirname;
  const websiteRoot = path.join(scriptDir, "..");

  const configModule = await import("../rspress.config.ts");
  const rspressConfig = configModule.default;
  const sidebar = rspressConfig.themeConfig?.sidebar as SidebarConfig;

  let siteUrl: string;
  try {
    const cname = (
      await fs.readFile(path.join(websiteRoot, "public", "CNAME"), "utf-8")
    ).trim();
    siteUrl = `https://${cname}`;
  } catch {
    siteUrl = "https://soda-gql.whatasoda.me";
  }

  const config: GenerateConfig = {
    siteTitle: rspressConfig.title ?? "soda-gql",
    siteDescription: rspressConfig.description ?? "",
    siteUrl,
    docsRoot: path.join(websiteRoot, "docs"),
    outputRoot: path.join(websiteRoot, "doc_build"),
    sidebar,
  };

  const contents = new Map<string, string>();

  for (const groups of Object.values(config.sidebar)) {
    for (const group of groups) {
      for (const item of group.items) {
        const sourcePath = linkToSourcePath(config.docsRoot, item.link);
        const outputMdPath = linkToOutputMdPath(item.link);
        const outputFullPath = path.join(config.outputRoot, outputMdPath);

        try {
          const cleaned = await generateCleanMarkdown(
            sourcePath,
            outputFullPath,
          );
          contents.set(outputMdPath, cleaned);
        } catch (e) {
          console.warn(`Warning: Could not process ${sourcePath}: ${e}`);
        }
      }
    }
  }

  const llmsTxt = generateLlmsTxt(config);
  await fs.writeFile(
    path.join(config.outputRoot, "llms.txt"),
    llmsTxt,
    "utf-8",
  );

  const llmsFullTxt = generateLlmsFullTxt(config, contents);
  await fs.writeFile(
    path.join(config.outputRoot, "llms-full.txt"),
    llmsFullTxt,
    "utf-8",
  );

  console.log(
    `Generated llms.txt, llms-full.txt, and ${contents.size} cleaned .md files`,
  );
}

main().catch((e) => {
  console.error("Failed to generate llms files:", e);
  process.exit(1);
});

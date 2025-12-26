const lcov = await Bun.file(".coverage/lcov.info").text();
const packages = new Map<string, { lf: number; lh: number }>();

let currentFile = "";
let currentLF = 0;
let currentLH = 0;

for (const line of lcov.split("\n")) {
  if (line.startsWith("SF:")) {
    currentFile = line.slice(3);
  } else if (line.startsWith("LF:")) {
    currentLF = parseInt(line.slice(3));
  } else if (line.startsWith("LH:")) {
    currentLH = parseInt(line.slice(3));
    const pkg = currentFile.split("/").slice(0, 2).join("/");
    if (!packages.has(pkg)) {
      packages.set(pkg, { lf: 0, lh: 0 });
    }
    const entry = packages.get(pkg)!;
    entry.lf += currentLF;
    entry.lh += currentLH;
  }
}

let totalLF = 0;
let totalLH = 0;

const rows = [...packages.entries()]
  .filter(([k]) => k.startsWith("packages/"))
  .sort((a, b) => a[0].localeCompare(b[0]))
  .map(([pkg, { lf, lh }]) => {
    totalLF += lf;
    totalLH += lh;
    const pct = lf > 0 ? ((lh / lf) * 100).toFixed(1) : "0.0";
    return `| ${pkg} | ${pct}% | ${lh}/${lf} |`;
  });

const total = totalLF > 0 ? ((totalLH / totalLF) * 100).toFixed(1) : "0.0";

const md = [
  "## Test Coverage Report",
  "",
  `**Overall Coverage: ${total}%** (${totalLH}/${totalLF} lines)`,
  "",
  "| Package | Coverage | Lines |",
  "|---------|----------|-------|",
  ...rows,
].join("\n");

await Bun.write("coverage-summary.md", md);
console.log("Coverage summary generated");

const LSP_HELP = `Usage: soda-gql lsp [options]

Start the GraphQL Language Server Protocol server.

The LSP server communicates over stdio and provides:
  - Diagnostics (validation errors in GraphQL templates)
  - Autocompletion (field, argument, type suggestions)
  - Hover information (type details on hover)

Options:
  --help, -h    Show this help message

The server is typically started by an editor extension, not directly by users.
Configure your editor to use 'soda-gql lsp' as the GraphQL language server command.`;

export const lspCommand = async (argv: readonly string[]): Promise<never> => {
  if (argv.includes("--help") || argv.includes("-h")) {
    process.stdout.write(`${LSP_HELP}\n`);
    process.exit(0);
  }

  // Dynamic import to avoid loading LSP deps for other commands
  const { createLspServer } = await import("@soda-gql/lsp");
  const server = createLspServer();
  server.start();

  // Server runs indefinitely via stdio; this promise never resolves
  await new Promise(() => {});
  // TypeScript needs this for the `never` return type
  throw new Error("unreachable");
};

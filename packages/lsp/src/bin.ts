#!/usr/bin/env node
/**
 * CLI entry point for the soda-gql LSP server.
 * Used by VS Code extension to launch the server.
 */

import { createLspServer } from "./server.js";

const server = createLspServer();
server.start();

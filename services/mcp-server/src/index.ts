#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpServer } from "./mcp.js";
import { startApplicationServer } from "./server.js";

const http = startApplicationServer();
http.on("error", (error) => {
  console.error(`HTTP server unavailable: ${(error as Error).message}`);
  console.error("Another process owns the port, so MCP proposals will not reach the Web UI.");
  console.error("Stop that process, or set PORT to a free port, and restart this session.");
});

const server = createMcpServer();
await server.connect(new StdioServerTransport());

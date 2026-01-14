#!/usr/bin/env node

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import process from 'node:process';
import { startServer } from './server-utils.js';
import { BraveMcpServer } from './server.js';

function createServer(): McpServer {
  // Check for API key
  const BRAVE_API_KEY = process.env.BRAVE_API_KEY;
  if (!BRAVE_API_KEY) {
    console.error('Error: BRAVE_API_KEY environment variable is required');
    process.exit(1);
  }
  const isChatGPT = process.argv.includes('--chatgpt');
  const isUI = process.argv.includes('--ui') || isChatGPT;
  return new BraveMcpServer(BRAVE_API_KEY, isUI, isChatGPT).serverInstance;
}

const http = process.argv.includes('--http');

startServer(createServer, http).catch((error) => {
  console.error('Failed to start MCP server:', error);
  process.exit(1);
});

#!/usr/bin/env node

import process from 'node:process';
import { BraveMcpServer } from './server.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { startServer } from './server-utils.js';

function createServer(): McpServer {
  // Check for API key
  const BRAVE_API_KEY = process.env.BRAVE_API_KEY;
  if (!BRAVE_API_KEY) {
    console.error('Error: BRAVE_API_KEY environment variable is required');
    process.exit(1);
  }
  return new BraveMcpServer(BRAVE_API_KEY).serverInstance;
}

const http = process.argv.includes('--http');

startServer(createServer, http).catch((error) => {
  console.error('Failed to start MCP server:', error);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * Test server entry point with MockBraveSearch.
 * Used for integration testing with MCPJam SDK without making real API calls.
 *
 * Usage:
 *   node dist/test/test-server.js
 *   node dist/test/test-server.js --http
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { BraveSearch } from 'brave-search';
import process from 'node:process';
import { startServer } from '../src/server-utils.js';
import { BraveMcpServer } from '../src/server.js';
import { createMockBraveSearch } from './mocks/index.js';

function createServer(): McpServer {
  const isUI = process.argv.includes('--ui');

  // Create mock BraveSearch with predefined responses
  const mockBraveSearch = createMockBraveSearch();

  // Create server with injected mock
  return new BraveMcpServer(
    'mock-api-key',
    isUI,
    mockBraveSearch as unknown as BraveSearch,
  ).serverInstance;
}

const http = process.argv.includes('--http');

startServer(createServer, http).catch((error) => {
  console.error('Failed to start test MCP server:', error);
  process.exit(1);
});

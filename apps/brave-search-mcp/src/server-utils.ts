/**
 * Shared utilities for running MCP servers with various transports.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Request, Response } from 'express';
import process from 'node:process';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import cors from 'cors';

/**
 * Starts an MCP server using the appropriate transport based on command-line arguments.
 *
 * If `--stdio` is passed, uses stdio transport. Otherwise, uses Streamable HTTP transport.
 *
 * @param createServer - Factory function that creates a new McpServer instance.
 */
export async function startServer(
  createServer: () => McpServer,
  isHttp: boolean = false,
): Promise<void> {
  try {
    if (isHttp) {
      await startStreamableHttpServer(createServer);
    }
    else {
      await startStdioServer(createServer);
    }
  }
  catch (e) {
    console.error(e);
    process.exit(1);
  }
}

/**
 * Starts an MCP server with stdio transport.
 *
 * @param createServer - Factory function that creates a new McpServer instance.
 */
export async function startStdioServer(
  createServer: () => McpServer,
): Promise<void> {
  await createServer().connect(new StdioServerTransport());
}

/**
 * Starts an MCP server with Streamable HTTP transport in stateless mode.
 *
 * Each request creates a fresh server and transport instance, which are
 * closed when the response ends (no session tracking).
 *
 * The server listens on the port specified by the PORT environment variable,
 * defaulting to 3001 if not set.
 *
 * @param createServer - Factory function that creates a new McpServer instance per request.
 */
export async function startStreamableHttpServer(
  createServer: () => McpServer,
): Promise<void> {
  const port = Number.parseInt(process.env.PORT ?? '3001', 10);
  const host = process.env.HOST ?? '0.0.0.0';
  const allowedHostsEnv = process.env.ALLOWED_HOSTS;
  const allowedHosts = allowedHostsEnv
    ?.split(',')
    .map(value => value.trim())
    .filter(Boolean);

  // Express app host/protection can be configured through env vars.
  const expressApp = createMcpExpressApp({
    host,
    allowedHosts: allowedHosts?.length ? allowedHosts : undefined,
  });
  expressApp.use(cors());

  expressApp.all('/mcp', async (req: Request, res: Response) => {
    // Create fresh server and transport for each request (stateless mode)
    const server = createServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    // Clean up when response ends
    res.on('close', () => {
      transport.close().catch(() => {});
      server.close().catch(() => {});
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    }
    catch (error) {
      console.error('MCP error:', error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal server error' },
          id: null,
        });
      }
    }
  });

  const { promise, resolve, reject } = Promise.withResolvers<void>();

  const httpServer = expressApp.listen(port, (err?: Error) => {
    if (err)
      return reject(err);
    console.log(`Server listening on http://localhost:${port}/mcp`);
    resolve();
  });

  const shutdown = () => {
    console.log('\nShutting down...');
    httpServer.close(() => process.exit(0));
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  return promise;
}

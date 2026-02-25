/**
 * Shared utilities for running MCP servers with various transports.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import process from 'node:process';
import { serve } from '@hono/node-server';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { Hono } from 'hono';
import { cors } from 'hono/cors';

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
 * Starts an MCP server with Streamable HTTP transport in stateless mode
 * using Hono and WebStandardStreamableHTTPServerTransport.
 *
 * Each request creates a fresh server and transport instance (no session tracking).
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
  const hostname = process.env.HOST ?? '0.0.0.0';
  const allowedHostsEnv = process.env.ALLOWED_HOSTS;
  const allowedHosts = allowedHostsEnv
    ?.split(',')
    .map(value => value.trim())
    .filter(Boolean);

  const app = new Hono();

  // Enable CORS for all origins
  app.use('*', cors());

  // DNS rebinding protection via Host header validation
  const localhostHosts = ['127.0.0.1', 'localhost', '::1'];
  if (allowedHosts?.length) {
    // Explicit allowlist provided
    app.use('*', async (c, next) => {
      const host = c.req.header('host')?.replace(/:\d+$/, '');
      if (!host || !allowedHosts.includes(host)) {
        return c.json({ error: 'Forbidden: invalid Host header' }, 403);
      }
      await next();
    });
  }
  else if (localhostHosts.includes(hostname)) {
    // Auto-protect localhost bindings
    app.use('*', async (c, next) => {
      const host = c.req.header('host')?.replace(/:\d+$/, '');
      if (!host || !localhostHosts.includes(host)) {
        return c.json({ error: 'Forbidden: invalid Host header' }, 403);
      }
      await next();
    });
  }
  else if (hostname === '0.0.0.0' || hostname === '::') {
    console.warn(
      `Warning: Server is binding to ${hostname} without DNS rebinding protection. `
      + 'Consider using the ALLOWED_HOSTS environment variable to restrict allowed hosts, '
      + 'or use authentication to protect your server.',
    );
  }
  // MCP endpoint - create a fresh transport and server per request (stateless)
  app.all('/mcp', async (c) => {
    const server = createServer();
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    try {
      await server.connect(transport);
      const response = await transport.handleRequest(c.req.raw);

      // Clean up when the client disconnects (not immediately — the response
      // may contain an SSE ReadableStream that's still being consumed)
      c.req.raw.signal.addEventListener('abort', () => {
        transport.close().catch(() => {});
        server.close().catch(() => {});
      });

      return response;
    }
    catch (error) {
      console.error('MCP error:', error);
      transport.close().catch(() => {});
      server.close().catch(() => {});
      return c.json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null,
      }, 500);
    }
  });

  const { promise, resolve, reject: _reject } = Promise.withResolvers<void>();

  const httpServer = serve({
    fetch: app.fetch,
    port,
    hostname,
  }, () => {
    console.log(`Server listening on http://${hostname}:${port}/mcp`);
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

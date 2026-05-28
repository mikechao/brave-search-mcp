/**
 * Shared utilities for running MCP servers with various transports.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallerIdentity } from './auth/identity-context.js';
import type { AuthConfig } from './config-loader.js';
import process from 'node:process';
import { serve } from '@hono/node-server';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { resolveAuthenticatedHttpIdentity } from './auth/http-api-key.js';
import { createRequestContext, runWithRequestContext } from './auth/identity-context.js';
import { createJwtIdentityResolver } from './auth/jwt-bearer.js';
import {
  buildOAuthProtectedResourceMetadata,
  buildOAuthUnauthorizedHeaders,
  createOAuthIdentityResolver,
  OAUTH_PROTECTED_RESOURCE_METADATA_PATH,
} from './auth/oauth-resource-server.js';

export interface StartServerOptions {
  allowedHosts?: string[];
  auth?: AuthConfig;
}

const HTTP_UNAUTHORIZED_HEADERS = {
  'content-type': 'application/json',
  'www-authenticate': 'Bearer realm="brave-search-mcp"',
};

const HTTP_ANONYMOUS_IDENTITY: CallerIdentity = {
  transport: 'http',
  authSource: 'none',
};

const CALLER_IDENTITY_CONTEXT_KEY = 'callerIdentity';

interface HonoVariables {
  Variables: {
    callerIdentity: CallerIdentity;
  };
}

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
  options?: StartServerOptions,
): Promise<void> {
  try {
    if (isHttp) {
      await startStreamableHttpServer(createServer, options);
    }
    else {
      await startStdioServer(createServer, options);
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
  options?: StartServerOptions,
): Promise<void> {
  const callerId = options?.auth?.callerId;
  const identity = callerId
    ? { transport: 'stdio' as const, authSource: 'stdio-env' as const, callerId }
    : { transport: 'stdio' as const, authSource: 'stdio-process' as const };

  await runWithRequestContext(createRequestContext(identity), async () => {
    await createServer().connect(new StdioServerTransport());
  });
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
  options?: StartServerOptions,
): Promise<void> {
  const port = Number.parseInt(process.env.PORT ?? '3001', 10);
  const hostname = process.env.HOST ?? '0.0.0.0';
  const allowedHosts = options?.allowedHosts;

  const app = new Hono<HonoVariables>();

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
      + 'Consider using the ALLOWED_HOSTS environment variable in env mode or [server].allowedHosts in file mode to restrict allowed hosts, '
      + 'or use authentication to protect your server.',
    );
  }
  const oauthConfig = options?.auth?.oauth;
  const oauthIdentityResolver = oauthConfig
    ? await createOAuthIdentityResolver(oauthConfig)
    : undefined;
  const httpApiKey = oauthIdentityResolver || options?.auth?.jwt ? undefined : options?.auth?.httpApiKey;
  const jwtIdentityResolver = oauthIdentityResolver
    ? undefined
    : options?.auth?.jwt
      ? await createJwtIdentityResolver(options.auth.jwt)
      : undefined;

  if (oauthConfig) {
    app.get(OAUTH_PROTECTED_RESOURCE_METADATA_PATH, c =>
      c.json(buildOAuthProtectedResourceMetadata(c.req.url, oauthConfig)));
  }

  app.use('/mcp', async (c, next) => {
    const authorizationHeader = c.req.header('authorization');
    let identity: CallerIdentity | undefined;

    if (oauthIdentityResolver) {
      identity = await oauthIdentityResolver(authorizationHeader);
    }
    else if (jwtIdentityResolver) {
      identity = await jwtIdentityResolver(authorizationHeader);
    }
    else if (httpApiKey) {
      identity = resolveAuthenticatedHttpIdentity(httpApiKey, authorizationHeader);
    }
    else {
      identity = HTTP_ANONYMOUS_IDENTITY;
    }

    if (!identity) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: oauthIdentityResolver
            ? buildOAuthUnauthorizedHeaders(c.req.url)
            : HTTP_UNAUTHORIZED_HEADERS,
        },
      );
    }

    c.set(CALLER_IDENTITY_CONTEXT_KEY, identity);
    await next();
  });

  // MCP endpoint - create a fresh transport and server per request (stateless)
  app.all('/mcp', async (c) => {
    const identity = (c.get(CALLER_IDENTITY_CONTEXT_KEY) as CallerIdentity | undefined) ?? HTTP_ANONYMOUS_IDENTITY;
    return runWithRequestContext(
      createRequestContext(identity),
      async () => {
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
      },
    );
  });

  let resolveServerStarted!: () => void;
  const promise = new Promise<void>((resolve) => {
    resolveServerStarted = resolve;
  });

  const httpServer = serve({
    fetch: app.fetch,
    port,
    hostname,
  }, () => {
    console.log(`Server listening on http://${hostname}:${port}/mcp`);
    resolveServerStarted();
  });

  const shutdown = () => {
    console.log('\nShutting down...');
    httpServer.close(() => process.exit(0));
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  return promise;
}

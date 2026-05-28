import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getRequestContext } from '../../src/auth/identity-context.js';
import { OAUTH_PROTECTED_RESOURCE_METADATA_PATH } from '../../src/auth/oauth-resource-server.js';
import { startServer, startStdioServer, startStreamableHttpServer } from '../../src/server-utils.js';
import { createJwtFixtureToken, JWT_FIXTURE_AUDIENCE, JWT_FIXTURE_SUBJECT, jwtFixtureJwks } from '../helpers/jwt-fixtures.js';
import {
  buildOAuthAuthorizationServerMetadata,
  buildOAuthIntrospectionResponse,
  createOAuthAccessToken,
  OAUTH_FIXTURE_AUDIENCE,
  OAUTH_FIXTURE_DISCOVERY_PATH,
  OAUTH_FIXTURE_INTROSPECTION_ENDPOINT,
  OAUTH_FIXTURE_ISSUER,
  OAUTH_FIXTURE_JWKS_URI,
  OAUTH_FIXTURE_SUBJECT,
} from '../helpers/oauth-fixtures.js';

const mockState = vi.hoisted(() => {
  const stdioCtorMock = vi.fn();
  const stdioInstances: unknown[] = [];
  class MockStdioServerTransport {
    constructor() {
      stdioCtorMock();
      stdioInstances.push(this);
    }
  }

  const webStandardCtorMock = vi.fn();
  const webStandardInstances: Array<{
    handleRequest: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
  }> = [];
  class MockWebStandardStreamableHTTPServerTransport {
    handleRequest = vi.fn().mockResolvedValue(new Response('ok'));
    close = vi.fn().mockResolvedValue(undefined);

    constructor(options: unknown) {
      webStandardCtorMock(options);
      webStandardInstances.push(this);
    }
  }

  // Capture the route handler registered via app.all('/mcp', ...)
  let mcpHandler: ((c: any) => Promise<Response>) | undefined;
  let metadataHandler: ((c: any) => Response | Promise<Response>) | undefined;
  const middlewareHandlers: Array<(c: any, next: () => Promise<void>) => Promise<unknown>> = [];
  const honoUseMock = vi.fn((_path: string, handler: (c: any, next: () => Promise<void>) => Promise<unknown>) => {
    middlewareHandlers.push(handler);
  });
  const honoGetMock = vi.fn((path: string, handler: (c: any) => Response | Promise<Response>) => {
    if (path === OAUTH_PROTECTED_RESOURCE_METADATA_PATH) {
      metadataHandler = handler;
    }
  });
  const honoAllMock = vi.fn((path: string, handler: (c: any) => Promise<Response>) => {
    if (path === '/mcp') {
      mcpHandler = handler;
    }
  });
  const honoFetchMock = vi.fn();

  const mockHonoInstance = {
    use: honoUseMock,
    get: honoGetMock,
    all: honoAllMock,
    fetch: honoFetchMock,
  };

  class MockHono {
    use = honoUseMock;
    get = honoGetMock;
    all = honoAllMock;
    fetch = honoFetchMock;
    constructor() {
      Object.assign(this, mockHonoInstance);
    }
  }

  const corsMock = vi.fn(() => vi.fn(async (_c: unknown, next: () => Promise<void>) => {
    await next();
  }));

  let _serveCallback: (() => void) | undefined;
  const mockHttpServer = {
    close: vi.fn((cb?: () => void) => cb?.()),
  };
  const serveMock = vi.fn((options: any, callback?: () => void) => {
    _serveCallback = callback;
    // Call callback immediately to simulate server start
    callback?.();
    return mockHttpServer;
  });

  return {
    stdioCtorMock,
    stdioInstances,
    MockStdioServerTransport,
    webStandardCtorMock,
    webStandardInstances,
    MockWebStandardStreamableHTTPServerTransport,
    MockHono,
    honoUseMock,
    honoGetMock,
    honoAllMock,
    honoFetchMock,
    corsMock,
    serveMock,
    mockHttpServer,
    getMcpHandler: () => mcpHandler,
    getMetadataHandler: () => metadataHandler,
    getMiddlewareHandlers: () => [...middlewareHandlers],
    resetMcpHandler: () => { mcpHandler = undefined; },
    resetMetadataHandler: () => { metadataHandler = undefined; },
    resetMiddlewareHandlers: () => { middlewareHandlers.length = 0; },
  };
});

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => {
  return {
    StdioServerTransport: mockState.MockStdioServerTransport,
  };
});

vi.mock('@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js', () => {
  return {
    WebStandardStreamableHTTPServerTransport: mockState.MockWebStandardStreamableHTTPServerTransport,
  };
});

vi.mock('hono', () => {
  return {
    Hono: mockState.MockHono,
  };
});

vi.mock('hono/cors', () => {
  return {
    cors: mockState.corsMock,
  };
});

vi.mock('@hono/node-server', () => {
  return {
    serve: mockState.serveMock,
  };
});

interface ServerLike {
  connect: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
}

interface MockContext {
  req: {
    raw: Request;
    header: (name: string) => string | undefined;
    url: string;
  };
  get: (key: string) => unknown;
  set: (key: string, value: unknown) => void;
  json: (body: any, status?: number) => Response;
}

function createServerLike(overrides?: Partial<ServerLike>): ServerLike {
  return {
    connect: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function createMockContext(
  headers: Record<string, string> = {},
  requestUrl: string = 'http://localhost:3001/mcp',
): MockContext {
  const normalizedHeaders = new Headers(headers);
  const values = new Map<string, unknown>();
  return {
    req: {
      raw: new Request(requestUrl, { method: 'POST', headers: normalizedHeaders }),
      header: (name: string) => normalizedHeaders.get(name) ?? undefined,
      url: requestUrl,
    },
    get: (key: string) => values.get(key),
    set: (key: string, value: unknown) => {
      values.set(key, value);
    },
    json: (body: any, status?: number) => new Response(JSON.stringify(body), { status: status ?? 200 }),
  };
}

async function runMcpRequest(context: MockContext): Promise<Response> {
  const middlewares = mockState.getMiddlewareHandlers();
  const handler = mockState.getMcpHandler();
  if (!handler) {
    throw new TypeError('Expected /mcp route handler');
  }
  const routeHandler = handler;

  async function dispatch(index: number): Promise<Response> {
    if (index >= middlewares.length) {
      return routeHandler(context);
    }

    const middleware = middlewares[index];
    let nextCalled = false;
    const response = await middleware(context, async () => {
      nextCalled = true;
      return undefined;
    });

    if (response instanceof Response) {
      return response;
    }

    if (!nextCalled) {
      return dispatch(index + 1);
    }

    return dispatch(index + 1);
  }

  return dispatch(0);
}

async function runMetadataRequest(context: MockContext): Promise<Response> {
  const handler = mockState.getMetadataHandler();
  if (!handler) {
    throw new TypeError('Expected OAuth metadata route handler');
  }
  return await handler(context);
}

function createJsonResponse(body: unknown, status: number = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function toUrlString(input: RequestInfo | URL): string {
  return input instanceof Request ? input.url : input.toString();
}

function installOAuthJwksFetchMock() {
  globalThis.fetch = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
    const url = toUrlString(input);
    if (url === `${OAUTH_FIXTURE_ISSUER}${OAUTH_FIXTURE_DISCOVERY_PATH}`)
      return createJsonResponse(buildOAuthAuthorizationServerMetadata());
    if (url === OAUTH_FIXTURE_JWKS_URI)
      return createJsonResponse(jwtFixtureJwks);
    throw new Error(`Unexpected fetch ${url}`);
  });
}

function restoreEnvVar(key: 'PORT' | 'HOST' | 'ALLOWED_HOSTS', value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
  }
  else {
    process.env[key] = value;
  }
}

describe('server-utils', () => {
  const originalPort = process.env.PORT;
  const originalHost = process.env.HOST;
  const originalAllowedHosts = process.env.ALLOWED_HOSTS;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    mockState.stdioInstances.length = 0;
    mockState.webStandardInstances.length = 0;
    mockState.resetMcpHandler();
    mockState.resetMetadataHandler();
    mockState.resetMiddlewareHandlers();

    restoreEnvVar('PORT', originalPort);
    restoreEnvVar('HOST', originalHost);
    restoreEnvVar('ALLOWED_HOSTS', originalAllowedHosts);
    globalThis.fetch = vi.fn().mockImplementation(async () =>
      new Response(JSON.stringify(jwtFixtureJwks), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }));
  });

  afterEach(() => {
    restoreEnvVar('PORT', originalPort);
    restoreEnvVar('HOST', originalHost);
    restoreEnvVar('ALLOWED_HOSTS', originalAllowedHosts);
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('startStdioServer connects server with stdio transport', async () => {
    let seenRequestContext = getRequestContext();
    const server = createServerLike();
    server.connect.mockImplementation(async () => {
      seenRequestContext = getRequestContext();
    });
    const createServer = vi.fn(() => server as never);

    await startStdioServer(createServer);

    expect(createServer).toHaveBeenCalledTimes(1);
    expect(mockState.stdioCtorMock).toHaveBeenCalledTimes(1);
    expect(server.connect).toHaveBeenCalledWith(mockState.stdioInstances[0]);
    expect(seenRequestContext).toMatchObject({
      identity: { transport: 'stdio', authSource: 'stdio-process' },
      requestId: expect.any(String),
    });
  });

  it('startStdioServer uses callerId from auth options', async () => {
    let seenRequestContext = getRequestContext();
    const server = createServerLike();
    server.connect.mockImplementation(async () => {
      seenRequestContext = getRequestContext();
    });
    const createServer = vi.fn(() => server as never);

    await startStdioServer(createServer, { auth: { callerId: 'ops-session-1' } });

    expect(seenRequestContext).toMatchObject({
      identity: { transport: 'stdio', authSource: 'stdio-env', callerId: 'ops-session-1' },
      requestId: expect.any(String),
    });
  });

  it('startServer routes to stdio by default', async () => {
    const server = createServerLike();
    const createServer = vi.fn(() => server as never);

    await startServer(createServer);

    expect(createServer).toHaveBeenCalledTimes(1);
    expect(server.connect).toHaveBeenCalledTimes(1);
    expect(mockState.serveMock).not.toHaveBeenCalled();
  });

  it('startServer routes to streamable http when isHttp=true', async () => {
    const server = createServerLike();
    const createServer = vi.fn(() => server as never);
    const processOnSpy = vi.spyOn(process, 'on').mockReturnValue(process);

    await startServer(createServer, true, { allowedHosts: ['localhost'] });

    expect(mockState.serveMock).toHaveBeenCalledTimes(1);
    expect(processOnSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    expect(processOnSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
    expect(createServer).not.toHaveBeenCalled();
  });

  it('startServer logs and exits when startup throws', async () => {
    const thrown = new Error('boom');
    const createServer = vi.fn(() => {
      throw thrown;
    });
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exitError = new Error('exit');
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`${exitError.message}:${code}`);
    }) as never);

    await expect(startServer(createServer, false)).rejects.toThrow('exit:1');
    expect(consoleErrorSpy).toHaveBeenCalledWith(thrown);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('startStreamableHttpServer configures app and handles request lifecycle', async () => {
    process.env.PORT = '4567';

    let seenRequestContext = getRequestContext();
    const server = createServerLike();
    server.connect.mockImplementation(async () => {
      seenRequestContext = getRequestContext();
    });
    const createServer = vi.fn(() => server as never);
    const signalHandlers = new Map<string, () => void>();
    const processOnSpy = vi.spyOn(process, 'on').mockImplementation(((event: string, cb: () => void) => {
      signalHandlers.set(event, cb);
      return process;
    }) as never);
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);

    await startStreamableHttpServer(createServer);

    // Verify cors middleware was registered
    expect(mockState.corsMock).toHaveBeenCalledTimes(1);
    expect(mockState.honoUseMock).toHaveBeenCalled();

    // Verify serve was called with correct port
    expect(mockState.serveMock).toHaveBeenCalledWith(
      expect.objectContaining({ port: 4567 }),
      expect.any(Function),
    );
    expect(processOnSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    expect(processOnSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));

    // Invoke the /mcp route handler
    // Create a mock Hono context with AbortController for lifecycle testing
    const abortController = new AbortController();
    const mockContext = createMockContext();
    mockContext.req.raw = new Request('http://localhost:4567/mcp', { method: 'POST', signal: abortController.signal });

    await runMcpRequest(mockContext);

    expect(createServer).toHaveBeenCalledTimes(1);
    expect(seenRequestContext).toMatchObject({
      identity: { transport: 'http', authSource: 'none' },
      requestId: expect.any(String),
    });
    expect(mockState.webStandardCtorMock).toHaveBeenCalledWith({
      sessionIdGenerator: undefined,
    });
    const transport = mockState.webStandardInstances[0];
    expect(server.connect).toHaveBeenCalledWith(transport as never);
    expect(transport.handleRequest).toHaveBeenCalledWith(mockContext.req.raw);

    // Cleanup should NOT have been called yet (deferred to client disconnect)
    expect(transport.close).not.toHaveBeenCalled();
    expect(server.close).not.toHaveBeenCalled();

    // Simulate client disconnect
    abortController.abort();
    await Promise.resolve();
    expect(transport.close).toHaveBeenCalledTimes(1);
    expect(server.close).toHaveBeenCalledTimes(1);

    // Test shutdown signal
    signalHandlers.get('SIGINT')?.();
    expect(mockState.mockHttpServer.close).toHaveBeenCalledTimes(1);
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('startStreamableHttpServer starts when Promise.withResolvers is unavailable', async () => {
    process.env.PORT = '4567';

    const originalWithResolversDescriptor = Object.getOwnPropertyDescriptor(Promise, 'withResolvers');
    Object.defineProperty(Promise, 'withResolvers', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    try {
      const server = createServerLike();
      const createServer = vi.fn(() => server as never);
      const processOnSpy = vi.spyOn(process, 'on').mockReturnValue(process);

      await startStreamableHttpServer(createServer);

      expect(mockState.serveMock).toHaveBeenCalledWith(
        expect.objectContaining({ port: 4567 }),
        expect.any(Function),
      );
      expect(processOnSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
      expect(processOnSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
    }
    finally {
      if (originalWithResolversDescriptor) {
        Object.defineProperty(Promise, 'withResolvers', originalWithResolversDescriptor);
      }
      else {
        Reflect.deleteProperty(Promise, 'withResolvers');
      }
    }
  });

  it('startStreamableHttpServer returns 500 JSON when request handling throws', async () => {
    const error = new Error('connect failed');
    const server = createServerLike({
      connect: vi.fn().mockRejectedValue(error),
    });
    const createServer = vi.fn(() => server as never);
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'on').mockReturnValue(process);

    await startStreamableHttpServer(createServer);
    const mockContext = createMockContext();
    mockContext.json = vi.fn((body: any, status?: number) => new Response(JSON.stringify(body), { status: status ?? 200 }));

    const _response = await runMcpRequest(mockContext);

    expect(consoleErrorSpy).toHaveBeenCalledWith('MCP error:', error);
    expect(mockContext.json).toHaveBeenCalledWith(
      {
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null,
      },
      500,
    );
  });

  it('uses the resolved allowedHosts option for host-header protection', async () => {
    process.env.ALLOWED_HOSTS = 'ignored.example.com';
    const server = createServerLike();
    const createServer = vi.fn(() => server as never);
    vi.spyOn(process, 'on').mockReturnValue(process);

    await startStreamableHttpServer(createServer, { allowedHosts: ['localhost'] });

    const middlewares = mockState.getMiddlewareHandlers();
    expect(middlewares).toHaveLength(3);

    const hostGuard = middlewares[1];
    const next = vi.fn().mockResolvedValue(undefined);
    const allowedContext = {
      req: {
        header: vi.fn((name: string) => name === 'host' ? 'localhost:3001' : undefined),
      },
      json: vi.fn(),
    };
    const deniedContext = {
      req: {
        header: vi.fn((name: string) => name === 'host' ? 'evil.example.com:3001' : undefined),
      },
      json: vi.fn((body: any, status?: number) => new Response(JSON.stringify(body), { status: status ?? 200 })),
    };

    await hostGuard(allowedContext, next);
    expect(next).toHaveBeenCalledTimes(1);

    const response = await hostGuard(deniedContext, next);
    expect(deniedContext.json).toHaveBeenCalledWith({ error: 'Forbidden: invalid Host header' }, 403);
    expect(response).toBeInstanceOf(Response);
  });

  it('returns 401 with bearer challenge when authorization is missing', async () => {
    const server = createServerLike();
    const createServer = vi.fn(() => server as never);
    vi.spyOn(process, 'on').mockReturnValue(process);

    await startStreamableHttpServer(createServer, { auth: { httpApiKey: 'test-http-key' } });

    const response = await runMcpRequest(createMockContext());

    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toBe('Bearer realm="brave-search-mcp"');
    expect(createServer).not.toHaveBeenCalled();
    expect(mockState.webStandardCtorMock).not.toHaveBeenCalled();
    expect(server.connect).not.toHaveBeenCalled();
  });

  it('serves OAuth protected resource metadata when OAuth auth is configured', async () => {
    installOAuthJwksFetchMock();
    const server = createServerLike();
    const createServer = vi.fn(() => server as never);
    vi.spyOn(process, 'on').mockReturnValue(process);

    await startStreamableHttpServer(createServer, {
      auth: {
        oauth: {
          issuer: OAUTH_FIXTURE_ISSUER,
          audience: OAUTH_FIXTURE_AUDIENCE,
          verifyStrategy: 'jwks',
        },
      },
    });

    const response = await runMetadataRequest(
      createMockContext({}, `http://localhost:3001${OAUTH_PROTECTED_RESOURCE_METADATA_PATH}`),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      resource: 'http://localhost:3001/mcp',
      authorization_servers: [OAUTH_FIXTURE_ISSUER],
      bearer_methods_supported: ['header'],
    });
  });

  it('returns OAuth bearer challenges with resource metadata when authorization is missing', async () => {
    installOAuthJwksFetchMock();
    const server = createServerLike();
    const createServer = vi.fn(() => server as never);
    vi.spyOn(process, 'on').mockReturnValue(process);

    await startStreamableHttpServer(createServer, {
      auth: {
        oauth: {
          issuer: OAUTH_FIXTURE_ISSUER,
          audience: OAUTH_FIXTURE_AUDIENCE,
          verifyStrategy: 'jwks',
        },
      },
    });

    const response = await runMcpRequest(createMockContext());

    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toBe(
      `Bearer realm="brave-search-mcp", resource_metadata="http://localhost:3001${OAUTH_PROTECTED_RESOURCE_METADATA_PATH}"`,
    );
    expect(createServer).not.toHaveBeenCalled();
    expect(mockState.webStandardCtorMock).not.toHaveBeenCalled();
    expect(server.connect).not.toHaveBeenCalled();
  });

  it('fails startup before serving when JWT auth JWKS loading fails', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:4010'));
    const createServer = vi.fn(() => createServerLike() as never);
    vi.spyOn(process, 'on').mockReturnValue(process);

    await expect(startStreamableHttpServer(createServer, {
      auth: {
        jwt: {
          jwksUri: 'http://127.0.0.1:4010/.well-known/jwks.json',
          audience: JWT_FIXTURE_AUDIENCE,
        },
      },
    })).rejects.toThrow('JWT auth startup error: could not fetch JWKS from http://127.0.0.1:4010/.well-known/jwks.json: connect ECONNREFUSED 127.0.0.1:4010');

    expect(mockState.serveMock).not.toHaveBeenCalled();
    expect(createServer).not.toHaveBeenCalled();
  });

  it('returns 401 for malformed or incorrect authorization headers', async () => {
    const server = createServerLike();
    const createServer = vi.fn(() => server as never);
    vi.spyOn(process, 'on').mockReturnValue(process);

    await startStreamableHttpServer(createServer, { auth: { httpApiKey: 'test-http-key' } });

    const malformedResponse = await runMcpRequest(createMockContext({ Authorization: 'Basic nope' }));
    const wrongKeyResponse = await runMcpRequest(createMockContext({ Authorization: 'Bearer wrong-key' }));

    expect(malformedResponse.status).toBe(401);
    expect(malformedResponse.headers.get('www-authenticate')).toBe('Bearer realm="brave-search-mcp"');
    expect(wrongKeyResponse.status).toBe(401);
    expect(wrongKeyResponse.headers.get('www-authenticate')).toBe('Bearer realm="brave-search-mcp"');
    expect(createServer).not.toHaveBeenCalled();
    expect(mockState.webStandardCtorMock).not.toHaveBeenCalled();
    expect(server.connect).not.toHaveBeenCalled();
  });

  it('propagates hashed caller identity for authenticated HTTP requests', async () => {
    let seenRequestContext = getRequestContext();
    const server = createServerLike();
    server.connect.mockImplementation(async () => {
      seenRequestContext = getRequestContext();
    });
    const createServer = vi.fn(() => server as never);
    vi.spyOn(process, 'on').mockReturnValue(process);

    await startStreamableHttpServer(createServer, { auth: { httpApiKey: 'test-http-key' } });

    const response = await runMcpRequest(createMockContext({ Authorization: 'Bearer test-http-key' }));

    expect(response.status).toBe(200);
    expect(createServer).toHaveBeenCalledTimes(1);
    expect(seenRequestContext).toMatchObject({
      identity: {
        transport: 'http',
        authSource: 'http-api-key',
        callerId: 'ed9b6e4af4a465ee9ca2baab14bc5f6702227e46cb529978bebf9b81239c8e3c',
      },
      requestId: expect.any(String),
    });
    expect(server.connect).toHaveBeenCalledTimes(1);
    expect(mockState.webStandardInstances[0].handleRequest).toHaveBeenCalledTimes(1);
  });

  it('propagates JWT caller identity for authenticated HTTP requests', async () => {
    let seenRequestContext = getRequestContext();
    const server = createServerLike();
    server.connect.mockImplementation(async () => {
      seenRequestContext = getRequestContext();
    });
    const createServer = vi.fn(() => server as never);
    vi.spyOn(process, 'on').mockReturnValue(process);
    const token = await createJwtFixtureToken({ scope: 'search:read tools:list' });

    await startStreamableHttpServer(createServer, {
      auth: {
        jwt: {
          jwksUri: 'http://127.0.0.1:4010/.well-known/jwks.json',
          audience: JWT_FIXTURE_AUDIENCE,
        },
      },
    });

    const response = await runMcpRequest(createMockContext({ Authorization: `Bearer ${token}` }));

    expect(response.status).toBe(200);
    expect(createServer).toHaveBeenCalledTimes(1);
    expect(seenRequestContext).toMatchObject({
      identity: {
        transport: 'http',
        authSource: 'jwt',
        callerId: JWT_FIXTURE_SUBJECT,
        scopes: ['search:read', 'tools:list'],
      },
      requestId: expect.any(String),
    });
  });

  it('propagates OAuth caller identity for authenticated HTTP requests', async () => {
    installOAuthJwksFetchMock();
    let seenRequestContext = getRequestContext();
    const server = createServerLike();
    server.connect.mockImplementation(async () => {
      seenRequestContext = getRequestContext();
    });
    const createServer = vi.fn(() => server as never);
    vi.spyOn(process, 'on').mockReturnValue(process);
    const token = await createOAuthAccessToken();

    await startStreamableHttpServer(createServer, {
      auth: {
        oauth: {
          issuer: OAUTH_FIXTURE_ISSUER,
          audience: OAUTH_FIXTURE_AUDIENCE,
          verifyStrategy: 'jwks',
        },
      },
    });

    const response = await runMcpRequest(createMockContext({ Authorization: `Bearer ${token}` }));

    expect(response.status).toBe(200);
    expect(createServer).toHaveBeenCalledTimes(1);
    expect(seenRequestContext).toMatchObject({
      identity: {
        transport: 'http',
        authSource: 'oauth',
        callerId: OAUTH_FIXTURE_SUBJECT,
        scopes: ['search:read', 'tools:list'],
      },
      requestId: expect.any(String),
    });
  });

  it('returns 401 for OAuth JWKS tokens whose issuer does not match the configured issuer', async () => {
    installOAuthJwksFetchMock();
    const server = createServerLike();
    const createServer = vi.fn(() => server as never);
    vi.spyOn(process, 'on').mockReturnValue(process);
    const wrongIssuerToken = await createOAuthAccessToken({
      issuer: 'http://127.0.0.1:4999',
    });

    await startStreamableHttpServer(createServer, {
      auth: {
        oauth: {
          issuer: OAUTH_FIXTURE_ISSUER,
          audience: OAUTH_FIXTURE_AUDIENCE,
          verifyStrategy: 'jwks',
        },
      },
    });

    const response = await runMcpRequest(createMockContext({ Authorization: `Bearer ${wrongIssuerToken}` }));

    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toBe(
      `Bearer realm="brave-search-mcp", resource_metadata="http://localhost:3001${OAUTH_PROTECTED_RESOURCE_METADATA_PATH}"`,
    );
    expect(createServer).not.toHaveBeenCalled();
    expect(mockState.webStandardCtorMock).not.toHaveBeenCalled();
    expect(server.connect).not.toHaveBeenCalled();
  });

  it('returns 401 for invalid JWT bearer tokens before request handling starts', async () => {
    const server = createServerLike();
    const createServer = vi.fn(() => server as never);
    vi.spyOn(process, 'on').mockReturnValue(process);
    const wrongAudienceToken = await createJwtFixtureToken({ audience: 'not-brave-search-mcp' });

    await startStreamableHttpServer(createServer, {
      auth: {
        jwt: {
          jwksUri: 'http://127.0.0.1:4010/.well-known/jwks.json',
          audience: JWT_FIXTURE_AUDIENCE,
        },
      },
    });

    const response = await runMcpRequest(createMockContext({ Authorization: `Bearer ${wrongAudienceToken}` }));

    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toBe('Bearer realm="brave-search-mcp"');
    expect(createServer).not.toHaveBeenCalled();
    expect(mockState.webStandardCtorMock).not.toHaveBeenCalled();
    expect(server.connect).not.toHaveBeenCalled();
  });

  it('does not fall back to static API key auth when JWT auth is also configured', async () => {
    const server = createServerLike();
    const createServer = vi.fn(() => server as never);
    vi.spyOn(process, 'on').mockReturnValue(process);

    await startStreamableHttpServer(createServer, {
      auth: {
        httpApiKey: 'legacy-api-key',
        jwt: {
          jwksUri: 'http://127.0.0.1:4010/.well-known/jwks.json',
          audience: JWT_FIXTURE_AUDIENCE,
        },
      },
    });

    const response = await runMcpRequest(createMockContext({ Authorization: 'Bearer legacy-api-key' }));

    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toBe('Bearer realm="brave-search-mcp"');
    expect(createServer).not.toHaveBeenCalled();
    expect(mockState.webStandardCtorMock).not.toHaveBeenCalled();
    expect(server.connect).not.toHaveBeenCalled();
  });

  it('does not fall back to JWT auth when OAuth introspection is also configured', async () => {
    const validJwt = await createJwtFixtureToken({ scope: 'search:read tools:list' });
    globalThis.fetch = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = toUrlString(input);
      if (url === `${OAUTH_FIXTURE_ISSUER}${OAUTH_FIXTURE_DISCOVERY_PATH}`) {
        return createJsonResponse(buildOAuthAuthorizationServerMetadata({
          introspection_endpoint: OAUTH_FIXTURE_INTROSPECTION_ENDPOINT,
        }));
      }
      if (url === OAUTH_FIXTURE_INTROSPECTION_ENDPOINT)
        return createJsonResponse(buildOAuthIntrospectionResponse({ active: false }));
      throw new Error(`Unexpected fetch ${url}`);
    });

    const server = createServerLike();
    const createServer = vi.fn(() => server as never);
    vi.spyOn(process, 'on').mockReturnValue(process);

    await startStreamableHttpServer(createServer, {
      auth: {
        jwt: {
          jwksUri: 'http://127.0.0.1:4010/.well-known/jwks.json',
          audience: JWT_FIXTURE_AUDIENCE,
        },
        oauth: {
          issuer: OAUTH_FIXTURE_ISSUER,
          audience: OAUTH_FIXTURE_AUDIENCE,
          clientId: 'client-123',
          clientSecret: 'secret-abc',
          verifyStrategy: 'introspect',
        },
      },
    });

    const response = await runMcpRequest(createMockContext({ Authorization: `Bearer ${validJwt}` }));

    expect(response.status).toBe(401);
    expect(createServer).not.toHaveBeenCalled();
    expect(mockState.webStandardCtorMock).not.toHaveBeenCalled();
    expect(server.connect).not.toHaveBeenCalled();
  });

  it('does not fall back to static API key auth when OAuth auth is also configured', async () => {
    installOAuthJwksFetchMock();
    const server = createServerLike();
    const createServer = vi.fn(() => server as never);
    vi.spyOn(process, 'on').mockReturnValue(process);

    await startStreamableHttpServer(createServer, {
      auth: {
        httpApiKey: 'legacy-api-key',
        oauth: {
          issuer: OAUTH_FIXTURE_ISSUER,
          audience: OAUTH_FIXTURE_AUDIENCE,
          verifyStrategy: 'jwks',
        },
      },
    });

    const response = await runMcpRequest(createMockContext({ Authorization: 'Bearer legacy-api-key' }));

    expect(response.status).toBe(401);
    expect(createServer).not.toHaveBeenCalled();
    expect(mockState.webStandardCtorMock).not.toHaveBeenCalled();
    expect(server.connect).not.toHaveBeenCalled();
  });
});

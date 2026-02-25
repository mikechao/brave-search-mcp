import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startServer, startStdioServer, startStreamableHttpServer } from '../../src/server-utils.js';

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
  const honoUseMock = vi.fn();
  const honoAllMock = vi.fn((path: string, handler: (c: any) => Promise<Response>) => {
    if (path === '/mcp') {
      mcpHandler = handler;
    }
  });
  const honoFetchMock = vi.fn();

  const mockHonoInstance = {
    use: honoUseMock,
    all: honoAllMock,
    fetch: honoFetchMock,
  };

  class MockHono {
    use = honoUseMock;
    all = honoAllMock;
    fetch = honoFetchMock;
    constructor() {
      Object.assign(this, mockHonoInstance);
    }
  }

  const corsMock = vi.fn(() => vi.fn());

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
    honoAllMock,
    honoFetchMock,
    corsMock,
    serveMock,
    mockHttpServer,
    getMcpHandler: () => mcpHandler,
    resetMcpHandler: () => { mcpHandler = undefined; },
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

function createServerLike(overrides?: Partial<ServerLike>): ServerLike {
  return {
    connect: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
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

  beforeEach(() => {
    vi.clearAllMocks();
    mockState.stdioInstances.length = 0;
    mockState.webStandardInstances.length = 0;
    mockState.resetMcpHandler();

    restoreEnvVar('PORT', originalPort);
    restoreEnvVar('HOST', originalHost);
    restoreEnvVar('ALLOWED_HOSTS', originalAllowedHosts);
  });

  afterEach(() => {
    restoreEnvVar('PORT', originalPort);
    restoreEnvVar('HOST', originalHost);
    restoreEnvVar('ALLOWED_HOSTS', originalAllowedHosts);
    vi.restoreAllMocks();
  });

  it('startStdioServer connects server with stdio transport', async () => {
    const server = createServerLike();
    const createServer = vi.fn(() => server as never);

    await startStdioServer(createServer);

    expect(createServer).toHaveBeenCalledTimes(1);
    expect(mockState.stdioCtorMock).toHaveBeenCalledTimes(1);
    expect(server.connect).toHaveBeenCalledWith(mockState.stdioInstances[0]);
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

    await startServer(createServer, true);

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

    const server = createServerLike();
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
    const handler = mockState.getMcpHandler();
    expect(handler).toBeTypeOf('function');
    if (!handler) {
      throw new TypeError('Expected /mcp route handler');
    }

    // Create a mock Hono context with AbortController for lifecycle testing
    const abortController = new AbortController();
    const mockContext = {
      req: { raw: new Request('http://localhost:4567/mcp', { method: 'POST', signal: abortController.signal }) },
      json: vi.fn((body: any, status?: number) => new Response(JSON.stringify(body), { status: status ?? 200 })),
    };

    await handler(mockContext);

    expect(createServer).toHaveBeenCalledTimes(1);
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

  it('startStreamableHttpServer returns 500 JSON when request handling throws', async () => {
    const error = new Error('connect failed');
    const server = createServerLike({
      connect: vi.fn().mockRejectedValue(error),
    });
    const createServer = vi.fn(() => server as never);
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'on').mockReturnValue(process);

    await startStreamableHttpServer(createServer);
    const handler = mockState.getMcpHandler();
    if (!handler) {
      throw new TypeError('Expected /mcp route handler');
    }

    const mockContext = {
      req: { raw: new Request('http://localhost:3001/mcp', { method: 'POST' }) },
      json: vi.fn((body: any, status?: number) => new Response(JSON.stringify(body), { status: status ?? 200 })),
    };

    const _response = await handler(mockContext);

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
});

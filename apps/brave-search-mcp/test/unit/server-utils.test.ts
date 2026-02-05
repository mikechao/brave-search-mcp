import type { Request, Response } from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startServer, startStdioServer, startStreamableHttpServer } from '../../src/server-utils.js';

const mockState = vi.hoisted(() => {
  const createMcpExpressAppMock = vi.fn();
  const corsMiddleware = vi.fn();
  const corsMock = vi.fn(() => corsMiddleware);

  const stdioCtorMock = vi.fn();
  const stdioInstances: unknown[] = [];
  class MockStdioServerTransport {
    constructor() {
      stdioCtorMock();
      stdioInstances.push(this);
    }
  }

  const streamableCtorMock = vi.fn();
  const streamableInstances: Array<{
    handleRequest: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
  }> = [];
  class MockStreamableHTTPServerTransport {
    handleRequest = vi.fn().mockResolvedValue(undefined);
    close = vi.fn().mockResolvedValue(undefined);

    constructor(options: unknown) {
      streamableCtorMock(options);
      streamableInstances.push(this);
    }
  }

  return {
    createMcpExpressAppMock,
    corsMiddleware,
    corsMock,
    stdioCtorMock,
    stdioInstances,
    MockStdioServerTransport,
    streamableCtorMock,
    streamableInstances,
    MockStreamableHTTPServerTransport,
  };
});

vi.mock('@modelcontextprotocol/sdk/server/express.js', () => {
  return {
    createMcpExpressApp: mockState.createMcpExpressAppMock,
  };
});

vi.mock('cors', () => {
  return {
    default: mockState.corsMock,
  };
});

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => {
  return {
    StdioServerTransport: mockState.MockStdioServerTransport,
  };
});

vi.mock('@modelcontextprotocol/sdk/server/streamableHttp.js', () => {
  return {
    StreamableHTTPServerTransport: mockState.MockStreamableHTTPServerTransport,
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

function setupMockExpressApp() {
  let routeHandler: ((req: Request, res: Response) => Promise<void>) | undefined;
  const httpServer = {
    close: vi.fn((cb?: () => void) => cb?.()),
  };

  const app = {
    use: vi.fn(),
    all: vi.fn((route: string, handler: (req: Request, res: Response) => Promise<void>) => {
      if (route === '/mcp') {
        routeHandler = handler;
      }
    }),
    listen: vi.fn((_: number, cb: (err?: Error) => void) => {
      cb();
      return httpServer;
    }),
  };

  mockState.createMcpExpressAppMock.mockReturnValue(app);
  return {
    app,
    httpServer,
    getRouteHandler: () => routeHandler,
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
    mockState.streamableInstances.length = 0;

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
    expect(mockState.createMcpExpressAppMock).not.toHaveBeenCalled();
  });

  it('startServer routes to streamable http when isHttp=true', async () => {
    const server = createServerLike();
    const createServer = vi.fn(() => server as never);
    const { app } = setupMockExpressApp();
    const processOnSpy = vi.spyOn(process, 'on').mockReturnValue(process);

    await startServer(createServer, true);

    expect(mockState.createMcpExpressAppMock).toHaveBeenCalledTimes(1);
    expect(app.listen).toHaveBeenCalledTimes(1);
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
    process.env.HOST = '127.0.0.1';
    process.env.ALLOWED_HOSTS = 'example.com, local.test';

    const { app, getRouteHandler, httpServer } = setupMockExpressApp();
    const server = createServerLike();
    const createServer = vi.fn(() => server as never);
    const signalHandlers = new Map<string, () => void>();
    const processOnSpy = vi.spyOn(process, 'on').mockImplementation(((event: string, cb: () => void) => {
      signalHandlers.set(event, cb);
      return process;
    }) as never);
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);

    await startStreamableHttpServer(createServer);

    expect(mockState.createMcpExpressAppMock).toHaveBeenCalledWith({
      host: '127.0.0.1',
      allowedHosts: ['example.com', 'local.test'],
    });
    expect(mockState.corsMock).toHaveBeenCalledTimes(1);
    expect(app.use).toHaveBeenCalledWith(mockState.corsMiddleware);
    expect(app.listen).toHaveBeenCalledWith(4567, expect.any(Function));
    expect(processOnSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    expect(processOnSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));

    const handler = getRouteHandler();
    expect(handler).toBeTypeOf('function');
    if (!handler) {
      throw new TypeError('Expected /mcp route handler');
    }

    const closeHandlers: Array<() => void> = [];
    const req = { body: { ping: 'pong' } } as Request;
    const res = {
      headersSent: false,
      on: vi.fn((event: string, cb: () => void) => {
        if (event === 'close')
          closeHandlers.push(cb);
        return res;
      }),
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response;

    await handler(req, res);

    expect(createServer).toHaveBeenCalledTimes(1);
    expect(mockState.streamableCtorMock).toHaveBeenCalledWith({
      sessionIdGenerator: undefined,
    });
    const transport = mockState.streamableInstances[0];
    expect(server.connect).toHaveBeenCalledWith(transport as never);
    expect(transport.handleRequest).toHaveBeenCalledWith(req, res, req.body);
    expect(closeHandlers).toHaveLength(1);

    closeHandlers[0]();
    await Promise.resolve();
    expect(transport.close).toHaveBeenCalledTimes(1);
    expect(server.close).toHaveBeenCalledTimes(1);

    signalHandlers.get('SIGINT')?.();
    expect(httpServer.close).toHaveBeenCalledTimes(1);
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('startStreamableHttpServer returns 500 JSON when request handling throws and headers not sent', async () => {
    const { getRouteHandler } = setupMockExpressApp();
    const error = new Error('connect failed');
    const server = createServerLike({
      connect: vi.fn().mockRejectedValue(error),
    });
    const createServer = vi.fn(() => server as never);
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'on').mockReturnValue(process);

    await startStreamableHttpServer(createServer);
    const handler = getRouteHandler();
    if (!handler) {
      throw new TypeError('Expected /mcp route handler');
    }

    const req = { body: {} } as Request;
    const res = {
      headersSent: false,
      on: vi.fn().mockReturnThis(),
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response;

    await handler(req, res);

    expect(consoleErrorSpy).toHaveBeenCalledWith('MCP error:', error);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      jsonrpc: '2.0',
      error: { code: -32603, message: 'Internal server error' },
      id: null,
    });
  });

  it('startStreamableHttpServer does not write 500 response when headers already sent', async () => {
    const { getRouteHandler } = setupMockExpressApp();
    const server = createServerLike({
      connect: vi.fn().mockRejectedValue(new Error('late failure')),
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'on').mockReturnValue(process);

    await startStreamableHttpServer(() => server as never);
    const handler = getRouteHandler();
    if (!handler) {
      throw new TypeError('Expected /mcp route handler');
    }

    const req = { body: {} } as Request;
    const res = {
      headersSent: true,
      on: vi.fn().mockReturnThis(),
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response;

    await handler(req, res);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });
});

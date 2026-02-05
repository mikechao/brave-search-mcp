import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => {
  return {
    startServerMock: vi.fn(),
    braveMcpServerMock: vi.fn(),
  };
});

vi.mock('../../src/server-utils.js', () => {
  return {
    startServer: mockState.startServerMock,
  };
});

vi.mock('../../src/server.js', () => {
  return {
    BraveMcpServer: mockState.braveMcpServerMock,
  };
});

async function importIndexModule() {
  await import('../../src/index.js');
  await new Promise(resolve => setTimeout(resolve, 0));
}

describe('index entrypoint', () => {
  const originalArgv = [...process.argv];
  const originalApiKey = process.env.BRAVE_API_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.argv = ['node', 'index.js'];
    process.env.BRAVE_API_KEY = 'test-api-key';

    mockState.startServerMock.mockResolvedValue(undefined);
    mockState.braveMcpServerMock.mockImplementation(function (this: { serverInstance: McpServer }, apiKey: string, isUI: boolean) {
      this.serverInstance = { apiKey, isUI } as unknown as McpServer;
    });
  });

  afterEach(() => {
    process.argv = [...originalArgv];
    process.env.BRAVE_API_KEY = originalApiKey;
    vi.restoreAllMocks();
  });

  it('passes createServer callback and http flag to startServer', async () => {
    let capturedCreateServer: (() => McpServer) | undefined;
    let capturedHttpFlag: boolean | undefined;
    mockState.startServerMock.mockImplementation((createServer: () => McpServer, isHttp: boolean) => {
      capturedCreateServer = createServer;
      capturedHttpFlag = isHttp;
      return Promise.resolve();
    });
    process.argv = ['node', 'index.js', '--http', '--ui'];

    await importIndexModule();

    expect(mockState.startServerMock).toHaveBeenCalledTimes(1);
    expect(capturedHttpFlag).toBe(true);
    expect(capturedCreateServer).toBeTypeOf('function');

    const serverInstance = capturedCreateServer!();
    expect(mockState.braveMcpServerMock).toHaveBeenCalledWith('test-api-key', true);
    expect(serverInstance).toEqual({
      apiKey: 'test-api-key',
      isUI: true,
    });
  });

  it('logs and exits when BRAVE_API_KEY is missing', async () => {
    let capturedCreateServer: (() => McpServer) | undefined;
    mockState.startServerMock.mockImplementation((createServer: () => McpServer) => {
      capturedCreateServer = createServer;
      return Promise.resolve();
    });
    delete process.env.BRAVE_API_KEY;

    await importIndexModule();

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exitError = new Error('exit');
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`${exitError.message}:${code}`);
    }) as never);

    expect(() => capturedCreateServer!()).toThrow('exit:1');
    expect(consoleErrorSpy).toHaveBeenCalledWith('Error: BRAVE_API_KEY environment variable is required');
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(mockState.braveMcpServerMock).not.toHaveBeenCalled();
  });

  it('logs and exits when startServer rejects', async () => {
    const startupError = new Error('startup failed');
    mockState.startServerMock.mockRejectedValue(startupError);
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);

    await importIndexModule();

    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to start MCP server:', startupError);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});

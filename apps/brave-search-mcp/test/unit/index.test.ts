import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => {
  return {
    resolveRuntimeConfigMock: vi.fn(),
    startServerMock: vi.fn(),
    braveMcpServerMock: vi.fn(),
  };
});

vi.mock('../../src/config-loader.js', () => {
  return {
    resolveRuntimeConfig: mockState.resolveRuntimeConfigMock,
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

function createFeatureConfig() {
  return {
    auth: {},
    audit: { enabled: false, logRaw: false },
    policy: { redact: false },
    guardrail: { windowSeconds: 0, cooldownSeconds: 0, requireJustification: false },
    server: {},
  };
}

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

    mockState.resolveRuntimeConfigMock.mockReturnValue({
      mode: 'env',
      featureConfig: createFeatureConfig(),
      ignoredEnvVars: [],
      unknownKeys: [],
      maskedForDisplay: createFeatureConfig(),
    });
    mockState.startServerMock.mockResolvedValue(undefined);
    mockState.braveMcpServerMock.mockImplementation(function (this: { serverInstance: McpServer }, apiKey: string, isUI: boolean, _braveSearch: unknown, featureConfig: unknown) {
      this.serverInstance = { apiKey, isUI, featureConfig } as unknown as McpServer;
    });
  });

  afterEach(() => {
    process.argv = [...originalArgv];
    process.env.BRAVE_API_KEY = originalApiKey;
    vi.restoreAllMocks();
  });

  it('passes createServer callback, http flag, and allowedHosts to startServer', async () => {
    let capturedCreateServer: (() => McpServer) | undefined;
    let capturedHttpFlag: boolean | undefined;
    let capturedOptions: { allowedHosts?: string[] } | undefined;
    const featureConfig = {
      ...createFeatureConfig(),
      server: { allowedHosts: ['localhost'] },
    };
    mockState.resolveRuntimeConfigMock.mockReturnValue({
      mode: 'env',
      featureConfig,
      ignoredEnvVars: [],
      unknownKeys: [],
      maskedForDisplay: featureConfig,
    });
    mockState.startServerMock.mockImplementation((createServer: () => McpServer, isHttp: boolean, options: { allowedHosts?: string[] }) => {
      capturedCreateServer = createServer;
      capturedHttpFlag = isHttp;
      capturedOptions = options;
      return Promise.resolve();
    });
    process.argv = ['node', 'index.js', '--http', '--ui'];

    await importIndexModule();

    expect(mockState.resolveRuntimeConfigMock).toHaveBeenCalledWith(expect.objectContaining({
      env: process.env,
      explicitConfigPath: undefined,
      warn: expect.any(Function),
    }));
    expect(mockState.startServerMock).toHaveBeenCalledTimes(1);
    expect(capturedHttpFlag).toBe(true);
    expect(capturedOptions).toEqual({ allowedHosts: ['localhost'] });
    expect(capturedCreateServer).toBeTypeOf('function');

    const serverInstance = capturedCreateServer!();
    expect(mockState.braveMcpServerMock).toHaveBeenCalledWith('test-api-key', true, undefined, featureConfig);
    expect(serverInstance).toEqual({
      apiKey: 'test-api-key',
      isUI: true,
      featureConfig,
    });
  });

  it('prints masked config and exits before startup in check-config mode', async () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    process.argv = ['node', 'index.js', '--check-config', '/tmp/config.toml'];

    await importIndexModule();

    expect(mockState.resolveRuntimeConfigMock).toHaveBeenCalledWith(expect.objectContaining({
      explicitConfigPath: '/tmp/config.toml',
    }));
    expect(consoleLogSpy).toHaveBeenCalledWith(JSON.stringify(createFeatureConfig(), null, 2));
    expect(mockState.startServerMock).not.toHaveBeenCalled();
    expect(mockState.braveMcpServerMock).not.toHaveBeenCalled();
  });

  it('logs and exits when BRAVE_API_KEY is missing', async () => {
    delete process.env.BRAVE_API_KEY;
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);

    await importIndexModule();

    expect(consoleErrorSpy).toHaveBeenCalledWith('Error: BRAVE_API_KEY environment variable is required');
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(mockState.startServerMock).not.toHaveBeenCalled();
    expect(mockState.braveMcpServerMock).not.toHaveBeenCalled();
  });

  it('logs and exits when config resolution throws', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    mockState.resolveRuntimeConfigMock.mockImplementation(() => {
      throw new Error('Config error: guardrail.requestLimit must be a positive integer, got "abc"');
    });

    await importIndexModule();

    expect(consoleErrorSpy).toHaveBeenCalledWith('Config error: guardrail.requestLimit must be a positive integer, got "abc"');
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(mockState.startServerMock).not.toHaveBeenCalled();
  });

  it('logs and exits when startServer rejects', async () => {
    const startupError = new Error('startup failed');
    mockState.startServerMock.mockRejectedValue(startupError);
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);

    await importIndexModule();

    expect(consoleErrorSpy).toHaveBeenCalledWith('startup failed');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('logs and exits when BraveMcpServer throws', async () => {
    let capturedCreateServer: (() => McpServer) | undefined;
    mockState.startServerMock.mockImplementation((createServer: () => McpServer) => {
      capturedCreateServer = createServer;
      return Promise.resolve();
    });
    const startupError = new Error('Policy file error: could not read "/bad/path.json": ENOENT');
    // eslint-disable-next-line prefer-arrow-callback
    mockState.braveMcpServerMock.mockImplementation(function () {
      throw startupError;
    });

    await importIndexModule();

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);

    capturedCreateServer!();

    expect(consoleErrorSpy).toHaveBeenCalledWith(`Error: Failed to start server: ${startupError.message}`);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('rejects --check-config without a file path', async () => {
    process.argv = ['node', 'index.js', '--check-config'];
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);

    await importIndexModule();

    expect(consoleErrorSpy).toHaveBeenCalledWith('Error: --check-config requires a file path');
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(mockState.resolveRuntimeConfigMock).not.toHaveBeenCalled();
  });
});

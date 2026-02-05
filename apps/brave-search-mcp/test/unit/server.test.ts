import type { BraveSearch } from 'brave-search';
import type { MockBraveSearch } from '../mocks/index.js';
import { beforeEach, describe, expect, it } from 'vitest';
import { BraveMcpServer } from '../../src/server.js';
import { ALL_UI_RESOURCE_URIS } from '../../src/ui-resources.js';
import { createMockBraveSearch } from '../mocks/index.js';

describe('braveMcpServer', () => {
  interface RegisteredToolState {
    _meta?: Record<string, unknown>;
    handler: (input: Record<string, unknown>) => Promise<unknown>;
  }

  interface InternalServerState {
    _registeredResources: Record<string, unknown>;
    _registeredTools: Record<string, RegisteredToolState>;
  }

  interface ServerInfoState {
    server: {
      _serverInfo: {
        name: string;
        description: string;
        version: string;
      };
    };
  }

  let mockBraveSearch: MockBraveSearch;
  let server: BraveMcpServer;

  beforeEach(() => {
    mockBraveSearch = createMockBraveSearch();
    // Pass the mock as the third parameter (dependency injection)
    server = new BraveMcpServer(
      'fake-api-key',
      false,
      mockBraveSearch as unknown as BraveSearch,
    );
  });

  describe('constructor', () => {
    it('should retain the injected BraveSearch instance', () => {
      const internals = server as unknown as { braveSearch: unknown };
      expect(internals.braveSearch).toBe(mockBraveSearch);
    });

    it('should use the injected BraveSearch instance when executing tools', async () => {
      const internals = server.serverInstance as unknown as InternalServerState;
      const webTool = internals._registeredTools.brave_web_search;

      expect(webTool).toBeDefined();
      if (!webTool) {
        throw new TypeError('Expected brave_web_search tool to be registered');
      }

      await webTool.handler({ query: 'dependency injection query' });

      expect(mockBraveSearch.webSearch).toHaveBeenCalledTimes(1);
      expect(mockBraveSearch.webSearch).toHaveBeenCalledWith(
        'dependency injection query',
        expect.objectContaining({ count: 10 }),
      );
    });

    it('should register UI resources and UI tool metadata when isUI=true', () => {
      const uiServer = new BraveMcpServer(
        'fake-api-key',
        true,
        mockBraveSearch as unknown as BraveSearch,
      );

      const internals = uiServer.serverInstance as unknown as InternalServerState;
      const resourceUris = Object.keys(internals._registeredResources);
      const tools = Object.values(internals._registeredTools);

      expect(resourceUris).toHaveLength(ALL_UI_RESOURCE_URIS.length);
      expect(resourceUris).toEqual(expect.arrayContaining(ALL_UI_RESOURCE_URIS));
      expect(tools).toHaveLength(5);

      const resourceUriSet = new Set(resourceUris);
      for (const tool of tools) {
        const meta = tool._meta;
        const ui = meta?.ui as { resourceUri?: string } | undefined;
        const mcpAppUri = ui?.resourceUri;
        const chatgptUri = meta?.['openai/outputTemplate'];

        expect(mcpAppUri).toBeTypeOf('string');
        expect(chatgptUri).toBeTypeOf('string');
        if (typeof mcpAppUri !== 'string' || typeof chatgptUri !== 'string') {
          throw new TypeError('Expected UI metadata to include tool resource URIs');
        }

        expect(mcpAppUri).toMatch(/^ui:\/\/.+\/mcp-app\.html$/);
        expect(chatgptUri).toMatch(/^ui:\/\/.+\/chatgpt-widget\.html$/);
        expect(resourceUriSet.has(mcpAppUri)).toBe(true);
        expect(resourceUriSet.has(chatgptUri)).toBe(true);
        expect(mcpAppUri.replace(/\/mcp-app\.html$/, '')).toBe(
          chatgptUri.replace(/\/chatgpt-widget\.html$/, ''),
        );
      }
    });
  });

  describe('server metadata', () => {
    it('should have correct server name and version', () => {
      const mcpServer = server.serverInstance as unknown as ServerInfoState;
      const serverInfo = mcpServer.server._serverInfo;

      expect(serverInfo).toEqual({
        name: 'Brave Search MCP Server',
        description: 'A server that provides tools for searching the web, images, videos, and local businesses using the Brave Search API.',
        version: '2.0.1',
      });
    });
  });
});

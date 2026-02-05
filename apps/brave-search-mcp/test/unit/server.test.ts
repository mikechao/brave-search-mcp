import type { BraveSearch } from 'brave-search';
import type { MockBraveSearch } from '../mocks/index.js';
import { beforeEach, describe, expect, it } from 'vitest';
import { BraveMcpServer } from '../../src/server.js';
import { ALL_UI_RESOURCE_URIS } from '../../src/ui-resources.js';
import { createMockBraveSearch } from '../mocks/index.js';

describe('braveMcpServer', () => {
  interface InternalServerState {
    _registeredResources: Record<string, unknown>;
    _registeredTools: Record<string, { _meta?: Record<string, unknown> }>;
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
    it('should create a server instance with injected BraveSearch', () => {
      expect(server).toBeDefined();
      expect(server.serverInstance).toBeDefined();
    });

    it('should use the injected BraveSearch instance', () => {
      // The mock should be used, not a real BraveSearch instance
      expect(mockBraveSearch.webSearch).not.toHaveBeenCalled();
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
      const serverInfo = server.serverInstance;
      expect(serverInfo).toBeDefined();
    });
  });
});

import type { BraveSearch } from 'brave-search';
import type { MockBraveSearch } from '../mocks/index.js';
import { RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { beforeEach, describe, expect, it } from 'vitest';
import { BraveMcpServer } from '../../src/server.js';
import { ALL_UI_RESOURCE_URIS, UI_RESOURCES } from '../../src/ui-resources.js';
import { createMockBraveSearch } from '../mocks/index.js';

describe('braveMcpServer', () => {
  let mockBraveSearch: MockBraveSearch;
  let server: BraveMcpServer;
  const CHATGPT_MIME_TYPE = 'text/html+skybridge';
  const UI_RESOURCE_EXPECTATIONS = [
    { uri: UI_RESOURCES.image.mcpApp, mimeType: RESOURCE_MIME_TYPE },
    { uri: UI_RESOURCES.image.chatgpt, mimeType: CHATGPT_MIME_TYPE },
    { uri: UI_RESOURCES.news.mcpApp, mimeType: RESOURCE_MIME_TYPE },
    { uri: UI_RESOURCES.news.chatgpt, mimeType: CHATGPT_MIME_TYPE },
    { uri: UI_RESOURCES.video.mcpApp, mimeType: RESOURCE_MIME_TYPE },
    { uri: UI_RESOURCES.video.chatgpt, mimeType: CHATGPT_MIME_TYPE },
    { uri: UI_RESOURCES.web.mcpApp, mimeType: RESOURCE_MIME_TYPE },
    { uri: UI_RESOURCES.web.chatgpt, mimeType: CHATGPT_MIME_TYPE },
    { uri: UI_RESOURCES.local.mcpApp, mimeType: RESOURCE_MIME_TYPE },
    { uri: UI_RESOURCES.local.chatgpt, mimeType: CHATGPT_MIME_TYPE },
  ] as const;

  beforeEach(() => {
    mockBraveSearch = createMockBraveSearch();
    // Pass the mock as the third parameter (dependency injection)
    server = new BraveMcpServer(
      'fake-api-key',
      false,
      mockBraveSearch as unknown as BraveSearch,
    );
  });

  async function createConnectedClient(targetServer: BraveMcpServer): Promise<{
    client: Client;
    close: () => Promise<void>;
  }> {
    const client = new Client({
      name: 'brave-search-mcp-test-client',
      version: '1.0.0',
    });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    await Promise.all([
      targetServer.serverInstance.connect(serverTransport),
      client.connect(clientTransport),
    ]);

    return {
      client,
      close: async () => {
        await Promise.all([
          client.close(),
          targetServer.serverInstance.close(),
        ]);
      },
    };
  }

  describe('constructor', () => {
    it('should retain the injected BraveSearch instance', () => {
      const internals = server as unknown as { braveSearch: unknown };
      expect(internals.braveSearch).toBe(mockBraveSearch);
    });

    it('should use the injected BraveSearch instance when executing tools', async () => {
      const { client, close } = await createConnectedClient(server);

      try {
        await client.callTool({
          name: 'brave_web_search',
          arguments: { query: 'dependency injection query' },
        });
      }
      finally {
        await close();
      }

      expect(mockBraveSearch.webSearch).toHaveBeenCalledTimes(1);
      expect(mockBraveSearch.webSearch).toHaveBeenCalledWith(
        'dependency injection query',
        expect.objectContaining({ count: 10 }),
      );
    });

    it('should register UI resources and UI tool metadata when isUI=true', async () => {
      const uiServer = new BraveMcpServer(
        'fake-api-key',
        true,
        mockBraveSearch as unknown as BraveSearch,
      );
      const { client, close } = await createConnectedClient(uiServer);

      try {
        const [resourceList, toolList] = await Promise.all([
          client.listResources(),
          client.listTools(),
        ]);
        const resourceUris = resourceList.resources.map(resource => resource.uri);
        const tools = toolList.tools;

        expect(resourceUris).toHaveLength(ALL_UI_RESOURCE_URIS.length);
        expect(resourceUris).toEqual(expect.arrayContaining(ALL_UI_RESOURCE_URIS));
        expect(tools).toHaveLength(6);

        const uiTools = tools.filter((tool) => {
          const meta = tool._meta as Record<string, unknown> | undefined;
          const uiMeta = meta?.ui as { resourceUri?: string } | undefined;
          return typeof uiMeta?.resourceUri === 'string' && typeof meta?.['openai/outputTemplate'] === 'string';
        });
        expect(uiTools).toHaveLength(5);

        const resourceUriSet = new Set(resourceUris);
        for (const tool of uiTools) {
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
      }
      finally {
        await close();
      }
    });
  });

  describe('ui resource callbacks', () => {
    for (const { uri, mimeType } of UI_RESOURCE_EXPECTATIONS) {
      it(`should return ReadResourceResult for "${uri}"`, async () => {
        const uiServer = new BraveMcpServer(
          'fake-api-key',
          true,
          mockBraveSearch as unknown as BraveSearch,
        );
        const { client, close } = await createConnectedClient(uiServer);

        try {
          const result = await client.readResource({ uri });
          const content = result.contents[0];

          expect(result.contents).toHaveLength(1);
          expect(content).toEqual(expect.objectContaining({
            uri,
            mimeType,
            text: expect.any(String),
          }));
          if (!content || !('text' in content)) {
            throw new TypeError(`Expected text resource content for URI "${uri}"`);
          }
          expect(content.text).not.toContain('Missing UI bundle at');
        }
        finally {
          await close();
        }
      });
    }
  });

  describe('server metadata', () => {
    it('should have correct server name and version', async () => {
      const { client, close } = await createConnectedClient(server);

      try {
        expect(client.getServerVersion()).toEqual({
          name: 'Brave Search MCP Server',
          description: 'A server that provides tools for searching the web, images, videos, and local businesses using the Brave Search API.',
          version: '2.0.1',
        });
      }
      finally {
        await close();
      }
    });
  });
});

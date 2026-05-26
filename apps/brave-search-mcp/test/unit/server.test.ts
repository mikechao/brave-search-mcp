import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { BraveSearch } from 'brave-search';
import type { ToolInterceptor } from '../../src/tools/tool-helpers.js';
import type { MockBraveSearch } from '../mocks/index.js';
import process from 'node:process';
import { RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import packageJson from '../../package.json' with { type: 'json' };
import { BraveMcpServer } from '../../src/server.js';
import { TOOL_NAMES } from '../../src/tool-catalog.js';
import { createMockBraveSearch } from '../mocks/index.js';

const ALL_UI_RESOURCE_URIS = [
  'ui://brave-image-search/mcp-app.html',
  'ui://brave-image-search/chatgpt-widget.html',
  'ui://brave-news-search/mcp-app.html',
  'ui://brave-news-search/chatgpt-widget.html',
  'ui://brave-video-search/mcp-app.html',
  'ui://brave-video-search/chatgpt-widget.html',
  'ui://brave-web-search/mcp-app.html',
  'ui://brave-web-search/chatgpt-widget.html',
  'ui://brave-local-search/mcp-app.html',
  'ui://brave-local-search/chatgpt-widget.html',
];
const UI_RESOURCES = {
  image: { mcpApp: ALL_UI_RESOURCE_URIS[0], chatgpt: ALL_UI_RESOURCE_URIS[1] },
  news: { mcpApp: ALL_UI_RESOURCE_URIS[2], chatgpt: ALL_UI_RESOURCE_URIS[3] },
  video: { mcpApp: ALL_UI_RESOURCE_URIS[4], chatgpt: ALL_UI_RESOURCE_URIS[5] },
  web: { mcpApp: ALL_UI_RESOURCE_URIS[6], chatgpt: ALL_UI_RESOURCE_URIS[7] },
  local: { mcpApp: ALL_UI_RESOURCE_URIS[8], chatgpt: ALL_UI_RESOURCE_URIS[9] },
};

const { version: SERVER_VERSION } = packageJson;
const allToolNames = Object.values(TOOL_NAMES);
const UI_TOOL_METADATA_EXPECTATIONS = {
  [TOOL_NAMES.image]: {
    invoking: 'Searching for images…',
    invoked: 'Images found.',
    widgetAccessible: false,
  },
  [TOOL_NAMES.news]: {
    invoking: 'Searching for news…',
    invoked: 'News articles found.',
    widgetAccessible: true,
  },
  [TOOL_NAMES.video]: {
    invoking: 'Searching for videos…',
    invoked: 'Videos found.',
    widgetAccessible: true,
  },
  [TOOL_NAMES.web]: {
    invoking: 'Searching the web…',
    invoked: 'Search complete.',
    widgetAccessible: true,
  },
  [TOOL_NAMES.local]: {
    invoking: 'Searching local businesses…',
    invoked: 'Places found.',
    widgetAccessible: true,
  },
} as const;

describe('braveMcpServer', () => {
  let mockBraveSearch: MockBraveSearch;
  let server: BraveMcpServer;
  const originalAuditLog = process.env.BRAVE_MCP_AUDIT_LOG;
  const originalAuditLogRaw = process.env.BRAVE_MCP_AUDIT_LOG_RAW;
  const originalRequireJustification = process.env.BRAVE_MCP_REQUIRE_JUSTIFICATION;
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
    delete process.env.BRAVE_MCP_AUDIT_LOG;
    delete process.env.BRAVE_MCP_AUDIT_LOG_RAW;
    delete process.env.BRAVE_MCP_REQUIRE_JUSTIFICATION;
    mockBraveSearch = createMockBraveSearch();
    // Pass the mock as the third parameter (dependency injection)
    server = new BraveMcpServer(
      'fake-api-key',
      false,
      mockBraveSearch as unknown as BraveSearch,
    );
  });

  afterAll(() => {
    restoreEnv('BRAVE_MCP_AUDIT_LOG', originalAuditLog);
    restoreEnv('BRAVE_MCP_AUDIT_LOG_RAW', originalAuditLogRaw);
    restoreEnv('BRAVE_MCP_REQUIRE_JUSTIFICATION', originalRequireJustification);
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

  function restoreEnv(key: 'BRAVE_MCP_AUDIT_LOG' | 'BRAVE_MCP_AUDIT_LOG_RAW' | 'BRAVE_MCP_REQUIRE_JUSTIFICATION', value: string | undefined) {
    if (value === undefined)
      delete process.env[key];
    else
      process.env[key] = value;
  }

  describe('constructor', () => {
    it('should use the injected BraveSearch instance when executing tools', async () => {
      const { client, close } = await createConnectedClient(server);

      try {
        await client.callTool({
          name: TOOL_NAMES.web,
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

    it('should thread built interceptors through direct and fallback tool execution', async () => {
      const seenContexts: Array<{ toolName: string; isFallback: boolean }> = [];
      const interceptors: readonly ToolInterceptor[] = [
        {
          async before(context) {
            seenContexts.push({ toolName: context.toolName, isFallback: context.isFallback });
          },
        },
      ];
      const buildInterceptorsSpy = vi
        .spyOn(
          BraveMcpServer.prototype as unknown as { buildInterceptors: () => readonly ToolInterceptor[] },
          'buildInterceptors',
        )
        .mockReturnValue(interceptors);

      mockBraveSearch.webSearch
        .mockResolvedValueOnce({
          type: 'search',
          query: { original: 'pizza near me', more_results_available: false },
          locations: { results: [] },
        } as unknown as Awaited<ReturnType<BraveSearch['webSearch']>>)
        .mockResolvedValueOnce({
          type: 'search',
          query: { original: 'pizza near me', more_results_available: false },
          web: {
            results: [
              {
                title: 'Pizza Place',
                url: 'https://example.com/pizza',
                description: 'Pizza nearby',
                meta_url: {
                  netloc: 'example.com',
                  hostname: 'example.com',
                  favicon: 'https://example.com/favicon.ico',
                },
              },
            ],
          },
        } as unknown as Awaited<ReturnType<BraveSearch['webSearch']>>);

      const interceptedServer = new BraveMcpServer(
        'fake-api-key',
        false,
        mockBraveSearch as unknown as BraveSearch,
      );
      const { client, close } = await createConnectedClient(interceptedServer);

      try {
        await client.callTool({
          name: TOOL_NAMES.local,
          arguments: { query: 'pizza near me', count: 2, offset: 0 },
        });
      }
      finally {
        buildInterceptorsSpy.mockRestore();
        await close();
      }

      expect(seenContexts).toEqual([
        { toolName: TOOL_NAMES.local, isFallback: false },
        { toolName: TOOL_NAMES.web, isFallback: true },
      ]);
    });

    it('should register standard tools without UI metadata when isUI=false', async () => {
      const { client, close } = await createConnectedClient(server);

      try {
        const toolList = await client.listTools();
        const toolNames = toolList.tools.map(tool => tool.name);

        expect(toolNames).toEqual(expect.arrayContaining(allToolNames));
        expect(toolList.tools).toHaveLength(allToolNames.length);

        for (const tool of toolList.tools) {
          const meta = tool._meta as Record<string, unknown> | undefined;
          const uiMeta = meta?.ui as { resourceUri?: string } | undefined;

          expect(uiMeta?.resourceUri).toBeUndefined();
          expect(meta?.['openai/outputTemplate']).toBeUndefined();
        }
      }
      finally {
        await close();
      }
    });

    it('denies tool calls without justification when BRAVE_MCP_REQUIRE_JUSTIFICATION=true', async () => {
      process.env.BRAVE_MCP_REQUIRE_JUSTIFICATION = 'true';
      process.env.BRAVE_MCP_AUDIT_LOG = 'true';
      const enforcedServer = new BraveMcpServer(
        'fake-api-key',
        false,
        mockBraveSearch as unknown as BraveSearch,
      );
      const stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
      const { client, close } = await createConnectedClient(enforcedServer);

      try {
        const result = await client.callTool({
          name: TOOL_NAMES.web,
          arguments: { query: 'dependency injection query' },
        });

        expect(result.isError).toBe(true);
        const toolResult = result as CallToolResult;
        const text = toolResult.content[0] && 'text' in toolResult.content[0]
          ? toolResult.content[0].text
          : '';
        expect(text).toContain('[POLICY:DENIED]');
        expect(text).toContain('justification is required');
        expect(mockBraveSearch.webSearch).not.toHaveBeenCalled();

        const event = JSON.parse(String(stderrSpy.mock.calls[0][0]));
        expect(event.outcome).toBe('denied');
        expect(event.denyCode).toBe('JUSTIFICATION_REQUIRED');
      }
      finally {
        stderrSpy.mockRestore();
        await close();
      }
    });

    it('exposes justification in the MCP input schema', async () => {
      const { client, close } = await createConnectedClient(server);

      try {
        const toolList = await client.listTools();
        const webTool = toolList.tools.find(tool => tool.name === TOOL_NAMES.web);

        expect(webTool?.inputSchema).toBeDefined();
        expect(webTool?.inputSchema).toMatchObject({
          type: 'object',
          properties: {
            justification: {
              type: 'string',
            },
          },
        });
      }
      finally {
        await close();
      }
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
        expect(uiTools.map(tool => tool.name).sort()).toEqual(
          Object.keys(UI_TOOL_METADATA_EXPECTATIONS).sort(),
        );

        const resourceUriSet = new Set(resourceUris);
        for (const tool of uiTools) {
          const meta = tool._meta as Record<string, unknown> | undefined;
          const ui = meta?.ui as { resourceUri?: string } | undefined;
          const mcpAppUri = ui?.resourceUri;
          const chatgptUri = meta?.['openai/outputTemplate'];
          const expectedMeta = UI_TOOL_METADATA_EXPECTATIONS[
            tool.name as keyof typeof UI_TOOL_METADATA_EXPECTATIONS
          ];

          expect(mcpAppUri).toBeTypeOf('string');
          expect(chatgptUri).toBeTypeOf('string');
          expect(expectedMeta).toBeDefined();
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
          expect(meta?.['openai/toolInvocation/invoking']).toBe(expectedMeta.invoking);
          expect(meta?.['openai/toolInvocation/invoked']).toBe(expectedMeta.invoked);

          if (expectedMeta.widgetAccessible)
            expect(meta?.['openai/widgetAccessible']).toBe(true);
          else
            expect(meta?.['openai/widgetAccessible']).toBeUndefined();
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
          version: SERVER_VERSION,
        });
      }
      finally {
        await close();
      }
    });
  });

  describe('guardrail env wiring', () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('denies the second call end-to-end when BRAVE_MCP_REQUEST_LIMIT=1', async () => {
      vi.stubEnv('BRAVE_MCP_REQUEST_LIMIT', '1');
      const guardedServer = new BraveMcpServer('fake-api-key', false, mockBraveSearch as unknown as BraveSearch);
      const { client, close } = await createConnectedClient(guardedServer);
      try {
        const first = await client.callTool({ name: TOOL_NAMES.web, arguments: { query: 'test' } });
        expect(first.isError).toBeFalsy();

        const second = await client.callTool({ name: TOOL_NAMES.web, arguments: { query: 'test 2' } });
        expect(second.isError).toBe(true);
        const text = ((second.content as unknown[])[0] as { type: 'text'; text: string }).text;
        expect(text).toContain('[POLICY:DENIED]');
        expect(text).toContain('Request limit of 1 exceeded');
      }
      finally {
        await close();
      }
    });

    it('does not activate the guardrail when BRAVE_MCP_REQUEST_LIMIT is malformed (e.g. "1oops")', async () => {
      vi.stubEnv('BRAVE_MCP_REQUEST_LIMIT', '1oops');
      const server2 = new BraveMcpServer('fake-api-key', false, mockBraveSearch as unknown as BraveSearch);
      const { client, close } = await createConnectedClient(server2);
      try {
        const first = await client.callTool({ name: TOOL_NAMES.web, arguments: { query: 'test' } });
        const second = await client.callTool({ name: TOOL_NAMES.web, arguments: { query: 'test 2' } });
        expect(first.isError).toBeFalsy();
        expect(second.isError).toBeFalsy();
      }
      finally {
        await close();
      }
    });

    it('does not activate the guardrail when BRAVE_MCP_REQUEST_LIMIT is not set', async () => {
      const { client, close } = await createConnectedClient(server);
      try {
        const first = await client.callTool({ name: TOOL_NAMES.web, arguments: { query: 'test' } });
        const second = await client.callTool({ name: TOOL_NAMES.web, arguments: { query: 'test 2' } });
        expect(first.isError).toBeFalsy();
        expect(second.isError).toBeFalsy();
      }
      finally {
        await close();
      }
    });

    it('treats malformed BRAVE_MCP_WINDOW_SECONDS as 0 (process-lifetime cap)', async () => {
      vi.useFakeTimers();
      vi.stubEnv('BRAVE_MCP_REQUEST_LIMIT', '1');
      vi.stubEnv('BRAVE_MCP_WINDOW_SECONDS', '1oops');

      try {
        const guardedServer = new BraveMcpServer('fake-api-key', false, mockBraveSearch as unknown as BraveSearch);
        const interceptors = (guardedServer as unknown as {
          buildInterceptors: () => readonly ToolInterceptor[];
        }).buildInterceptors();
        const guardrail = interceptors[0];

        expect(guardrail).toBeDefined();
        expect(await guardrail?.before?.({
          toolName: TOOL_NAMES.web,
          input: Object.freeze({ query: 'test' }),
          isFallback: false,
          startedAtMs: Date.now(),
        })).toBeUndefined();

        vi.advanceTimersByTime(5000);

        const result = await guardrail?.before?.({
          toolName: TOOL_NAMES.web,
          input: Object.freeze({ query: 'test 2' }),
          isFallback: false,
          startedAtMs: Date.now(),
        });
        expect(result).toMatchObject({ allow: false, code: 'RATE_LIMITED' });
      }
      finally {
        vi.useRealTimers();
      }
    });

    it('treats malformed BRAVE_MCP_COOLDOWN_SECONDS as 0 (no extra cooldown)', async () => {
      vi.useFakeTimers();
      vi.stubEnv('BRAVE_MCP_REQUEST_LIMIT', '1');
      vi.stubEnv('BRAVE_MCP_WINDOW_SECONDS', '1');
      vi.stubEnv('BRAVE_MCP_COOLDOWN_SECONDS', '5oops');

      try {
        const guardedServer = new BraveMcpServer('fake-api-key', false, mockBraveSearch as unknown as BraveSearch);
        const interceptors = (guardedServer as unknown as {
          buildInterceptors: () => readonly ToolInterceptor[];
        }).buildInterceptors();
        const guardrail = interceptors[0];

        expect(guardrail).toBeDefined();
        expect(await guardrail?.before?.({
          toolName: TOOL_NAMES.web,
          input: Object.freeze({ query: 'test' }),
          isFallback: false,
          startedAtMs: Date.now(),
        })).toBeUndefined();

        expect(await guardrail?.before?.({
          toolName: TOOL_NAMES.web,
          input: Object.freeze({ query: 'test 2' }),
          isFallback: false,
          startedAtMs: Date.now(),
        })).toMatchObject({ allow: false, code: 'RATE_LIMITED' });

        vi.advanceTimersByTime(1001);

        expect(await guardrail?.before?.({
          toolName: TOOL_NAMES.web,
          input: Object.freeze({ query: 'test 3' }),
          isFallback: false,
          startedAtMs: Date.now(),
        })).toBeUndefined();
      }
      finally {
        vi.useRealTimers();
      }
    });
  });
});

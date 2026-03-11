import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ReadResourceResult } from '@modelcontextprotocol/sdk/types.js';
import type { BraveImageSearchTool } from './tools/BraveImageSearchTool.js';
import type { BraveLocalSearchTool } from './tools/BraveLocalSearchTool.js';
import type { BraveNewsSearchTool } from './tools/BraveNewsSearchTool.js';
import type { BraveVideoSearchTool } from './tools/BraveVideoSearchTool.js';
import type { BraveWebSearchTool } from './tools/BraveWebSearchTool.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';
import { UI_RESOURCES } from './ui-resources.js';

const CHATGPT_MIME_TYPE = 'text/html+skybridge';
const OPENAI_CDN_RESOURCE_DOMAIN = 'https://cdn.openai.com';
const OPENAI_WIDGET_DOMAIN = 'mc-brave-search-mcp';

type LogLevel
  = 'error'
    | 'debug'
    | 'info'
    | 'notice'
    | 'warning'
    | 'critical'
    | 'alert'
    | 'emergency';

interface ResourceCsp {
  connectDomains?: string[];
  resourceDomains?: string[];
  frameDomains?: string[];
  baseUriDomains?: string[];
}

interface OpenAIWidgetCsp {
  connect_domains?: string[];
  resource_domains?: string[];
  redirect_domains?: string[];
  frame_domains?: string[];
}

interface UiToolRegistrationTarget {
  name: string;
  description: string;
  inputSchema: {
    shape: unknown;
  };
  execute: (input: never) => Promise<unknown>;
}

interface UiToolDescriptor {
  resourceKey: keyof typeof UI_RESOURCES;
  chatgptRegistrationName: string;
  title: string;
  mcpResourceDescription: string;
  chatgptResourceDescription: string;
  mcpBundlePath: string;
  chatgptBundlePath: string;
  mcpCsp?: ResourceCsp;
  chatgptCsp?: OpenAIWidgetCsp;
  widgetAccessible?: boolean;
  invokingText: string;
  invokedText: string;
  tool: UiToolRegistrationTarget;
}

interface UiSearchTools {
  image: BraveImageSearchTool;
  web: BraveWebSearchTool;
  local: BraveLocalSearchTool;
  news: BraveNewsSearchTool;
  video: BraveVideoSearchTool;
}

interface RegisterUiSearchToolsOptions {
  server: McpServer;
  distDir: string;
  log: (message: string, level?: LogLevel) => void;
  annotations: {
    readOnlyHint: true;
    destructiveHint: false;
    openWorldHint: true;
  };
  tools: UiSearchTools;
}

function getUiToolDescriptors(tools: UiSearchTools): UiToolDescriptor[] {
  return [
    {
      resourceKey: 'image',
      chatgptRegistrationName: 'brave-image-search-chatgpt',
      title: 'Brave Image Search',
      mcpResourceDescription: 'Brave Image Search UI (MCP-APP)',
      chatgptResourceDescription: 'Brave Image Search Widget (ChatGPT)',
      mcpBundlePath: 'src/lib/image/mcp-app.html',
      chatgptBundlePath: 'src/lib/image/chatgpt-app.html',
      mcpCsp: {
        connectDomains: ['https://imgs.search.brave.com'],
        resourceDomains: ['https://imgs.search.brave.com', OPENAI_CDN_RESOURCE_DOMAIN],
      },
      chatgptCsp: {
        connect_domains: ['https://imgs.search.brave.com'],
        resource_domains: ['https://imgs.search.brave.com', OPENAI_CDN_RESOURCE_DOMAIN],
      },
      invokingText: 'Searching for images…',
      invokedText: 'Images found.',
      tool: tools.image,
    },
    {
      resourceKey: 'news',
      chatgptRegistrationName: 'brave-news-search-chatgpt',
      title: 'Brave News Search',
      mcpResourceDescription: 'Brave News Search UI (MCP-APP)',
      chatgptResourceDescription: 'Brave News Search Widget (ChatGPT)',
      mcpBundlePath: 'src/lib/news/mcp-app.html',
      chatgptBundlePath: 'src/lib/news/chatgpt-app.html',
      mcpCsp: {
        resourceDomains: ['https://imgs.search.brave.com', OPENAI_CDN_RESOURCE_DOMAIN],
      },
      chatgptCsp: {
        resource_domains: ['https://imgs.search.brave.com', OPENAI_CDN_RESOURCE_DOMAIN],
      },
      widgetAccessible: true,
      invokingText: 'Searching for news…',
      invokedText: 'News articles found.',
      tool: tools.news,
    },
    {
      resourceKey: 'video',
      chatgptRegistrationName: 'brave-video-search-chatgpt',
      title: 'Brave Video Search',
      mcpResourceDescription: 'Brave Video Search UI (MCP-APP)',
      chatgptResourceDescription: 'Brave Video Search Widget (ChatGPT)',
      mcpBundlePath: 'src/lib/video/mcp-app.html',
      chatgptBundlePath: 'src/lib/video/chatgpt-app.html',
      mcpCsp: {
        resourceDomains: ['https://imgs.search.brave.com', OPENAI_CDN_RESOURCE_DOMAIN],
        frameDomains: ['https://www.youtube.com', 'https://player.vimeo.com'],
      },
      chatgptCsp: {
        resource_domains: ['https://imgs.search.brave.com', 'https://i.ytimg.com', OPENAI_CDN_RESOURCE_DOMAIN],
        frame_domains: ['https://www.youtube.com', 'https://youtube.com', 'https://player.vimeo.com', 'https://vimeo.com'],
      },
      widgetAccessible: true,
      invokingText: 'Searching for videos…',
      invokedText: 'Videos found.',
      tool: tools.video,
    },
    {
      resourceKey: 'web',
      chatgptRegistrationName: 'brave-web-search-chatgpt',
      title: 'Brave Web Search',
      mcpResourceDescription: 'Brave Web Search UI (MCP-APP)',
      chatgptResourceDescription: 'Brave Web Search Widget (ChatGPT)',
      mcpBundlePath: 'src/lib/web/mcp-app.html',
      chatgptBundlePath: 'src/lib/web/chatgpt-app.html',
      mcpCsp: {
        resourceDomains: ['https://imgs.search.brave.com', OPENAI_CDN_RESOURCE_DOMAIN],
      },
      chatgptCsp: {
        resource_domains: ['https://imgs.search.brave.com', OPENAI_CDN_RESOURCE_DOMAIN],
      },
      widgetAccessible: true,
      invokingText: 'Searching the web…',
      invokedText: 'Search complete.',
      tool: tools.web,
    },
    {
      resourceKey: 'local',
      chatgptRegistrationName: 'brave-local-search-chatgpt',
      title: 'Brave Local Search',
      mcpResourceDescription: 'Brave Local Search UI (MCP-APP)',
      chatgptResourceDescription: 'Brave Local Search Widget (ChatGPT)',
      mcpBundlePath: 'src/lib/local/mcp-app.html',
      chatgptBundlePath: 'src/lib/local/chatgpt-app.html',
      mcpCsp: {
        resourceDomains: [
          'https://tile.openstreetmap.org',
          'https://a.tile.openstreetmap.org',
          'https://b.tile.openstreetmap.org',
          'https://c.tile.openstreetmap.org',
          OPENAI_CDN_RESOURCE_DOMAIN,
        ],
      },
      chatgptCsp: {
        resource_domains: [
          'https://tile.openstreetmap.org',
          'https://a.tile.openstreetmap.org',
          'https://b.tile.openstreetmap.org',
          'https://c.tile.openstreetmap.org',
          OPENAI_CDN_RESOURCE_DOMAIN,
        ],
      },
      widgetAccessible: true,
      invokingText: 'Searching local businesses…',
      invokedText: 'Places found.',
      tool: tools.local,
    },
  ];
}

async function loadUiBundle({
  distDir,
  resourceUri,
  mimeType,
  bundlePath,
  log,
  csp,
  openaiWidgetCsp,
  openaiWidgetDomain,
}: {
  distDir: string;
  resourceUri: string;
  mimeType: string;
  bundlePath: string;
  log: (message: string, level?: LogLevel) => void;
  csp?: ResourceCsp;
  openaiWidgetCsp?: OpenAIWidgetCsp;
  openaiWidgetDomain?: string;
}): Promise<ReadResourceResult> {
  const uiPath = path.join(distDir, 'ui', bundlePath);

  try {
    const html = await fs.readFile(uiPath, 'utf-8');
    const metaObj: Record<string, unknown> = {};

    if (csp)
      metaObj.ui = { csp };

    if (openaiWidgetCsp)
      metaObj['openai/widgetCSP'] = openaiWidgetCsp;

    if (openaiWidgetDomain)
      metaObj['openai/widgetDomain'] = openaiWidgetDomain;

    return {
      contents: [
        {
          uri: resourceUri,
          mimeType,
          text: html,
          ...(Object.keys(metaObj).length > 0 && { _meta: metaObj }),
        },
      ],
    };
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log(`UI bundle missing at ${uiPath}: ${message}`, 'warning');
    return {
      contents: [
        {
          uri: resourceUri,
          mimeType,
          text: `<!doctype html><html><body><pre>Missing UI bundle at ${uiPath}: ${message}</pre></body></html>`,
        },
      ],
    };
  }
}

export function registerUiSearchTools({
  server,
  distDir,
  log,
  annotations,
  tools,
}: RegisterUiSearchToolsOptions): void {
  for (const descriptor of getUiToolDescriptors(tools)) {
    const { mcpApp: mcpAppResourceUri, chatgpt: chatgptResourceUri } = UI_RESOURCES[descriptor.resourceKey];

    registerAppResource(
      server,
      mcpAppResourceUri,
      mcpAppResourceUri,
      { mimeType: RESOURCE_MIME_TYPE, description: descriptor.mcpResourceDescription },
      async (): Promise<ReadResourceResult> => {
        return loadUiBundle({
          distDir,
          resourceUri: mcpAppResourceUri,
          mimeType: RESOURCE_MIME_TYPE,
          bundlePath: descriptor.mcpBundlePath,
          csp: descriptor.mcpCsp,
          log,
        });
      },
    );

    server.registerResource(
      descriptor.chatgptRegistrationName,
      chatgptResourceUri,
      { mimeType: CHATGPT_MIME_TYPE, description: descriptor.chatgptResourceDescription },
      async (): Promise<ReadResourceResult> => {
        return loadUiBundle({
          distDir,
          resourceUri: chatgptResourceUri,
          mimeType: CHATGPT_MIME_TYPE,
          bundlePath: descriptor.chatgptBundlePath,
          openaiWidgetCsp: descriptor.chatgptCsp,
          openaiWidgetDomain: OPENAI_WIDGET_DOMAIN,
          log,
        });
      },
    );

    const toolMeta: Record<string, unknown> = {
      'ui': { resourceUri: mcpAppResourceUri },
      'openai/outputTemplate': chatgptResourceUri,
      'openai/toolInvocation/invoking': descriptor.invokingText,
      'openai/toolInvocation/invoked': descriptor.invokedText,
    };

    if (descriptor.widgetAccessible)
      toolMeta['openai/widgetAccessible'] = true;

    registerAppTool(
      server,
      descriptor.tool.name,
      {
        title: descriptor.title,
        description: descriptor.tool.description,
        inputSchema: descriptor.tool.inputSchema.shape as never,
        annotations,
        _meta: toolMeta,
      },
      descriptor.tool.execute.bind(descriptor.tool) as never,
    );
  }
}

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

interface UiSearchToolTarget {
  name: string;
  description: string;
  inputSchema: {
    shape: unknown;
  };
  execute: (input: never) => Promise<unknown>;
}

interface UiToolSpec {
  resourceKey: keyof typeof UI_RESOURCES;
  title: string;
  tool: UiSearchToolTarget;
  mcpApp: {
    description: string;
    bundlePath: string;
    csp?: ResourceCsp;
  };
  chatgptWidget: {
    registrationName: string;
    description: string;
    bundlePath: string;
    csp?: OpenAIWidgetCsp;
  };
  toolMeta: {
    invokingText: string;
    invokedText: string;
    widgetAccessible?: true;
  };
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

interface LoadUiBundleOptions {
  distDir: string;
  resourceUri: string;
  mimeType: string;
  bundlePath: string;
  log: (message: string, level?: LogLevel) => void;
  csp?: ResourceCsp;
  openaiWidgetCsp?: OpenAIWidgetCsp;
  openaiWidgetDomain?: string;
}

interface RegisterUiResourceOptions {
  server: McpServer;
  distDir: string;
  resourceUri: string;
  description: string;
  bundlePath: string;
  log: (message: string, level?: LogLevel) => void;
}

interface RegisterMcpAppResourceOptions extends RegisterUiResourceOptions {
  csp?: ResourceCsp;
}

interface RegisterChatgptWidgetResourceOptions extends RegisterUiResourceOptions {
  registrationName: string;
  csp?: OpenAIWidgetCsp;
}

type ReadOnlyToolAnnotations = RegisterUiSearchToolsOptions['annotations'];

function getUiToolSpecs(tools: UiSearchTools): UiToolSpec[] {
  return [
    {
      resourceKey: 'image',
      title: 'Brave Image Search',
      tool: tools.image,
      mcpApp: {
        description: 'Brave Image Search UI (MCP-APP)',
        bundlePath: 'src/lib/image/mcp-app.html',
        csp: {
          connectDomains: ['https://imgs.search.brave.com'],
          resourceDomains: ['https://imgs.search.brave.com', OPENAI_CDN_RESOURCE_DOMAIN],
        },
      },
      chatgptWidget: {
        registrationName: 'brave-image-search-chatgpt',
        description: 'Brave Image Search Widget (ChatGPT)',
        bundlePath: 'src/lib/image/chatgpt-app.html',
        csp: {
          connect_domains: ['https://imgs.search.brave.com'],
          resource_domains: ['https://imgs.search.brave.com', OPENAI_CDN_RESOURCE_DOMAIN],
        },
      },
      toolMeta: {
        invokingText: 'Searching for images…',
        invokedText: 'Images found.',
      },
    },
    {
      resourceKey: 'news',
      title: 'Brave News Search',
      tool: tools.news,
      mcpApp: {
        description: 'Brave News Search UI (MCP-APP)',
        bundlePath: 'src/lib/news/mcp-app.html',
        csp: {
          resourceDomains: ['https://imgs.search.brave.com', OPENAI_CDN_RESOURCE_DOMAIN],
        },
      },
      chatgptWidget: {
        registrationName: 'brave-news-search-chatgpt',
        description: 'Brave News Search Widget (ChatGPT)',
        bundlePath: 'src/lib/news/chatgpt-app.html',
        csp: {
          resource_domains: ['https://imgs.search.brave.com', OPENAI_CDN_RESOURCE_DOMAIN],
        },
      },
      toolMeta: {
        widgetAccessible: true,
        invokingText: 'Searching for news…',
        invokedText: 'News articles found.',
      },
    },
    {
      resourceKey: 'video',
      title: 'Brave Video Search',
      tool: tools.video,
      mcpApp: {
        description: 'Brave Video Search UI (MCP-APP)',
        bundlePath: 'src/lib/video/mcp-app.html',
        csp: {
          resourceDomains: ['https://imgs.search.brave.com', OPENAI_CDN_RESOURCE_DOMAIN],
          frameDomains: ['https://www.youtube.com', 'https://player.vimeo.com'],
        },
      },
      chatgptWidget: {
        registrationName: 'brave-video-search-chatgpt',
        description: 'Brave Video Search Widget (ChatGPT)',
        bundlePath: 'src/lib/video/chatgpt-app.html',
        csp: {
          resource_domains: ['https://imgs.search.brave.com', 'https://i.ytimg.com', OPENAI_CDN_RESOURCE_DOMAIN],
          frame_domains: ['https://www.youtube.com', 'https://youtube.com', 'https://player.vimeo.com', 'https://vimeo.com'],
        },
      },
      toolMeta: {
        widgetAccessible: true,
        invokingText: 'Searching for videos…',
        invokedText: 'Videos found.',
      },
    },
    {
      resourceKey: 'web',
      title: 'Brave Web Search',
      tool: tools.web,
      mcpApp: {
        description: 'Brave Web Search UI (MCP-APP)',
        bundlePath: 'src/lib/web/mcp-app.html',
        csp: {
          resourceDomains: ['https://imgs.search.brave.com', OPENAI_CDN_RESOURCE_DOMAIN],
        },
      },
      chatgptWidget: {
        registrationName: 'brave-web-search-chatgpt',
        description: 'Brave Web Search Widget (ChatGPT)',
        bundlePath: 'src/lib/web/chatgpt-app.html',
        csp: {
          resource_domains: ['https://imgs.search.brave.com', OPENAI_CDN_RESOURCE_DOMAIN],
        },
      },
      toolMeta: {
        widgetAccessible: true,
        invokingText: 'Searching the web…',
        invokedText: 'Search complete.',
      },
    },
    {
      resourceKey: 'local',
      title: 'Brave Local Search',
      tool: tools.local,
      mcpApp: {
        description: 'Brave Local Search UI (MCP-APP)',
        bundlePath: 'src/lib/local/mcp-app.html',
        csp: {
          resourceDomains: [
            'https://tile.openstreetmap.org',
            'https://a.tile.openstreetmap.org',
            'https://b.tile.openstreetmap.org',
            'https://c.tile.openstreetmap.org',
            OPENAI_CDN_RESOURCE_DOMAIN,
          ],
        },
      },
      chatgptWidget: {
        registrationName: 'brave-local-search-chatgpt',
        description: 'Brave Local Search Widget (ChatGPT)',
        bundlePath: 'src/lib/local/chatgpt-app.html',
        csp: {
          resource_domains: [
            'https://tile.openstreetmap.org',
            'https://a.tile.openstreetmap.org',
            'https://b.tile.openstreetmap.org',
            'https://c.tile.openstreetmap.org',
            OPENAI_CDN_RESOURCE_DOMAIN,
          ],
        },
      },
      toolMeta: {
        widgetAccessible: true,
        invokingText: 'Searching local businesses…',
        invokedText: 'Places found.',
      },
    },
  ];
}

function buildResourceMeta({
  csp,
  openaiWidgetCsp,
  openaiWidgetDomain,
}: Pick<LoadUiBundleOptions, 'csp' | 'openaiWidgetCsp' | 'openaiWidgetDomain'>): Record<string, unknown> | undefined {
  const meta: Record<string, unknown> = {};

  if (csp)
    meta.ui = { csp };

  if (openaiWidgetCsp)
    meta['openai/widgetCSP'] = openaiWidgetCsp;

  if (openaiWidgetDomain)
    meta['openai/widgetDomain'] = openaiWidgetDomain;

  return Object.keys(meta).length > 0 ? meta : undefined;
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
}: LoadUiBundleOptions): Promise<ReadResourceResult> {
  const uiPath = path.join(distDir, 'ui', bundlePath);

  try {
    const html = await fs.readFile(uiPath, 'utf-8');
    const meta = buildResourceMeta({
      csp,
      openaiWidgetCsp,
      openaiWidgetDomain,
    });

    return {
      contents: [
        {
          uri: resourceUri,
          mimeType,
          text: html,
          ...(meta && { _meta: meta }),
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

function registerMcpAppResource({
  server,
  distDir,
  resourceUri,
  description,
  bundlePath,
  log,
  csp,
}: RegisterMcpAppResourceOptions): void {
  registerAppResource(
    server,
    resourceUri,
    resourceUri,
    { mimeType: RESOURCE_MIME_TYPE, description },
    async (): Promise<ReadResourceResult> => {
      return loadUiBundle({
        distDir,
        resourceUri,
        mimeType: RESOURCE_MIME_TYPE,
        bundlePath,
        csp,
        log,
      });
    },
  );
}

function registerChatgptWidgetResource({
  server,
  distDir,
  registrationName,
  resourceUri,
  description,
  bundlePath,
  log,
  csp,
}: RegisterChatgptWidgetResourceOptions): void {
  server.registerResource(
    registrationName,
    resourceUri,
    { mimeType: CHATGPT_MIME_TYPE, description },
    async (): Promise<ReadResourceResult> => {
      return loadUiBundle({
        distDir,
        resourceUri,
        mimeType: CHATGPT_MIME_TYPE,
        bundlePath,
        openaiWidgetCsp: csp,
        openaiWidgetDomain: OPENAI_WIDGET_DOMAIN,
        log,
      });
    },
  );
}

function buildToolMeta({
  mcpAppResourceUri,
  chatgptResourceUri,
  toolMeta,
}: {
  mcpAppResourceUri: string;
  chatgptResourceUri: string;
  toolMeta: UiToolSpec['toolMeta'];
}): Record<string, unknown> {
  return {
    'ui': { resourceUri: mcpAppResourceUri },
    'openai/outputTemplate': chatgptResourceUri,
    'openai/toolInvocation/invoking': toolMeta.invokingText,
    'openai/toolInvocation/invoked': toolMeta.invokedText,
    ...(toolMeta.widgetAccessible ? { 'openai/widgetAccessible': true } : {}),
  };
}

function registerUiTool({
  server,
  annotations,
  spec,
  mcpAppResourceUri,
  chatgptResourceUri,
}: {
  server: McpServer;
  annotations: ReadOnlyToolAnnotations;
  spec: UiToolSpec;
  mcpAppResourceUri: string;
  chatgptResourceUri: string;
}): void {
  // The Apps SDK expects a narrower schema/handler shape here than our shared tool interface exposes,
  // so we keep the casts at this boundary instead of spreading them through the main control flow.
  registerAppTool(
    server,
    spec.tool.name,
    {
      title: spec.title,
      description: spec.tool.description,
      inputSchema: spec.tool.inputSchema.shape as never,
      annotations,
      _meta: buildToolMeta({
        mcpAppResourceUri,
        chatgptResourceUri,
        toolMeta: spec.toolMeta,
      }),
    },
    spec.tool.execute.bind(spec.tool) as never,
  );
}

export function registerUiSearchTools({
  server,
  distDir,
  log,
  annotations,
  tools,
}: RegisterUiSearchToolsOptions): void {
  for (const spec of getUiToolSpecs(tools)) {
    const { mcpApp: mcpAppResourceUri, chatgpt: chatgptResourceUri } = UI_RESOURCES[spec.resourceKey];

    registerMcpAppResource({
      server,
      distDir,
      resourceUri: mcpAppResourceUri,
      description: spec.mcpApp.description,
      bundlePath: spec.mcpApp.bundlePath,
      log,
      csp: spec.mcpApp.csp,
    });

    registerChatgptWidgetResource({
      server,
      distDir,
      registrationName: spec.chatgptWidget.registrationName,
      resourceUri: chatgptResourceUri,
      description: spec.chatgptWidget.description,
      bundlePath: spec.chatgptWidget.bundlePath,
      log,
      csp: spec.chatgptWidget.csp,
    });

    registerUiTool({
      server,
      annotations,
      spec,
      mcpAppResourceUri,
      chatgptResourceUri,
    });
  }
}

import type { ReadResourceResult } from '@modelcontextprotocol/sdk/types.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { BraveSearch } from 'brave-search';
import packageJson from '../package.json' with { type: 'json' };
import { BraveImageSearchTool } from './tools/BraveImageSearchTool.js';
import { BraveLLMContextSearchTool } from './tools/BraveLLMContextSearchTool.js';
import { BraveLocalSearchTool } from './tools/BraveLocalSearchTool.js';
import { BraveNewsSearchTool } from './tools/BraveNewsSearchTool.js';
import { BraveVideoSearchTool } from './tools/BraveVideoSearchTool.js';
import { BraveWebSearchTool } from './tools/BraveWebSearchTool.js';
import { UI_RESOURCES } from './ui-resources.js';

const DIST_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const { version: SERVER_VERSION } = packageJson;

/** ChatGPT Apps SDK MIME type for widget resources */
const CHATGPT_MIME_TYPE = 'text/html+skybridge';
const OPENAI_CDN_RESOURCE_DOMAIN = 'https://cdn.openai.com';
const OPENAI_WIDGET_DOMAIN = 'mc-brave-search-mcp';
const READ_ONLY_TOOL_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: true,
} as const;

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

interface StandardToolRegistrationTarget {
  name: string;
  description: string;
  inputSchema: unknown;
  execute: (input: never) => Promise<unknown>;
}

interface UiToolRegistrationTarget extends StandardToolRegistrationTarget {
  inputSchema: {
    shape: unknown;
  };
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

export class BraveMcpServer {
  private server: McpServer;
  private braveSearch: BraveSearch;
  private imageSearchTool: BraveImageSearchTool;
  private webSearchTool: BraveWebSearchTool;
  private localSearchTool: BraveLocalSearchTool;
  private newsSearchTool: BraveNewsSearchTool;
  private videoSearchTool: BraveVideoSearchTool;
  private llmContextSearchTool: BraveLLMContextSearchTool;

  /**
   * Creates a new BraveMcpServer instance.
   * @param braveSearchApiKey - The API key for Brave Search API
   * @param isUI - Whether to enable UI mode with widget resources
   * @param braveSearchInstance - Optional BraveSearch instance for dependency injection (useful for testing)
   */
  constructor(
    private braveSearchApiKey: string,
    private isUI: boolean = false,
    braveSearchInstance?: BraveSearch,
  ) {
    this.server = new McpServer(
      {
        name: 'Brave Search MCP Server',
        description: 'A server that provides tools for searching the web, images, videos, and local businesses using the Brave Search API.',
        version: SERVER_VERSION,
      },
      {
        capabilities: {
          tools: {},
          logging: {},
        },
      },
    );
    this.braveSearch = braveSearchInstance ?? new BraveSearch(braveSearchApiKey);
    // Enable structured content when UI mode is enabled
    this.imageSearchTool = new BraveImageSearchTool(this, this.braveSearch, this.isUI);
    this.webSearchTool = new BraveWebSearchTool(this, this.braveSearch, this.isUI);
    this.localSearchTool = new BraveLocalSearchTool(this, this.braveSearch, this.webSearchTool, this.isUI);
    this.newsSearchTool = new BraveNewsSearchTool(this, this.braveSearch, this.isUI);
    this.videoSearchTool = new BraveVideoSearchTool(this, this.braveSearch, this.isUI);
    this.llmContextSearchTool = new BraveLLMContextSearchTool(this, this.braveSearch, this.isUI);
    this.setupTools();
  }

  private setupTools(): void {
    const uiToolDescriptors = this.getUiToolDescriptors();

    if (this.isUI) {
      for (const descriptor of uiToolDescriptors)
        this.registerUiTool(descriptor);

      this.registerStandardTool(this.llmContextSearchTool);
      return;
    }

    for (const tool of [...uiToolDescriptors.map(({ tool }) => tool), this.llmContextSearchTool])
      this.registerStandardTool(tool);
  }

  private getUiToolDescriptors(): UiToolDescriptor[] {
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
        tool: this.imageSearchTool,
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
        tool: this.newsSearchTool,
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
        tool: this.videoSearchTool,
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
        tool: this.webSearchTool,
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
        tool: this.localSearchTool,
      },
    ];
  }

  private registerStandardTool(tool: StandardToolRegistrationTarget): void {
    this.server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: tool.inputSchema as never,
        annotations: READ_ONLY_TOOL_ANNOTATIONS,
      },
      tool.execute.bind(tool) as never,
    );
  }

  private registerUiTool(descriptor: UiToolDescriptor): void {
    const { mcpApp: mcpAppResourceUri, chatgpt: chatgptResourceUri } = UI_RESOURCES[descriptor.resourceKey];

    registerAppResource(
      this.server,
      mcpAppResourceUri,
      mcpAppResourceUri,
      { mimeType: RESOURCE_MIME_TYPE, description: descriptor.mcpResourceDescription },
      async (): Promise<ReadResourceResult> => {
        return this.loadUIBundle(
          mcpAppResourceUri,
          RESOURCE_MIME_TYPE,
          descriptor.mcpBundlePath,
          descriptor.mcpCsp,
        );
      },
    );

    this.server.registerResource(
      descriptor.chatgptRegistrationName,
      chatgptResourceUri,
      { mimeType: CHATGPT_MIME_TYPE, description: descriptor.chatgptResourceDescription },
      async (): Promise<ReadResourceResult> => {
        return this.loadUIBundle(
          chatgptResourceUri,
          CHATGPT_MIME_TYPE,
          descriptor.chatgptBundlePath,
          undefined,
          descriptor.chatgptCsp,
          OPENAI_WIDGET_DOMAIN,
        );
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
      this.server,
      descriptor.tool.name,
      {
        title: descriptor.title,
        description: descriptor.tool.description,
        inputSchema: descriptor.tool.inputSchema.shape as never,
        annotations: READ_ONLY_TOOL_ANNOTATIONS,
        _meta: toolMeta,
      },
      descriptor.tool.execute.bind(descriptor.tool) as never,
    );
  }

  /**
   * Load the UI bundle HTML from disk
   * @param resourceUri - The URI of the resource
   * @param mimeType - The MIME type of the resource
   * @param bundlePath - The HTML file path to load (e.g., 'src/lib/image/mcp-app.html')
   * @param csp - MCP-APP CSP config (ext-apps format)
   * @param csp.connectDomains - Allowed connect-src domains
   * @param csp.resourceDomains - Allowed resource domains (img-src, font-src, etc.)
   * @param csp.frameDomains - Allowed frame-src domains
   * @param csp.baseUriDomains - Allowed base-uri domains
   * @param openaiWidgetCSP - OpenAI/ChatGPT widget CSP config
   * @param openaiWidgetCSP.connect_domains - Allowed connect-src domains
   * @param openaiWidgetCSP.resource_domains - Allowed resource domains
   * @param openaiWidgetCSP.redirect_domains - Allowed redirect domains
   * @param openaiWidgetCSP.frame_domains - Allowed frame-src domains
   * @param openaiWidgetDomain - OpenAI/ChatGPT widget domain (subdomain for hosting)
   */
  private async loadUIBundle(
    resourceUri: string,
    mimeType: string,
    bundlePath: string,
    csp?: { connectDomains?: string[]; resourceDomains?: string[]; frameDomains?: string[]; baseUriDomains?: string[] },
    openaiWidgetCSP?: { connect_domains?: string[]; resource_domains?: string[]; redirect_domains?: string[]; frame_domains?: string[] },
    openaiWidgetDomain?: string,
  ): Promise<ReadResourceResult> {
    const uiPath = path.join(DIST_DIR, 'ui', bundlePath);
    try {
      const html = await fs.readFile(uiPath, 'utf-8');
      // Build _meta object conditionally
      const metaObj: Record<string, unknown> = {};
      if (csp) {
        metaObj.ui = { csp };
      }
      if (openaiWidgetCSP) {
        metaObj['openai/widgetCSP'] = openaiWidgetCSP;
      }
      if (openaiWidgetDomain) {
        metaObj['openai/widgetDomain'] = openaiWidgetDomain;
      }
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
      this.log(`UI bundle missing at ${uiPath}: ${message}`, 'warning');
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

  public get serverInstance(): McpServer {
    return this.server;
  }

  public log(
    message: string,
    level: 'error' | 'debug' | 'info' | 'notice' | 'warning' | 'critical' | 'alert' | 'emergency' = 'info',
  ): void {
    this.server.server.sendLoggingMessage({
      level,
      data: message,
    });
  }
}

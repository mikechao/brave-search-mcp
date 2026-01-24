import type { ReadResourceResult } from '@modelcontextprotocol/sdk/types.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { BraveSearch } from 'brave-search';
import { BraveImageSearchTool, imageSearchOutputSchema } from './tools/BraveImageSearchTool.js';
import { BraveLocalSearchTool } from './tools/BraveLocalSearchTool.js';
import { BraveNewsSearchTool } from './tools/BraveNewsSearchTool.js';
import { BraveVideoSearchTool } from './tools/BraveVideoSearchTool.js';
import { BraveWebSearchTool } from './tools/BraveWebSearchTool.js';

const DIST_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');

/** ChatGPT Apps SDK MIME type for widget resources */
const CHATGPT_MIME_TYPE = 'text/html+skybridge';

export class BraveMcpServer {
  private server: McpServer;
  private braveSearch: BraveSearch;
  private imageSearchTool: BraveImageSearchTool;
  private webSearchTool: BraveWebSearchTool;
  private localSearchTool: BraveLocalSearchTool;
  private newsSearchTool: BraveNewsSearchTool;
  private videoSearchTool: BraveVideoSearchTool;

  constructor(
    private braveSearchApiKey: string,
    private isUI: boolean = false,
  ) {
    this.server = new McpServer(
      {
        name: 'Brave Search MCP Server',
        description: 'A server that provides tools for searching the web, images, videos, and local businesses using the Brave Search API.',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
          logging: {},
        },
      },
    );
    this.braveSearch = new BraveSearch(braveSearchApiKey);
    // Enable structured content when UI mode is enabled
    this.imageSearchTool = new BraveImageSearchTool(this, this.braveSearch, this.isUI);
    this.webSearchTool = new BraveWebSearchTool(this, this.braveSearch, this.isUI);
    this.localSearchTool = new BraveLocalSearchTool(this, this.braveSearch, this.webSearchTool, this.isUI);
    this.newsSearchTool = new BraveNewsSearchTool(this, this.braveSearch, this.isUI);
    this.videoSearchTool = new BraveVideoSearchTool(this, this.braveSearch, this.isUI);
    this.setupTools();
  }

  private setupTools(): void {
    if (this.isUI) {
      // Dual-resource strategy: register BOTH MCP-APP and ChatGPT resources
      this.setupDualResourceImageTools();
      this.setupDualResourceNewsTools();
      this.setupDualResourceVideoTools();
      this.setupDualResourceWebTools();
      this.setupDualResourceLocalTools();
    }
    else {
      this.setupImageSearchTool();
      this.setupNewsSearchTool();
      this.setupVideoSearchTool();
      this.setupWebSearchTool();
      this.setupLocalSearchTool();
    }
  }

  /**
   * Dual-Resource Strategy for Image Search: Register both MCP-APP and ChatGPT resources
   */
  private setupDualResourceImageTools(): void {
    const mcpAppResourceUri = 'ui://brave-image-search/mcp-app.html';
    const chatgptResourceUri = 'ui://brave-image-search/chatgpt-widget.html';

    // Register MCP-APP resource (ext-apps format)
    registerAppResource(
      this.server,
      mcpAppResourceUri,
      mcpAppResourceUri,
      { mimeType: RESOURCE_MIME_TYPE, description: 'Brave Image Search UI (MCP-APP)' },
      async (): Promise<ReadResourceResult> => {
        return this.loadUIBundle(
          mcpAppResourceUri,
          RESOURCE_MIME_TYPE,
          'src/lib/image/mcp-app.html',
          { resourceDomains: ['https://imgs.search.brave.com', 'https://fonts.googleapis.com', 'https://fonts.gstatic.com'] },
        );
      },
    );

    // Register ChatGPT resource (skybridge format)
    this.server.registerResource(
      'brave-image-search-chatgpt',
      chatgptResourceUri,
      { mimeType: CHATGPT_MIME_TYPE, description: 'Brave Image Search Widget (ChatGPT)' },
      async (): Promise<ReadResourceResult> => {
        return this.loadUIBundle(
          chatgptResourceUri,
          CHATGPT_MIME_TYPE,
          'src/lib/image/chatgpt-app.html',
          undefined,
          { resource_domains: ['https://imgs.search.brave.com', 'https://fonts.googleapis.com', 'https://fonts.gstatic.com'] },
          'mc-brave-search-mcp',
        );
      },
    );

    // Register tool with BOTH metadata pointers
    registerAppTool(
      this.server,
      this.imageSearchTool.name,
      {
        title: 'Brave Image Search',
        description: this.imageSearchTool.description,
        inputSchema: this.imageSearchTool.inputSchema.shape,
        outputSchema: imageSearchOutputSchema.shape,
        _meta: {
          'ui': { resourceUri: mcpAppResourceUri },
          'openai/outputTemplate': chatgptResourceUri,
          'openai/toolInvocation/invoking': 'Searching for images…',
          'openai/toolInvocation/invoked': 'Images found.',
        },
      },
      this.imageSearchTool.execute.bind(this.imageSearchTool),
    );
  }

  /**
   * Dual-Resource Strategy for News Search: Register both MCP-APP and ChatGPT resources
   */
  private setupDualResourceNewsTools(): void {
    const mcpAppResourceUri = 'ui://brave-news-search/mcp-app.html';
    const chatgptResourceUri = 'ui://brave-news-search/chatgpt-widget.html';

    // Register MCP-APP resource (ext-apps format)
    registerAppResource(
      this.server,
      mcpAppResourceUri,
      mcpAppResourceUri,
      { mimeType: RESOURCE_MIME_TYPE, description: 'Brave News Search UI (MCP-APP)' },
      async (): Promise<ReadResourceResult> => {
        return this.loadUIBundle(
          mcpAppResourceUri,
          RESOURCE_MIME_TYPE,
          'src/lib/news/mcp-app.html',
          { resourceDomains: ['https://imgs.search.brave.com', 'https://fonts.googleapis.com', 'https://fonts.gstatic.com'] },
        );
      },
    );

    // Register ChatGPT resource (skybridge format)
    this.server.registerResource(
      'brave-news-search-chatgpt',
      chatgptResourceUri,
      { mimeType: CHATGPT_MIME_TYPE, description: 'Brave News Search Widget (ChatGPT)' },
      async (): Promise<ReadResourceResult> => {
        return this.loadUIBundle(
          chatgptResourceUri,
          CHATGPT_MIME_TYPE,
          'src/lib/news/chatgpt-app.html',
          undefined,
          { resource_domains: ['https://imgs.search.brave.com', 'https://fonts.googleapis.com', 'https://fonts.gstatic.com'] },
          'mc-brave-search-mcp',
        );
      },
    );

    // Register tool with BOTH metadata pointers
    registerAppTool(
      this.server,
      this.newsSearchTool.name,
      {
        title: 'Brave News Search',
        description: this.newsSearchTool.description,
        inputSchema: this.newsSearchTool.inputSchema.shape,
        _meta: {
          'ui': { resourceUri: mcpAppResourceUri },
          'openai/outputTemplate': chatgptResourceUri,
          'openai/widgetAccessible': true,
          'openai/toolInvocation/invoking': 'Searching for news…',
          'openai/toolInvocation/invoked': 'News articles found.',
        },
      },
      this.newsSearchTool.execute.bind(this.newsSearchTool),
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

  private setupImageSearchTool(): void {
    this.server.registerTool(
      this.imageSearchTool.name,
      {
        description: this.imageSearchTool.description,
        inputSchema: this.imageSearchTool.inputSchema,
      },
      this.imageSearchTool.execute.bind(this.imageSearchTool),
    );
  }

  private setupNewsSearchTool(): void {
    this.server.registerTool(
      this.newsSearchTool.name,
      {
        description: this.newsSearchTool.description,
        inputSchema: this.newsSearchTool.inputSchema,
      },
      this.newsSearchTool.execute.bind(this.newsSearchTool),
    );
  }

  /**
   * Dual-Resource Strategy for Video Search: Register both MCP-APP and ChatGPT resources
   */
  private setupDualResourceVideoTools(): void {
    const mcpAppResourceUri = 'ui://brave-video-search/mcp-app.html';
    const chatgptResourceUri = 'ui://brave-video-search/chatgpt-widget.html';

    // Register MCP-APP resource (ext-apps format)
    registerAppResource(
      this.server,
      mcpAppResourceUri,
      mcpAppResourceUri,
      { mimeType: RESOURCE_MIME_TYPE, description: 'Brave Video Search UI (MCP-APP)' },
      async (): Promise<ReadResourceResult> => {
        return this.loadUIBundle(
          mcpAppResourceUri,
          RESOURCE_MIME_TYPE,
          'src/lib/video/mcp-app.html',
          {
            resourceDomains: ['https://imgs.search.brave.com', 'https://fonts.googleapis.com', 'https://fonts.gstatic.com'],
            frameDomains: ['https://www.youtube.com', 'https://player.vimeo.com'],
          },
        );
      },
    );

    // Register ChatGPT resource (skybridge format)
    this.server.registerResource(
      'brave-video-search-chatgpt',
      chatgptResourceUri,
      { mimeType: CHATGPT_MIME_TYPE, description: 'Brave Video Search Widget (ChatGPT)' },
      async (): Promise<ReadResourceResult> => {
        return this.loadUIBundle(
          chatgptResourceUri,
          CHATGPT_MIME_TYPE,
          'src/lib/video/chatgpt-app.html',
          undefined,
          {
            resource_domains: ['https://imgs.search.brave.com', 'https://i.ytimg.com', 'https://fonts.googleapis.com', 'https://fonts.gstatic.com'],
            frame_domains: ['https://www.youtube.com', 'https://youtube.com', 'https://player.vimeo.com', 'https://vimeo.com'],
          },
          'mc-brave-search-mcp',
        );
      },
    );

    // Register tool with BOTH metadata pointers
    registerAppTool(
      this.server,
      this.videoSearchTool.name,
      {
        title: 'Brave Video Search',
        description: this.videoSearchTool.description,
        inputSchema: this.videoSearchTool.inputSchema.shape,
        _meta: {
          'ui': { resourceUri: mcpAppResourceUri },
          'openai/outputTemplate': chatgptResourceUri,
          'openai/widgetAccessible': true,
          'openai/toolInvocation/invoking': 'Searching for videos…',
          'openai/toolInvocation/invoked': 'Videos found.',
        },
      },
      this.videoSearchTool.execute.bind(this.videoSearchTool),
    );
  }

  private setupVideoSearchTool(): void {
    this.server.registerTool(
      this.videoSearchTool.name,
      {
        description: this.videoSearchTool.description,
        inputSchema: this.videoSearchTool.inputSchema,
      },
      this.videoSearchTool.execute.bind(this.videoSearchTool),
    );
  }

  /**
   * Dual-Resource Strategy for Web Search: Register both MCP-APP and ChatGPT resources
   */
  private setupDualResourceWebTools(): void {
    const mcpAppResourceUri = 'ui://brave-web-search/mcp-app.html';
    const chatgptResourceUri = 'ui://brave-web-search/chatgpt-widget.html';

    // Register MCP-APP resource (ext-apps format)
    registerAppResource(
      this.server,
      mcpAppResourceUri,
      mcpAppResourceUri,
      { mimeType: RESOURCE_MIME_TYPE, description: 'Brave Web Search UI (MCP-APP)' },
      async (): Promise<ReadResourceResult> => {
        return this.loadUIBundle(
          mcpAppResourceUri,
          RESOURCE_MIME_TYPE,
          'src/lib/web/mcp-app.html',
          { resourceDomains: ['https://imgs.search.brave.com', 'https://fonts.googleapis.com', 'https://fonts.gstatic.com'] },
        );
      },
    );

    // Register ChatGPT resource (skybridge format)
    this.server.registerResource(
      'brave-web-search-chatgpt',
      chatgptResourceUri,
      { mimeType: CHATGPT_MIME_TYPE, description: 'Brave Web Search Widget (ChatGPT)' },
      async (): Promise<ReadResourceResult> => {
        return this.loadUIBundle(
          chatgptResourceUri,
          CHATGPT_MIME_TYPE,
          'src/lib/web/chatgpt-app.html',
          undefined,
          { resource_domains: ['https://imgs.search.brave.com', 'https://fonts.googleapis.com', 'https://fonts.gstatic.com'] },
          'mc-brave-search-mcp',
        );
      },
    );

    // Register tool with BOTH metadata pointers
    registerAppTool(
      this.server,
      this.webSearchTool.name,
      {
        title: 'Brave Web Search',
        description: this.webSearchTool.description,
        inputSchema: this.webSearchTool.inputSchema.shape,
        _meta: {
          'ui': { resourceUri: mcpAppResourceUri },
          'openai/outputTemplate': chatgptResourceUri,
          'openai/widgetAccessible': true,
          'openai/toolInvocation/invoking': 'Searching the web…',
          'openai/toolInvocation/invoked': 'Search complete.',
        },
      },
      this.webSearchTool.execute.bind(this.webSearchTool),
    );
  }

  private setupWebSearchTool(): void {
    this.server.registerTool(
      this.webSearchTool.name,
      {
        description: this.webSearchTool.description,
        inputSchema: this.webSearchTool.inputSchema,
      },
      this.webSearchTool.execute.bind(this.webSearchTool),
    );
  }

  /**
   * Dual-Resource Strategy for Local Search: Register both MCP-APP and ChatGPT resources
   */
  private setupDualResourceLocalTools(): void {
    const mcpAppResourceUri = 'ui://brave-local-search/mcp-app.html';
    const chatgptResourceUri = 'ui://brave-local-search/chatgpt-widget.html';

    // Register MCP-APP resource (ext-apps format)
    registerAppResource(
      this.server,
      mcpAppResourceUri,
      mcpAppResourceUri,
      { mimeType: RESOURCE_MIME_TYPE, description: 'Brave Local Search UI (MCP-APP)' },
      async (): Promise<ReadResourceResult> => {
        return this.loadUIBundle(
          mcpAppResourceUri,
          RESOURCE_MIME_TYPE,
          'src/lib/local/mcp-app.html',
          {
            resourceDomains: [
              'https://a.tile.openstreetmap.org',
              'https://b.tile.openstreetmap.org',
              'https://c.tile.openstreetmap.org',
              'https://cdnjs.cloudflare.com',
              'https://fonts.googleapis.com',
              'https://fonts.gstatic.com',
            ],
          },
        );
      },
    );

    // Register ChatGPT resource (skybridge format)
    this.server.registerResource(
      'brave-local-search-chatgpt',
      chatgptResourceUri,
      { mimeType: CHATGPT_MIME_TYPE, description: 'Brave Local Search Widget (ChatGPT)' },
      async (): Promise<ReadResourceResult> => {
        return this.loadUIBundle(
          chatgptResourceUri,
          CHATGPT_MIME_TYPE,
          'src/lib/local/chatgpt-app.html',
          undefined,
          {
            resource_domains: [
              'https://tile.openstreetmap.org',
              'https://a.tile.openstreetmap.org',
              'https://b.tile.openstreetmap.org',
              'https://c.tile.openstreetmap.org',
              'https://cdnjs.cloudflare.com',
              'https://fonts.googleapis.com',
              'https://fonts.gstatic.com',
            ],
          },
          'mc-brave-search-mcp',
        );
      },
    );

    // Register tool with BOTH metadata pointers
    registerAppTool(
      this.server,
      this.localSearchTool.name,
      {
        title: 'Brave Local Search',
        description: this.localSearchTool.description,
        inputSchema: this.localSearchTool.inputSchema.shape,
        _meta: {
          'ui': { resourceUri: mcpAppResourceUri },
          'openai/outputTemplate': chatgptResourceUri,
          'openai/widgetAccessible': true,
          'openai/toolInvocation/invoking': 'Searching local businesses…',
          'openai/toolInvocation/invoked': 'Places found.',
        },
      },
      this.localSearchTool.execute.bind(this.localSearchTool),
    );
  }

  private setupLocalSearchTool(): void {
    this.server.registerTool(
      this.localSearchTool.name,
      {
        description: this.localSearchTool.description,
        inputSchema: this.localSearchTool.inputSchema,
      },
      this.localSearchTool.execute.bind(this.localSearchTool),
    );
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

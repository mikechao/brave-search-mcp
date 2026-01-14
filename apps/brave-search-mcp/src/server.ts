import { RESOURCE_MIME_TYPE, registerAppResource, registerAppTool } from '@modelcontextprotocol/ext-apps/server';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ReadResourceResult } from '@modelcontextprotocol/sdk/types.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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
    private isChatGPT: boolean = false,
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
    // Enable structured content for both UI modes
    const enableStructuredContent = this.isUI || this.isChatGPT;
    this.imageSearchTool = new BraveImageSearchTool(this, this.braveSearch, enableStructuredContent);
    this.webSearchTool = new BraveWebSearchTool(this, this.braveSearch);
    this.localSearchTool = new BraveLocalSearchTool(this, this.braveSearch, this.webSearchTool);
    this.newsSearchTool = new BraveNewsSearchTool(this, this.braveSearch);
    this.videoSearchTool = new BraveVideoSearchTool(this, this.braveSearch);
    this.setupTools();
  }

  private setupTools(): void {
    if (this.isChatGPT) {
      this.setupChatGPTTools();
    }
    else if (this.isUI) {
      this.setupUITools();
    }
    else {
      this.setupImageSearchTool();
    }
    this.server.registerTool(
      this.webSearchTool.name,
      {
        description: this.webSearchTool.description,
        inputSchema: this.webSearchTool.inputSchema,
      },
      this.webSearchTool.execute.bind(this.webSearchTool),
    );
    this.server.registerTool(
      this.localSearchTool.name,
      {
        description: this.localSearchTool.description,
        inputSchema: this.localSearchTool.inputSchema,
      },
      this.localSearchTool.execute.bind(this.localSearchTool),
    );
    this.server.registerTool(
      this.newsSearchTool.name,
      {
        description: this.newsSearchTool.description,
        inputSchema: this.newsSearchTool.inputSchema,
      },
      this.newsSearchTool.execute.bind(this.newsSearchTool),
    );
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
   * Setup tools and resources for MCP-APP (ext-apps) hosts
   * Uses RESOURCE_MIME_TYPE (text/html+mcpappoutput) and ext-apps format
   */
  private setupUITools(): void {
    const resourceUri = 'ui://brave-image-search/mcp-app.html';
    registerAppTool(
      this.server,
      this.imageSearchTool.name,
      {
        description: this.imageSearchTool.description,
        inputSchema: this.imageSearchTool.inputSchema.shape,
        outputSchema: imageSearchOutputSchema.shape,
        _meta: { ui: { resourceUri } },
      },
      this.imageSearchTool.execute.bind(this.imageSearchTool),
    );
    registerAppResource(
      this.server,
      resourceUri,
      resourceUri,
      { mimeType: RESOURCE_MIME_TYPE, description: 'Brave Image Search UI' },
      async (): Promise<ReadResourceResult> => {
        return this.loadUIBundle(resourceUri, RESOURCE_MIME_TYPE);
      },
    );
  }

  /**
   * Setup tools and resources for ChatGPT Apps SDK hosts
   * Uses text/html+skybridge MIME type and OpenAI metadata format
   */
  private setupChatGPTTools(): void {
    const resourceUri = 'ui://brave-image-search/widget.html';

    // Register resource with ChatGPT MIME type
    this.server.registerResource(
      'brave-image-search-widget',
      resourceUri,
      { mimeType: CHATGPT_MIME_TYPE, description: 'Brave Image Search Widget' },
      async (): Promise<ReadResourceResult> => {
        // Use the separate ChatGPT bundle (no ext-apps SDK)
        return this.loadUIBundle(resourceUri, CHATGPT_MIME_TYPE, 'chatgpt-app.html');
      },
    );

    // Register tool with ChatGPT metadata format
    this.server.registerTool(
      this.imageSearchTool.name,
      {
        title: 'Brave Image Search',
        description: this.imageSearchTool.description,
        inputSchema: this.imageSearchTool.inputSchema.shape,
        outputSchema: imageSearchOutputSchema.shape,
        _meta: {
          'openai/outputTemplate': resourceUri,
          'openai/toolInvocation/invoking': 'Searching for images…',
          'openai/toolInvocation/invoked': 'Images found.',
        },
      },
      this.imageSearchTool.execute.bind(this.imageSearchTool),
    );
  }

  /**
   * Load the UI bundle HTML from disk
   * @param bundleName - The HTML file to load (defaults to mcp-app.html)
   */
  private async loadUIBundle(
    resourceUri: string,
    mimeType: string,
    bundleName: string = 'mcp-app.html',
  ): Promise<ReadResourceResult> {
    const uiPath = path.join(DIST_DIR, 'ui', bundleName);
    try {
      const html = await fs.readFile(uiPath, 'utf-8');
      return {
        contents: [
          {
            uri: resourceUri,
            mimeType,
            text: html,
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

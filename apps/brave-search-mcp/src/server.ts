import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { BraveSearch } from 'brave-search';
import { BraveImageSearchTool } from './tools/BraveImageSearchTool.js';
import { BraveLocalSearchTool } from './tools/BraveLocalSearchTool.js';
import { BraveNewsSearchTool } from './tools/BraveNewsSearchTool.js';
import { BraveVideoSearchTool } from './tools/BraveVideoSearchTool.js';
import { BraveWebSearchTool } from './tools/BraveWebSearchTool.js';

export class BraveMcpServer {
  private server: McpServer;
  private braveSearch: BraveSearch;
  private imageSearchTool: BraveImageSearchTool;
  private webSearchTool: BraveWebSearchTool;
  private localSearchTool: BraveLocalSearchTool;
  private newsSearchTool: BraveNewsSearchTool;
  private videoSearchTool: BraveVideoSearchTool;

  constructor(private braveSearchApiKey: string) {
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
    this.imageSearchTool = new BraveImageSearchTool(this, this.braveSearch);
    this.webSearchTool = new BraveWebSearchTool(this, this.braveSearch);
    this.localSearchTool = new BraveLocalSearchTool(this, this.braveSearch, this.webSearchTool);
    this.newsSearchTool = new BraveNewsSearchTool(this, this.braveSearch);
    this.videoSearchTool = new BraveVideoSearchTool(this, this.braveSearch);
    this.setupTools();
  }

  private setupTools(): void {
    this.server.registerTool(
      this.imageSearchTool.name,
      {
        description: this.imageSearchTool.description,
        inputSchema: this.imageSearchTool.inputSchema,
      },
      this.imageSearchTool.execute.bind(this.imageSearchTool),
    );
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

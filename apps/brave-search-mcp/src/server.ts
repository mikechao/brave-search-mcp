import type { LocalWebFallbackExecutor, ToolInterceptor, ToolLogger } from './tools/tool-helpers.js';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { BraveSearch } from 'brave-search';
import packageJson from '../package.json' with { type: 'json' };
import { loadPolicyRulesSync } from './policy-loader.js';
import { registerUiSearchTools } from './server-ui.js';
import { BraveImageSearchTool } from './tools/BraveImageSearchTool.js';
import { BraveLLMContextSearchTool } from './tools/BraveLLMContextSearchTool.js';
import { BraveLocalSearchTool } from './tools/BraveLocalSearchTool.js';
import { BraveNewsSearchTool } from './tools/BraveNewsSearchTool.js';
import { BraveVideoSearchTool } from './tools/BraveVideoSearchTool.js';
import { BraveWebSearchTool } from './tools/BraveWebSearchTool.js';
import { QueryPolicyInterceptor } from './tools/QueryPolicyInterceptor.js';
import { buildToolErrorResult, executeTool } from './tools/tool-helpers.js';
import { UsageGuardrailInterceptor } from './tools/UsageGuardrailInterceptor.js';

const DIST_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const { version: SERVER_VERSION } = packageJson;

const READ_ONLY_TOOL_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: true,
} as const;

interface StandardToolRegistrationTarget {
  name: string;
  description: string;
  inputSchema: unknown;
  execute: (input: never) => Promise<unknown>;
}

interface ServerTools {
  image: BraveImageSearchTool;
  web: BraveWebSearchTool;
  local: BraveLocalSearchTool;
  news: BraveNewsSearchTool;
  video: BraveVideoSearchTool;
  llmContext: BraveLLMContextSearchTool;
}

export class BraveMcpServer {
  private server: McpServer;
  private tools: ServerTools;

  /**
   * Creates a new BraveMcpServer instance.
   * @param braveSearchApiKey - The API key for Brave Search API
   * @param isUI - Whether to enable UI mode with widget resources
   * @param braveSearchInstance - Optional BraveSearch instance for dependency injection (useful for testing)
   */
  constructor(
    braveSearchApiKey: string,
    isUI: boolean = false,
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

    const braveSearch = braveSearchInstance ?? new BraveSearch(braveSearchApiKey);
    const log: ToolLogger = this.log.bind(this);
    const activeInterceptors = this.buildInterceptors();

    // Keep tool creation inline so the server's main wiring stays easy to scan.
    const image = new BraveImageSearchTool(log, braveSearch, isUI, activeInterceptors);
    const web = new BraveWebSearchTool(log, braveSearch, isUI, activeInterceptors);
    const executeWebFallback: LocalWebFallbackExecutor = input =>
      executeTool({
        toolName: web.name,
        input,
        executeCore: value => web.executeCore(value),
        buildErrorResult: (_value, error) => buildToolErrorResult(web.name, error),
        interceptors: activeInterceptors,
        isFallback: true,
      });
    const local = new BraveLocalSearchTool(log, braveSearch, executeWebFallback, isUI, activeInterceptors);
    const news = new BraveNewsSearchTool(log, braveSearch, isUI, activeInterceptors);
    const video = new BraveVideoSearchTool(log, braveSearch, isUI, activeInterceptors);
    const llmContext = new BraveLLMContextSearchTool(log, braveSearch, isUI, activeInterceptors);

    this.tools = {
      image,
      web,
      local,
      news,
      video,
      llmContext,
    };

    this.registerConfiguredTools(isUI);
  }

  private buildInterceptors(): readonly ToolInterceptor[] {
    const interceptors: ToolInterceptor[] = [];
    const policyFile = process.env.BRAVE_MCP_POLICY_FILE;
    if (policyFile) {
      const rules = loadPolicyRulesSync(policyFile);
      const redactMode = (process.env.BRAVE_MCP_POLICY_REDACT ?? '').toLowerCase() === 'true';
      interceptors.push(new QueryPolicyInterceptor(rules, redactMode));
    }
    const requestLimitStr = process.env.BRAVE_MCP_REQUEST_LIMIT;
    if (requestLimitStr !== undefined) {
      const requestLimit = /^\d+$/.test(requestLimitStr) ? Number(requestLimitStr) : 0;
      if (requestLimit > 0) {
        const windowStr = process.env.BRAVE_MCP_WINDOW_SECONDS ?? '0';
        const cooldownStr = process.env.BRAVE_MCP_COOLDOWN_SECONDS ?? '0';
        interceptors.push(new UsageGuardrailInterceptor({
          requestLimit,
          windowMs: /^\d+$/.test(windowStr) ? Number(windowStr) * 1000 : 0,
          cooldownMs: /^\d+$/.test(cooldownStr) ? Number(cooldownStr) * 1000 : 0,
        }));
      }
    }
    return interceptors;
  }

  private registerConfiguredTools(isUI: boolean): void {
    if (isUI) {
      registerUiSearchTools({
        server: this.server,
        distDir: DIST_DIR,
        log: this.log.bind(this),
        annotations: READ_ONLY_TOOL_ANNOTATIONS,
        tools: {
          image: this.tools.image,
          web: this.tools.web,
          local: this.tools.local,
          news: this.tools.news,
          video: this.tools.video,
        },
      });

      this.registerStandardTool(this.tools.llmContext);
      return;
    }

    for (const tool of this.getStandardTools())
      this.registerStandardTool(tool);
  }

  private getStandardTools(): StandardToolRegistrationTarget[] {
    return [
      this.tools.image,
      this.tools.web,
      this.tools.local,
      this.tools.news,
      this.tools.video,
      this.tools.llmContext,
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

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ReadResourceResult } from '@modelcontextprotocol/sdk/types.js';
import type { BraveImageSearchTool } from './tools/BraveImageSearchTool.js';
import type { BraveLocalSearchTool } from './tools/BraveLocalSearchTool.js';
import type { BraveNewsSearchTool } from './tools/BraveNewsSearchTool.js';
import type { BraveVideoSearchTool } from './tools/BraveVideoSearchTool.js';
import type { BraveWebSearchTool } from './tools/BraveWebSearchTool.js';
import type { OpenAIWidgetCsp, ResourceCsp, UiSearchToolTarget, UiToolSpecConfig } from './ui-config.js';
import fs from 'node:fs/promises';
import path from 'node:path';

import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';
import {
  CHATGPT_MIME_TYPE,
  OPENAI_WIDGET_DOMAIN,

} from './ui-config.js';

type LogLevel
  = 'error'
    | 'debug'
    | 'info'
    | 'notice'
    | 'warning'
    | 'critical'
    | 'alert'
    | 'emergency';

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
  toolMeta: UiToolSpecConfig['toolMeta'];
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
  tool,
  uiSpec,
}: {
  server: McpServer;
  annotations: ReadOnlyToolAnnotations;
  tool: UiSearchToolTarget;
  uiSpec: UiToolSpecConfig;
}): void {
  // The Apps SDK expects a narrower schema/handler shape here than our shared tool interface exposes,
  // so we keep the casts at this boundary instead of spreading them through the main control flow.
  registerAppTool(
    server,
    tool.name,
    {
      title: uiSpec.title,
      description: tool.description,
      inputSchema: tool.inputSchema.shape as never,
      annotations,
      _meta: buildToolMeta({
        mcpAppResourceUri: uiSpec.mcpAppResourceUri,
        chatgptResourceUri: uiSpec.chatgptResourceUri,
        toolMeta: uiSpec.toolMeta,
      }),
    },
    tool.execute.bind(tool) as never,
  );
}

export function registerUiSearchTools({
  server,
  distDir,
  log,
  annotations,
  tools,
}: RegisterUiSearchToolsOptions): void {
  for (const tool of Object.values(tools)) {
    const toolTarget = tool as UiSearchToolTarget;
    const uSpec = toolTarget.uiSpec;
    if (!uSpec)
      continue;

    registerMcpAppResource({
      server,
      distDir,
      resourceUri: uSpec.mcpAppResourceUri,
      description: uSpec.mcpApp.description,
      bundlePath: uSpec.mcpApp.bundlePath,
      log,
      csp: uSpec.mcpApp.csp,
    });

    registerChatgptWidgetResource({
      server,
      distDir,
      registrationName: uSpec.chatgptWidget.registrationName,
      resourceUri: uSpec.chatgptResourceUri,
      description: uSpec.chatgptWidget.description,
      bundlePath: uSpec.chatgptWidget.bundlePath,
      log,
      csp: uSpec.chatgptWidget.csp,
    });

    registerUiTool({
      server,
      annotations,
      tool: toolTarget,
      uiSpec: uSpec,
    });
  }
}

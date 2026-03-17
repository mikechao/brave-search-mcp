export const CHATGPT_MIME_TYPE = 'text/html+skybridge';
export const OPENAI_CDN_RESOURCE_DOMAIN = 'https://cdn.openai.com';
export const OPENAI_WIDGET_DOMAIN = 'mc-brave-search-mcp';

export interface ResourceCsp {
  connectDomains?: string[];
  resourceDomains?: string[];
  frameDomains?: string[];
  baseUriDomains?: string[];
}

export interface OpenAIWidgetCsp {
  connect_domains?: string[];
  resource_domains?: string[];
  redirect_domains?: string[];
  frame_domains?: string[];
}

export interface UiToolSpecConfig {
  mcpAppResourceUri: string;
  chatgptResourceUri: string;
  title: string;
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

export interface UiSearchToolTarget {
  name: string;
  description: string;
  inputSchema: {
    shape: unknown;
  };
  execute: (input: never) => Promise<unknown>;
  uiSpec?: UiToolSpecConfig;
}

export const UI_RESOURCES = {
  image: {
    mcpApp: 'ui://brave-image-search/mcp-app.html',
    chatgpt: 'ui://brave-image-search/chatgpt-widget.html',
  },
  news: {
    mcpApp: 'ui://brave-news-search/mcp-app.html',
    chatgpt: 'ui://brave-news-search/chatgpt-widget.html',
  },
  video: {
    mcpApp: 'ui://brave-video-search/mcp-app.html',
    chatgpt: 'ui://brave-video-search/chatgpt-widget.html',
  },
  web: {
    mcpApp: 'ui://brave-web-search/mcp-app.html',
    chatgpt: 'ui://brave-web-search/chatgpt-widget.html',
  },
  local: {
    mcpApp: 'ui://brave-local-search/mcp-app.html',
    chatgpt: 'ui://brave-local-search/chatgpt-widget.html',
  },
} as const;

export const ALL_UI_RESOURCE_URIS = Object.values(UI_RESOURCES)
  .flatMap(({ mcpApp, chatgpt }) => [mcpApp, chatgpt]);

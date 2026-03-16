export const TOOL_NAMES = {
  web: 'brave_web_search',
  llmContext: 'brave_llm_context_search',
  image: 'brave_image_search',
  news: 'brave_news_search',
  local: 'brave_local_search',
  video: 'brave_video_search',
} as const;

export type ToolKey = keyof typeof TOOL_NAMES;

export type WidgetToolVariant = Exclude<ToolKey, 'llmContext'>;

const TOOL_MANIFEST_DESCRIPTIONS = {
  web: 'Execute web searches using Brave\'s API',
  llmContext: 'Extract relevant text snippets from web pages for deeper research and synthesis',
  image: 'Get images from the web relevant to the query',
  news: 'Searches the web for news',
  local: 'Search for local businesses, services and points of interest',
  video: 'Search the web for videos',
} as const satisfies Record<ToolKey, string>;

export const MANIFEST_TOOL_ENTRIES = (Object.keys(TOOL_NAMES) as ToolKey[]).map(key => ({
  name: TOOL_NAMES[key],
  description: TOOL_MANIFEST_DESCRIPTIONS[key],
}));

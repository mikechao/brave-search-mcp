export type ToolKey
  = 'web'
    | 'llmContext'
    | 'image'
    | 'news'
    | 'local'
    | 'video';

export type WidgetToolVariant
  = 'image'
    | 'news'
    | 'video'
    | 'web'
    | 'local';

export interface ToolDefinition {
  readonly key: ToolKey;
  readonly name: string;
  readonly manifestDescription: string;
  readonly variant?: WidgetToolVariant;
}

export const TOOL_NAMES = {
  web: 'brave_web_search',
  llmContext: 'brave_llm_context_search',
  image: 'brave_image_search',
  news: 'brave_news_search',
  local: 'brave_local_search',
  video: 'brave_video_search',
} as const;

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    key: 'web',
    variant: 'web',
    name: TOOL_NAMES.web,
    manifestDescription: 'Execute web searches using Brave\'s API',
  },
  {
    key: 'llmContext',
    name: TOOL_NAMES.llmContext,
    manifestDescription: 'Extract relevant text snippets from web pages for deeper research and synthesis',
  },
  {
    key: 'image',
    variant: 'image',
    name: TOOL_NAMES.image,
    manifestDescription: 'Get images from the web relevant to the query',
  },
  {
    key: 'news',
    variant: 'news',
    name: TOOL_NAMES.news,
    manifestDescription: 'Searches the web for news',
  },
  {
    key: 'local',
    variant: 'local',
    name: TOOL_NAMES.local,
    manifestDescription: 'Search for local businesses, services and points of interest',
  },
  {
    key: 'video',
    variant: 'video',
    name: TOOL_NAMES.video,
    manifestDescription: 'Search the web for videos',
  },
];

export const ALL_TOOL_NAMES = Object.values(TOOL_NAMES);

export const MANIFEST_TOOL_ENTRIES = TOOL_DEFINITIONS.map(({ name, manifestDescription }) => ({
  name,
  description: manifestDescription,
}));

export function toolNameForVariant(variant: WidgetToolVariant): string {
  return TOOL_NAMES[variant];
}

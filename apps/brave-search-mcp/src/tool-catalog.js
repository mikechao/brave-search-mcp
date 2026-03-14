const TOOL_NAMES = {
  web: 'brave_web_search',
  llmContext: 'brave_llm_context_search',
  image: 'brave_image_search',
  news: 'brave_news_search',
  local: 'brave_local_search',
  video: 'brave_video_search',
};

const TOOL_NAME_BY_VARIANT = {
  web: TOOL_NAMES.web,
  image: TOOL_NAMES.image,
  news: TOOL_NAMES.news,
  local: TOOL_NAMES.local,
  video: TOOL_NAMES.video,
};

// Keep this as plain JavaScript because the manifest sync scripts import it directly.
const TOOL_DEFINITIONS = [
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

const ALL_TOOL_NAMES = Object.values(TOOL_NAMES);

const MANIFEST_TOOL_ENTRIES = TOOL_DEFINITIONS.map(({ name, manifestDescription }) => ({
  name,
  description: manifestDescription,
}));

function toolNameForVariant(variant) {
  return TOOL_NAME_BY_VARIANT[variant];
}

export {
  ALL_TOOL_NAMES,
  MANIFEST_TOOL_ENTRIES,
  TOOL_DEFINITIONS,
  TOOL_NAMES,
  toolNameForVariant,
};

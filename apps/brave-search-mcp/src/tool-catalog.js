const TOOL_DEFINITIONS = [
  {
    key: 'web',
    variant: 'web',
    name: 'brave_web_search',
    manifestDescription: 'Execute web searches using Brave\'s API',
  },
  {
    key: 'llmContext',
    name: 'brave_llm_context_search',
    manifestDescription: 'Extract relevant text snippets from web pages for deeper research and synthesis',
  },
  {
    key: 'image',
    variant: 'image',
    name: 'brave_image_search',
    manifestDescription: 'Get images from the web relevant to the query',
  },
  {
    key: 'news',
    variant: 'news',
    name: 'brave_news_search',
    manifestDescription: 'Searches the web for news',
  },
  {
    key: 'local',
    variant: 'local',
    name: 'brave_local_search',
    manifestDescription: 'Search for local businesses, services and points of interest',
  },
  {
    key: 'video',
    variant: 'video',
    name: 'brave_video_search',
    manifestDescription: 'Search the web for videos',
  },
];

function getToolDefinition(key) {
  const definition = TOOL_DEFINITIONS.find(tool => tool.key === key);
  if (!definition) {
    throw new TypeError(`Missing tool definition for key "${key}"`);
  }
  return definition;
}

const TOOL_NAME_BY_VARIANT = TOOL_DEFINITIONS.reduce((acc, tool) => {
  if (tool.variant) {
    acc[tool.variant] = tool.name;
  }
  return acc;
}, /** @type {Record<string, string>} */ ({}));

const TOOL_NAMES = {
  web: getToolDefinition('web').name,
  llmContext: getToolDefinition('llmContext').name,
  image: getToolDefinition('image').name,
  news: getToolDefinition('news').name,
  local: getToolDefinition('local').name,
  video: getToolDefinition('video').name,
};

const ALL_TOOL_NAMES = TOOL_DEFINITIONS.map(tool => tool.name);

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

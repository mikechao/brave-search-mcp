import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { Request, Response } from 'express';
import process from 'node:process';
import { parseArgs } from 'node:util';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { BraveSearch } from 'brave-search';
import { SafeSearchLevel } from 'brave-search/dist/types.js';
import express from 'express';
import imageToBase64 from 'image-to-base64';

const server = new Server(
  {
    name: 'Better Brave Search',
    version: '1.0.0',
  },
  {
    capabilities: {
      resources: {},
      tools: {},
      logging: {},
    },
  },
);

// Check for API key
const BRAVE_API_KEY = process.env.BRAVE_API_KEY;
if (!BRAVE_API_KEY) {
  console.error('Error: BRAVE_API_KEY environment variable is required');
  process.exit(1);
}

const braveSearch = new BraveSearch(BRAVE_API_KEY);

const BRAVE_IMAGE_SEARCH_TOOL: Tool = {
  name: 'brave_image_search',
  description: 'Search for images using the Brave Search API',
  inputSchema: {
    type: 'object',
    properties: {
      searchTerm: {
        type: 'string',
        description: 'The term to search the internet for images of',
      },
      count: {
        type: 'integer',
        minimum: 1,
        maximum: 3,
        default: 1,
        description: 'The number of images to search for, minimum 1, maximum 3',
      },
    },
    required: ['searchTerm'],
  },
};

const searchDescription = 'Performs a web search using the Brave Search API, ideal for general queries, news, articles, and online content. '
  + 'Use this for broad information gathering, recent events, or when you need diverse web sources. '
  + 'Supports pagination, content filtering, and freshness controls. '
  + 'Maximum 20 results per request, with offset for pagination. ';

const BRAVE_WEB_SEARCH_TOOL: Tool = {
  name: 'brave_web_search',
  description: searchDescription,
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The term to search the internet for',
      },
      count: {
        type: 'integer',
        minimum: 1,
        maximum: 20,
        default: 10,
        description: 'The number of results to return',
      },
      offset: {
        type: 'integer',
        minimum: 0,
        maximum: 9,
        default: 0,
        description: 'The offset for pagination',
      },
    },
    required: ['query'],
  },
};

const TOOLS: Tool[] = [BRAVE_IMAGE_SEARCH_TOOL, BRAVE_WEB_SEARCH_TOOL] as const;

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, argument: args } = request.params;
    if (!args) {
      throw new Error('No arguments provided');
    }
    switch (name) {
      case 'brave_image_search': {
        if (!isImageSearchArgs(args)) {
          throw new Error('Invalid arguments for brave_image_search tool');
        }
        const { searchTerm, count } = args;
        if (count < 1 || count > 3) {
          return {
            content: [
              {
                type: 'text',
                text: 'count must be less than or equal to 3 and greater than or equal to 1',
              },
            ],
            isError: true,
          };
        }
        const result = await handleImageSearch(searchTerm, count);
        return result;
      }

      case 'brave_web_search': {
        if (!isWebSearchArgs(args)) {
          throw new Error('Invalid arguments for brave_web_search tool');
        }
        const { query, count, offset } = args;
        const result = await handleWebSearch(query, count, offset);
        return result;
      }

      default: {
        return {
          content: [{ type: 'text', text: `Unknown tool: ${name}` }],
          isError: true,
        };
      }
    }
  }
  catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

function isImageSearchArgs(args: unknown): args is { searchTerm: string; count: number } {
  return (
    typeof args === 'object'
    && args !== null
    && 'searchTerm' in args
    && typeof (args as { searchTerm: string }).searchTerm === 'string'
    && 'count' in args
    && typeof (args as { count: number }).count === 'number'
  );
}

async function handleImageSearch(searchTerm: string, count: number) {
  log(`Searching for images of "${searchTerm}" with count ${count}`, 'debug');
  try {
    const imageResults = await braveSearch.imageSearch(searchTerm, {
      count,
      safesearch: SafeSearchLevel.Strict,
    });
    log(`Found ${imageResults.results.length} images for "${searchTerm}"`, 'debug');
    const content = [];
    for (const result of imageResults.results) {
      const base64 = await imageToBase64(result.properties.url);
      log(`Image base64 length: ${base64.length}`, 'debug');
      content.push({
        type: 'image' as const,
        data: base64,
        mimeType: 'image/png',
      });
    }
    return { content };
  }
  catch (error) {
    console.error(`Error searching for images: ${error}`);
    return {
      content: [],
      isError: true,
      error: `Error searching for images: ${error}`,
    };
  }
}

function isWebSearchArgs(args: unknown): args is { query: string; count: number; offset: number } {
  return (
    typeof args === 'object'
    && args !== null
    && 'query' in args
    && typeof (args as { query: string }).query === 'string'
    && 'count' in args
    && typeof (args as { count: number }).count === 'number'
    && 'offset' in args
    && typeof (args as { offset: number }).offset === 'number'
  );
}

async function handleWebSearch(query: string, count: number, offset: number) {
  log(`Searching for "${query}" with count ${count} and offset ${offset}`, 'debug');
  try {
    const results = await braveSearch.webSearch(query, {
      count,
      offset,
      safesearch: SafeSearchLevel.Strict,
    });
    if (results.web?.results.length === 0) {
      log(`No results found for "${query}"`);
      return { content: [] };
    }
    return {
      content: results.web?.results.map(result => ({
        type: 'text',
        text: `Title: ${result.title}\nURL: ${result.url}\nDescription: ${result.description}`,
      })) || [],
    };
  }
  catch (error) {
    console.error(`Error searching for "${query}": ${error}`);
    return {
      content: [],
      isError: true,
      error: `Error searching for "${query}": ${error}`,
    };
  }
}

// Parse command line arguments
const { values: { useSSE, port } } = parseArgs({
  options: {
    useSSE: {
      type: 'boolean',
      default: false,
    },
    port: {
      type: 'string',
      default: '3033',
    },
  },
});

async function main() {
  if (useSSE) {
    log('Running with SSE transport');
    const portInt = Number.parseInt(port, 10);
    if (Number.isNaN(portInt)) {
      console.error(`Invalid port number: ${port}`);
      process.exit(1);
    }
    // configure the server to use SSE transport
    let transport: SSEServerTransport | null = null;
    const app = express();
    app.get('/sse', (req: Request, res: Response) => {
      transport = new SSEServerTransport('/messages', res);
      server.connect(transport);
    });

    app.post('/messages', (req: Request, res: Response) => {
      if (transport) {
        transport.handlePostMessage(req, res);
      }
    });

    app.listen(portInt);
    log(`Server is running on port ${portInt} with SSE transport`);
  }
  else {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    log('Server is running with Stdio transport');
  }
}

function log(
  message: string,
  level: 'error' | 'debug' | 'info' | 'notice' | 'warning' | 'critical' | 'alert' | 'emergency' = 'info',
) {
  if (useSSE) {
    console.log(message);
  }
  else {
    server.sendLoggingMessage({
      level,
      message,
    });
  }
}

main().catch((error) => {
  console.error('Error in main():', error);
  process.exit(1);
});

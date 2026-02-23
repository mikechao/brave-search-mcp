import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { BraveSearch } from 'brave-search';
import type { BraveMcpServer } from '../server.js';
import { z } from 'zod';
import { BaseTool } from './BaseTool.js';

const llmContextSearchInputSchema = z.object({
  query: z.string().max(400).describe('The search query. Maximum 400 characters and 50 words.'),
  count: z.number().min(1).max(50).default(20).optional().describe('The maximum number of search results considered. Minimum 1, maximum 50.'),
  maximumNumberOfUrls: z.number().min(1).max(50).default(20).optional().describe('The maximum number of URLs to include in the response. Minimum 1, maximum 50.'),
  maximumNumberOfTokens: z.number().min(1024).max(32768).default(8192).optional().describe('The approximate maximum number of tokens in the returned context. Minimum 1024, maximum 32768.'),
  maximumNumberOfSnippets: z.number().min(1).max(100).default(50).optional().describe('The maximum number of snippets across all URLs. Minimum 1, maximum 100.'),
  maximumNumberOfTokensPerUrl: z.number().min(512).max(8192).default(4096).optional().describe('The maximum number of tokens per URL. Minimum 512, maximum 8192.'),
  maximumNumberOfSnippetsPerUrl: z.number().min(1).max(100).default(50).optional().describe('The maximum number of snippets per URL. Minimum 1, maximum 100.'),
});

export class BraveLLMContextSearchTool extends BaseTool<typeof llmContextSearchInputSchema> {
  public readonly name = 'brave_llm_context_search';
  public readonly description = 'Retrieves pre-extracted web content optimized for AI agents, LLM grounding, and RAG pipelines. '
    + 'Use this to get relevant web context for answering questions with grounded, sourced information. '
    + 'Returns extracted snippets and source metadata.';

  public readonly inputSchema = llmContextSearchInputSchema;

  constructor(
    private braveMcpServer: BraveMcpServer,
    private braveSearch: BraveSearch,
    private isUI: boolean = false,
  ) {
    super();
  }

  public async executeCore(input: z.infer<typeof llmContextSearchInputSchema>): Promise<CallToolResult> {
    const {
      query,
      count,
      maximumNumberOfUrls,
      maximumNumberOfTokens,
      maximumNumberOfSnippets,
      maximumNumberOfTokensPerUrl,
      maximumNumberOfSnippetsPerUrl,
    } = input;

    const results = await this.braveSearch.llmContextSearch(query, {
      count,
      maximum_number_of_urls: maximumNumberOfUrls,
      maximum_number_of_tokens: maximumNumberOfTokens,
      maximum_number_of_snippets: maximumNumberOfSnippets,
      maximum_number_of_tokens_per_url: maximumNumberOfTokensPerUrl,
      maximum_number_of_snippets_per_url: maximumNumberOfSnippetsPerUrl,
    });

    if (!results.grounding?.generic || results.grounding.generic.length === 0) {
      this.braveMcpServer.log(`No LLM context results found for "${query}"`, 'info');
      return {
        content: [{ type: 'text', text: `No context results found for "${query}"` }],
      };
    }

    const genericItems = results.grounding.generic;

    const contentText = genericItems
      .map((item, index) => {
        const source = results.sources?.[item.url];
        const age = source?.age?.[0] ?? '';
        const header = `${index + 1}: ${item.title}\nURL: ${item.url}${age ? `\nDate: ${age}` : ''}`;
        const snippets = item.snippets.map(s => s.trim()).join('\n\n');
        return `${header}\n\n${snippets}`;
      })
      .join('\n\n---\n\n');

    return {
      content: [{ type: 'text', text: contentText }],
    };
  }
}

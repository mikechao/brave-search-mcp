import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { BraveSearch } from 'brave-search';
import type { ContextThresholdMode } from 'brave-search/dist/types.js';
import type { BraveMcpServer } from '../server.js';
import { z } from 'zod';
import { BaseTool } from './BaseTool.js';

const contextThresholdModes = ['disabled', 'strict', 'lenient', 'balanced'] as const satisfies readonly ContextThresholdMode[];

const COMPACT_DEFAULTS = {
  count: 8,
  maximumNumberOfUrls: 8,
  maximumNumberOfTokens: 2048,
  maximumNumberOfSnippets: 16,
  maximumNumberOfTokensPerUrl: 512,
  maximumNumberOfSnippetsPerUrl: 2,
  maxSnippetChars: 400,
  maxOutputChars: 8000,
  contextThresholdMode: 'strict' as ContextThresholdMode,
};

const boilerplateSignals = [
  'table of contents',
  'related posts',
  'related videos',
  'recommended video',
  'share on facebook',
  'tweet on twitter',
  'pin on pinterest',
  'terms and privacy policy',
  'privacy policy',
  'home »',
  'sources:',
];

const llmContextSearchInputSchema = z.object({
  query: z.string().max(400).describe('The search query. Maximum 400 characters and 50 words.'),
  url: z.url().optional().describe('Optional URL to target. When provided, query and URL are combined for retrieval, and only snippets from this exact URL are returned.'),
  count: z.number().min(1).max(50).default(COMPACT_DEFAULTS.count).optional().describe(`The maximum number of search results considered. Minimum 1, maximum 50. Default ${COMPACT_DEFAULTS.count} in compact mode, up to 50 in full mode.`),
  maximumNumberOfUrls: z.number().min(1).max(50).default(COMPACT_DEFAULTS.maximumNumberOfUrls).optional().describe(`The maximum number of URLs to include in the response. Minimum 1, maximum 50. Default ${COMPACT_DEFAULTS.maximumNumberOfUrls} in compact mode, up to 50 in full mode.`),
  maximumNumberOfTokens: z.number().min(1024).max(32768).default(COMPACT_DEFAULTS.maximumNumberOfTokens).optional().describe(`The approximate maximum number of tokens in the returned context. Minimum 1024, maximum 32768. Default ${COMPACT_DEFAULTS.maximumNumberOfTokens} in compact mode, up to 32768 in full mode.`),
  maximumNumberOfSnippets: z.number().min(1).max(100).default(COMPACT_DEFAULTS.maximumNumberOfSnippets).optional().describe(`The maximum number of snippets across all URLs. Minimum 1, maximum 100. Default ${COMPACT_DEFAULTS.maximumNumberOfSnippets} in compact mode, up to 100 in full mode.`),
  maximumNumberOfTokensPerUrl: z.number().min(512).max(8192).default(COMPACT_DEFAULTS.maximumNumberOfTokensPerUrl).optional().describe(`The maximum number of tokens per URL. Minimum 512, maximum 8192. Default ${COMPACT_DEFAULTS.maximumNumberOfTokensPerUrl} in compact mode, up to 8192 in full mode.`),
  maximumNumberOfSnippetsPerUrl: z.number().min(1).max(100).default(COMPACT_DEFAULTS.maximumNumberOfSnippetsPerUrl).optional().describe(`The maximum number of snippets per URL. Minimum 1, maximum 100. Default ${COMPACT_DEFAULTS.maximumNumberOfSnippetsPerUrl} in compact mode, up to 100 in full mode.`),
  contextThresholdMode: z.enum(contextThresholdModes).optional().describe(`Controls relevance filtering. Defaults to "${COMPACT_DEFAULTS.contextThresholdMode}" in compact mode when not set.`),
  responseMode: z.enum(['compact', 'full']).default('compact').optional().describe('compact returns filtered/truncated context optimized for model consumption. full returns all raw snippets without filtering or truncation.'),
  maxSnippetChars: z.number().int().min(80).max(4000).default(COMPACT_DEFAULTS.maxSnippetChars).optional().describe(`Maximum characters per snippet in compact mode. Default ${COMPACT_DEFAULTS.maxSnippetChars}.`),
  maxOutputChars: z.number().int().min(1000).max(100000).default(COMPACT_DEFAULTS.maxOutputChars).optional().describe(`Approximate maximum serialized response size in compact mode. Default ${COMPACT_DEFAULTS.maxOutputChars}.`),
});

export class BraveLLMContextSearchTool extends BaseTool<typeof llmContextSearchInputSchema> {
  public readonly name = 'brave_llm_context_search';
  public readonly description =
    'Best for questions that require reading and synthesizing web page content, '
    + 'such as "how does X work", "explain Y in detail", or "what are the tradeoffs of Z". '
    + 'Returns extracted text from web pages rather than just titles and descriptions. '
    + 'Not needed for simple factual lookups — use brave_web_search for those.';

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
      url,
      count,
      maximumNumberOfUrls,
      maximumNumberOfTokens,
      maximumNumberOfSnippets,
      maximumNumberOfTokensPerUrl,
      maximumNumberOfSnippetsPerUrl,
      contextThresholdMode,
      responseMode,
      maxSnippetChars,
      maxOutputChars,
    } = input;

    const isCompact = responseMode !== 'full';
    const effectiveCount = isCompact ? Math.min(count ?? COMPACT_DEFAULTS.count, COMPACT_DEFAULTS.count) : count;
    const effectiveMaximumNumberOfUrls = isCompact
      ? Math.min(maximumNumberOfUrls ?? COMPACT_DEFAULTS.maximumNumberOfUrls, COMPACT_DEFAULTS.maximumNumberOfUrls)
      : maximumNumberOfUrls;
    const effectiveMaximumNumberOfTokens = isCompact
      ? Math.min(maximumNumberOfTokens ?? COMPACT_DEFAULTS.maximumNumberOfTokens, COMPACT_DEFAULTS.maximumNumberOfTokens)
      : maximumNumberOfTokens;
    const effectiveMaximumNumberOfSnippets = isCompact
      ? Math.min(maximumNumberOfSnippets ?? COMPACT_DEFAULTS.maximumNumberOfSnippets, COMPACT_DEFAULTS.maximumNumberOfSnippets)
      : maximumNumberOfSnippets;
    const effectiveMaximumNumberOfTokensPerUrl = isCompact
      ? Math.min(maximumNumberOfTokensPerUrl ?? COMPACT_DEFAULTS.maximumNumberOfTokensPerUrl, COMPACT_DEFAULTS.maximumNumberOfTokensPerUrl)
      : maximumNumberOfTokensPerUrl;
    const effectiveMaximumNumberOfSnippetsPerUrl = isCompact
      ? Math.min(maximumNumberOfSnippetsPerUrl ?? COMPACT_DEFAULTS.maximumNumberOfSnippetsPerUrl, COMPACT_DEFAULTS.maximumNumberOfSnippetsPerUrl)
      : maximumNumberOfSnippetsPerUrl;
    const effectiveContextThresholdMode = contextThresholdMode ?? (isCompact ? COMPACT_DEFAULTS.contextThresholdMode : undefined);
    const combinedQuery = url ? `${query} ${url}` : query;

    const results = await this.braveSearch.llmContextSearch(combinedQuery, {
      count: effectiveCount,
      maximum_number_of_urls: effectiveMaximumNumberOfUrls,
      maximum_number_of_tokens: effectiveMaximumNumberOfTokens,
      maximum_number_of_snippets: effectiveMaximumNumberOfSnippets,
      maximum_number_of_tokens_per_url: effectiveMaximumNumberOfTokensPerUrl,
      maximum_number_of_snippets_per_url: effectiveMaximumNumberOfSnippetsPerUrl,
      ...(effectiveContextThresholdMode ? { context_threshold_mode: effectiveContextThresholdMode } : {}),
    });

    const genericItems = url
      ? (results.grounding?.generic ?? []).filter(item => item.url === url)
      : results.grounding?.generic ?? [];

    if (genericItems.length === 0) {
      if (url) {
        this.braveMcpServer.log(`No LLM context snippets found for URL "${url}" with query "${query}"`, 'info');
        return {
          content: [{ type: 'text', text: `No context snippets found for URL "${url}" with query "${query}"` }],
        };
      }

      this.braveMcpServer.log(`No LLM context results found for "${query}"`, 'info');
      return {
        content: [{ type: 'text', text: `No context results found for "${query}"` }],
      };
    }

    if (!isCompact) {
      const contentText = genericItems
        .map((item) => {
          const source = results.sources?.[item.url];
          const age = source?.age?.[0];
          const snippets = item.snippets.map((s) => {
            const trimmed = s.trim();
            try {
              return JSON.parse(trimmed);
            }
            catch {
              return trimmed;
            }
          });
          return JSON.stringify({ title: item.title, url: item.url, ...(age && { age }), snippets });
        })
        .join('\n');

      return {
        content: [{ type: 'text', text: contentText }],
      };
    }

    const outputLimit = maxOutputChars ?? COMPACT_DEFAULTS.maxOutputChars;
    const snippetCharLimit = maxSnippetChars ?? COMPACT_DEFAULTS.maxSnippetChars;
    const queryTerms = this.extractQueryTerms(query);
    const compactLines: string[] = [];
    let outputChars = 0;
    let totalSnippetCount = 0;
    const globalSnippetLimit = effectiveMaximumNumberOfSnippets ?? COMPACT_DEFAULTS.maximumNumberOfSnippets;
    const perUrlSnippetLimit = effectiveMaximumNumberOfSnippetsPerUrl ?? COMPACT_DEFAULTS.maximumNumberOfSnippetsPerUrl;

    for (const item of genericItems) {
      if (totalSnippetCount >= globalSnippetLimit)
        break;

      const source = results.sources?.[item.url];
      const age = source?.age?.[0];
      const cleanedSnippets = this.compactSnippets(item.snippets, queryTerms, snippetCharLimit, perUrlSnippetLimit);
      if (cleanedSnippets.length === 0)
        continue;

      const allowedSnippetCount = Math.max(globalSnippetLimit - totalSnippetCount, 0);
      const lineSnippets: string[] = [];
      for (const snippet of cleanedSnippets.slice(0, allowedSnippetCount)) {
        const candidateLine = JSON.stringify({
          title: item.title,
          url: item.url,
          ...(age ? { age } : {}),
          snippets: [...lineSnippets, snippet],
        });
        const delimiterLength = compactLines.length > 0 ? 1 : 0;
        if (outputChars + delimiterLength + candidateLine.length > outputLimit)
          break;
        lineSnippets.push(snippet);
      }

      if (lineSnippets.length === 0)
        break;

      const line = JSON.stringify({
        title: item.title,
        url: item.url,
        ...(age ? { age } : {}),
        snippets: lineSnippets,
      });
      const delimiterLength = compactLines.length > 0 ? 1 : 0;
      if (outputChars + delimiterLength + line.length > outputLimit)
        break;

      compactLines.push(line);
      outputChars += delimiterLength + line.length;
      totalSnippetCount += lineSnippets.length;
    }

    const contentText = compactLines.join('\n');

    return {
      content: [{ type: 'text', text: contentText }],
    };
  }

  private compactSnippets(
    rawSnippets: string[],
    queryTerms: string[],
    maxSnippetChars: number,
    maxPerUrl: number,
  ): string[] {
    const normalizedSeen = new Set<string>();
    const candidates: Array<{ value: string; score: number }> = [];

    for (const rawSnippet of rawSnippets) {
      const sanitized = this.sanitizeSnippet(rawSnippet);
      if (!sanitized)
        continue;
      if (this.isLikelyStructuredData(sanitized))
        continue;
      if (this.isLikelyBoilerplate(sanitized))
        continue;

      const normalized = this.normalizeSnippet(sanitized);
      if (!normalized || normalizedSeen.has(normalized))
        continue;
      normalizedSeen.add(normalized);

      candidates.push({
        value: this.truncateSnippet(sanitized, maxSnippetChars),
        score: this.scoreSnippet(sanitized, queryTerms),
      });
    }

    candidates.sort((a, b) => {
      if (b.score !== a.score)
        return b.score - a.score;
      return b.value.length - a.value.length;
    });

    const selected: string[] = [];
    for (const candidate of candidates) {
      if (selected.some(existing => this.areNearDuplicates(existing, candidate.value)))
        continue;
      selected.push(candidate.value);
      if (selected.length >= maxPerUrl)
        break;
    }

    return selected;
  }

  private sanitizeSnippet(snippet: string): string {
    return snippet
      .trim()
      .replace(/\*\[Image:[^\]]*\]\*/gi, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private isLikelyStructuredData(snippet: string): boolean {
    const trimmed = snippet.trim();
    const lower = trimmed.toLowerCase();
    if (lower.includes('"@graph"') || lower.includes('"@context"') || lower.includes('"@type"'))
      return true;
    if ((trimmed.startsWith('{') || trimmed.startsWith('[')) && trimmed.length > 160)
      return true;
    return false;
  }

  private isLikelyBoilerplate(snippet: string): boolean {
    const lower = snippet.toLowerCase();
    return boilerplateSignals.some(signal => lower.includes(signal));
  }

  private extractQueryTerms(query: string): string[] {
    return [...new Set(query
      .toLowerCase()
      .split(/\W+/)
      .map(s => s.trim())
      .filter(s => s.length >= 3))];
  }

  private scoreSnippet(snippet: string, queryTerms: string[]): number {
    const lower = snippet.toLowerCase();
    const overlap = queryTerms.reduce((score, term) => score + (lower.includes(term) ? 1 : 0), 0);
    const lengthBonus = Math.min(snippet.length, 300) / 1000;
    return overlap + lengthBonus;
  }

  private normalizeSnippet(snippet: string): string {
    return snippet
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private areNearDuplicates(a: string, b: string): boolean {
    const left = this.normalizeSnippet(a);
    const right = this.normalizeSnippet(b);
    if (!left || !right)
      return false;
    if (left === right)
      return true;
    if (Math.min(left.length, right.length) < 80)
      return false;
    return left.includes(right) || right.includes(left);
  }

  private truncateSnippet(snippet: string, maxSnippetChars: number): string {
    if (snippet.length <= maxSnippetChars)
      return snippet;
    return `${snippet.slice(0, maxSnippetChars - 3).trimEnd()}...`;
  }
}

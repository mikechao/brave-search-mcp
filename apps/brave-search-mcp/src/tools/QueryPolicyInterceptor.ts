import type { PolicyRules } from '../policy-loader.js';
import type { PreInterceptorResult, ToolInterceptor, ToolInterceptorContext } from './tool-helpers.js';

export class QueryPolicyInterceptor implements ToolInterceptor {
  constructor(
    private readonly rules: PolicyRules,
    private readonly redactMode: boolean,
  ) {}

  async before(context: ToolInterceptorContext): Promise<PreInterceptorResult | void> {
    const { query, url } = extractTextInputs(context.input);
    const textsToCheck: Array<{ field: 'query' | 'url'; value: string }> = [];
    if (query !== undefined)
      textsToCheck.push({ field: 'query', value: query });
    if (url !== undefined)
      textsToCheck.push({ field: 'url', value: url });

    if (textsToCheck.length === 0)
      return;

    if (this.redactMode)
      return this.handleRedact(context, textsToCheck);

    for (const { field, value } of textsToCheck) {
      const match = this.checkText(value);
      if (match !== null) {
        const label = field === 'url' ? 'URL' : 'Query';
        return {
          allow: false,
          reason: `${label} matched policy rule: ${match}`,
          code: 'POLICY_DENIED',
        };
      }
    }
  }

  private handleRedact(
    context: ToolInterceptorContext,
    texts: Array<{ field: 'query' | 'url'; value: string }>,
  ): PreInterceptorResult | void {
    const overrides: Partial<Record<'query' | 'url', string>> = {};
    for (const { field, value } of texts) {
      const redacted = this.redactText(value);
      if (redacted !== value)
        overrides[field] = redacted;
    }
    if (Object.keys(overrides).length === 0)
      return;
    return {
      allow: true,
      redactedInput: { ...context.input, ...overrides },
    };
  }

  private redactText(text: string): string {
    let result = text;
    for (const phrase of this.rules.deniedPhrases) {
      const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      result = result.replace(new RegExp(escaped, 'gi'), '[REDACTED]');
    }
    for (const pattern of this.rules.deniedPatterns) {
      const globalPattern = new RegExp(
        pattern.source,
        pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`,
      );
      result = result.replace(globalPattern, '[REDACTED]');
    }
    return result;
  }

  private checkText(text: string): string | null {
    for (const phrase of this.rules.deniedPhrases) {
      if (text.toLowerCase().includes(phrase.toLowerCase()))
        return `"${phrase}"`;
    }
    for (const pattern of this.rules.deniedPatterns) {
      if (pattern.test(text))
        return `/${pattern.source}/`;
    }
    return null;
  }
}

function extractTextInputs(input: Readonly<Record<string, unknown>>): {
  query?: string;
  url?: string;
} {
  return {
    query: typeof input.query === 'string' ? input.query : undefined,
    url: typeof input.url === 'string' ? input.url : undefined,
  };
}

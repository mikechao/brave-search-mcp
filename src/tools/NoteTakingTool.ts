import type { BraveMcpServer } from '../server.js';
import process from 'node:process';
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import OpenAI from 'openai';
import { z } from 'zod';
import { BaseTool } from './BaseTool.js';

const noteTakingInputSchema = z.object({
  url: z.string().url().describe('The URL of the page to take notes on'),
  topic: z.string().describe('The research topic of the notes'),
});

export class NoteTakingTool extends BaseTool<typeof noteTakingInputSchema, any> {
  public readonly name = 'note_taking';
  public readonly description = 'A tool for taking notes on a web page.';
  public readonly inputSchema = noteTakingInputSchema;

  private client;

  constructor(private server: BraveMcpServer) {
    super();
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  public async executeCore(input: z.infer<typeof noteTakingInputSchema>) {
    const { url, topic } = input;
    this.server.log(`Taking notes on ${url} for the topic "${topic}"`, 'debug');
    const notes = await this.getNotes(url, topic);
    const text = `Topic: ${topic}\nURL: ${url}\nNotes:\n${notes}`;
    return {
      content: [
        {
          type: 'text',
          text,
        },
      ],
    };
  }

  private async getNotes(url: string, topic: string) {
    // Fetch raw HTML
    const res = await fetch(url);
    const html = await res.text();
    // use JSDOM to get the main content, can only handle mostly static, server-rendered blogs/news sites
    // will not be able to handle client rendered sites SPAs or heavy JS frameworks
    // much lighter weight than using a headless browser like puppeteer
    const dom = new JSDOM(html, { url });
    const article = new Readability(dom.window.document).parse();
    if (!article)
      throw new Error('Could not parse article');
    if (!article.textContent)
      throw new Error('Could not extract text content from article');
    // take notes
    const instructions = `You will receive scraped website content about ${topic}. Your task is to take clear, organized notes focusing on ${topic}`
      + `\nPlease provide detailed research notes that:`
      + `\n1. Are well-organized and easy to read`
      + `\n2. Focus on the topic of ${topic}`
      + `\n3. Include specific facts, dates, and figures when available`
      + `\n4. Maintain accuracy of the original content`;
    const resp = await this.client.responses.create({
      model: 'gpt-4o-mini',
      instructions,
      input: article.textContent,
    });
    return resp.output_text;
  }
}

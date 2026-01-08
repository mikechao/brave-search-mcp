import type { z } from 'zod';

export abstract class BaseTool<T extends z.ZodType, R> {
  public abstract readonly name: string;
  public abstract readonly description: string;
  public abstract readonly inputSchema: T;

  protected constructor() {}

  public abstract executeCore(input: z.infer<T>): Promise<R>;

  public async execute(input: z.infer<T>) {
    try {
      return await this.executeCore(input);
    }
    catch (error) {
      console.error(`Error executing ${this.name}:`, error);
      return {
        content: [{
          type: 'text' as const,
          text: `Error in ${this.name}: ${error}`,
        }],
        isError: true,
      };
    }
  }
}

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

export declare const TOOL_DEFINITIONS: ToolDefinition[];

export declare const TOOL_NAMES: {
  readonly web: string;
  readonly llmContext: string;
  readonly image: string;
  readonly news: string;
  readonly local: string;
  readonly video: string;
};

export declare const ALL_TOOL_NAMES: string[];

export declare const MANIFEST_TOOL_ENTRIES: {
  readonly name: string;
  readonly description: string;
}[];

export declare function toolNameForVariant(variant: WidgetToolVariant): string;

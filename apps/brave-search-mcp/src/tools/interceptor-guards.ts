import type { BraveImageSearchInput } from './BraveImageSearchTool.js';
import type { BraveLLMContextSearchInput } from './BraveLLMContextSearchTool.js';
import type { BraveLocalSearchInput } from './BraveLocalSearchTool.js';
import type { BraveNewsSearchInput } from './BraveNewsSearchTool.js';
import type { BraveVideoSearchInput } from './BraveVideoSearchTool.js';
import type { BraveWebSearchInput } from './BraveWebSearchTool.js';
import type { ToolInterceptorContext } from './tool-helpers.js';
import { TOOL_NAMES } from '../tool-catalog.js';

export function isWebSearchContext(ctx: ToolInterceptorContext): ctx is ToolInterceptorContext<BraveWebSearchInput> {
  return ctx.toolName === TOOL_NAMES.web;
}

export function isImageSearchContext(ctx: ToolInterceptorContext): ctx is ToolInterceptorContext<BraveImageSearchInput> {
  return ctx.toolName === TOOL_NAMES.image;
}

export function isNewsSearchContext(ctx: ToolInterceptorContext): ctx is ToolInterceptorContext<BraveNewsSearchInput> {
  return ctx.toolName === TOOL_NAMES.news;
}

export function isVideoSearchContext(ctx: ToolInterceptorContext): ctx is ToolInterceptorContext<BraveVideoSearchInput> {
  return ctx.toolName === TOOL_NAMES.video;
}

export function isLocalSearchContext(ctx: ToolInterceptorContext): ctx is ToolInterceptorContext<BraveLocalSearchInput> {
  return ctx.toolName === TOOL_NAMES.local;
}

export function isLLMContextSearchContext(ctx: ToolInterceptorContext): ctx is ToolInterceptorContext<BraveLLMContextSearchInput> {
  return ctx.toolName === TOOL_NAMES.llmContext;
}

# ChatGPT Widget Implementation Guide

This document captures lessons learned from implementing the News Search widget with pagination and selective article context. These patterns apply to all ChatGPT widgets in this project.

---

## Overview

When building widgets that control what the model sees (selective context), you need to:
1. Hide full data from the model's automatic ingestion
2. Let the widget control when data is added to model context
3. Support pagination via `callTool()` for loading more results

---

## Key Patterns

### 1. Hiding Data from Model: Use `_meta`

**Problem**: `structuredContent` at the top level is automatically ingested by the model.

**Solution**: Move structured data to `_meta.structuredContent`:

```typescript
// In tool's executeCore method
return {
  content: [{ type: 'text', text: 'Summary text...' }],
  _meta: {
    structuredContent: { query, items, offset, count }
  }
};
```

### 2. Remove `outputSchema` When Using `_meta`

**Problem**: If tool is registered with `outputSchema`, the SDK validates that top-level `structuredContent` exists and matches the schema.

**Error**: `"Output validation error: Tool has an output schema but no structured content was provided"`

**Solution**: Remove `outputSchema` from tool registration in `server.ts`:

```typescript
// Before (causes validation error)
registerAppTool(server, 'brave_news_search', { 
  outputSchema: newsSearchOutputSchema.shape,
  ...
});

// After (works with _meta)
registerAppTool(server, 'brave_news_search', { 
  // No outputSchema  
  ...
});
```

### 3. Widget: Access `_meta` via `useToolResponseMetadata()`

The standard `useToolOutput()` hook only returns visible content. For `_meta` data:

```typescript
import { useToolOutput, useToolResponseMetadata } from '@anthropic-ai/claude-apps-sdk';

// Initial load
const rawOutput = useToolOutput() as any;
const rawMetadata = useToolResponseMetadata() as any;

// Prefer metadata (where structuredContent lives now)
const initialData = rawMetadata?.structuredContent ?? rawOutput?.structuredContent;
```

### 4. Pagination: `callTool()` Returns `meta` Not `_meta`

**Critical Difference**: 
- Initial load hooks provide `_meta` (with underscore)
- `window.openai.callTool()` returns `meta` (lowercase, no underscore)

```typescript
const handleLoadPage = async (offset: number) => {
  const result = await window.openai.callTool('tool_name', { query, offset });
  
  // Check both 'meta' (callTool) and '_meta' (fallback)
  const newData = result?.meta?.structuredContent 
               ?? result?._meta?.structuredContent 
               ?? result?.structuredContent;
               
  if (newData) {
    setToolOutput(newData);
  }
};
```

### 5. Prompt Engineering: Prevent Model Hallucination

Even with hidden data, the model may try to guess/hallucinate content. Use explicit instructions:

```typescript
const contentText = this.isUI
  ? `Found ${items.length} results for "${query}". `
    + 'IMPORTANT: You CANNOT see the titles, sources, or content. '
    + 'The user sees a widget with the results, but you have NO information about them. '
    + 'Do NOT claim to see details or describe what the results are about. '
    + 'Tell the user to click the + icon to add items to the conversation.'
  : formatResultsForModel(items);  // Non-UI mode gets full text
```

### 6. Context Control: `setWidgetState()` for User-Selected Items

When user clicks to add items to context:

```typescript
const handleContextChange = (articles: ContextArticle[]) => {
  setContextArticles(articles);
  
  if (window.openai?.setWidgetState) {
    window.openai.setWidgetState({
      selectedArticles: articles.map(a => ({
        title: a.title,
        description: a.description,
        url: a.url,
        source: a.source,
      })),
    });
  }
};
```

---

## Implementation Checklist for New Tools

When adding selective context and pagination to other tools:

- [ ] Move structured data to `_meta.structuredContent` in tool
- [ ] Remove `outputSchema` from tool registration
- [ ] Update widget to use `useToolResponseMetadata()` for initial data
- [ ] In pagination handler, check `result.meta` (not `_meta`) from `callTool()`
- [ ] Add explicit "you cannot see this content" text to tool response
- [ ] Implement `setWidgetState()` for user context selection
- [ ] Test all code paths: success, no results, error

---

## Files Modified for News Widget

| File | Changes |
|------|---------|
| `src/tools/BraveNewsSearchTool.ts` | Return `_meta.structuredContent`, explicit text message |
| `src/server.ts` | Remove `outputSchema` for news tool |
| `ui/src/lib/news/news-chatgpt-mode.tsx` | Use `useToolResponseMetadata()`, handle `meta` from `callTool()` |
| `ui/src/lib/news/NewsSearchApp.tsx` | Pagination UI, context selection buttons |

---

## Common Errors and Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| `Output validation error: no structured content` | `outputSchema` set but `structuredContent` in `_meta` | Remove `outputSchema` from registration |
| Widget shows blank | Using `useToolOutput()` for `_meta` data | Use `useToolResponseMetadata()` |
| Pagination doesn't work | Checking `_meta` from `callTool()` | Check `meta` (lowercase) from `callTool()` |
| Model claims to see content | Model hallucinating from context | Add explicit "you CANNOT see" instructions |

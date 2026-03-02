import type { ContentBlock } from '@modelcontextprotocol/sdk/types.js';
import type { WidgetProps } from '../../widget-props';
import type { ContextImage } from './types';
import { useCallback, useRef, useState } from 'react';
import { useMcpApp } from '../../hooks/useMcpApp';
import ImageSearchApp from './ImageSearchApp';

const APP_INFO = { name: 'Brave Image Search', version: '1.0.0' };
const MODEL_SUPPORTED_MIME_TYPES = new Set(['image/png', 'image/jpeg']);

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function normalizeBlobForModel(blob: Blob): Promise<{ blob: Blob; mimeType: string }> {
  if (MODEL_SUPPORTED_MIME_TYPES.has(blob.type)) {
    return { blob, mimeType: blob.type };
  }

  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') {
    throw new TypeError(`Unsupported image mime type for model context: ${blob.type || 'unknown'}`);
  }

  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to create canvas context for image normalization');
    }
    ctx.drawImage(bitmap, 0, 0);
    const normalizedBlob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/png');
    });
    if (!normalizedBlob) {
      throw new Error('Failed to convert image to PNG for model context');
    }
    return { blob: normalizedBlob, mimeType: 'image/png' };
  }
  finally {
    bitmap.close();
  }
}

export default function ImageMcpAppMode() {
  const {
    app,
    error,
    toolInputs,
    toolInputsPartial,
    toolResult,
    hostContext,
    callServerTool,
    sendMessage,
    openLink,
    sendLog,
    requestDisplayMode,
  } = useMcpApp({ appInfo: APP_INFO });
  const [contextImages, setContextImages] = useState<ContextImage[]>([]);
  const imageContentCacheRef = useRef<Record<string, { data: string; mimeType: string }>>({});
  const contextUpdateSequenceRef = useRef(0);

  const handleContextChange = useCallback(async (images: ContextImage[]) => {
    setContextImages(images);
    if (!app)
      return;
    const sequence = ++contextUpdateSequenceRef.current;

    const contentText = images.length > 0
      ? images
          .map((image, idx) => (
            `${idx + 1}: Title: ${image.title}\n`
            + `Source: ${image.source}\n`
            + `Page URL: ${image.pageUrl}\n`
            + `Image URL: ${image.imageUrl}\n`
            + `Confidence: ${image.confidence ?? 'N/A'}\n`
            + `Width: ${image.width ?? 'N/A'}\n`
            + `Height: ${image.height ?? 'N/A'}`
          ))
          .join('\n\n')
      : 'No images selected.';
    const textOnlyContent: ContentBlock[] = [{ type: 'text', text: contentText }];
    const contentWithImages: ContentBlock[] = [...textOnlyContent];

    if (images.length > 0) {
      const imageBlocks = await Promise.all(images.map(async (image) => {
        const cached = imageContentCacheRef.current[image.imageUrl];
        if (cached) {
          return {
            type: 'image',
            data: cached.data,
            mimeType: cached.mimeType,
          } as const;
        }

        try {
          const response = await fetch(image.imageUrl);
          if (!response.ok) {
            throw new Error(`Image download failed with status ${response.status}`);
          }
          const rawBlob = await response.blob();
          const { blob, mimeType } = await normalizeBlobForModel(rawBlob);
          const data = await blobToBase64(blob);
          imageContentCacheRef.current[image.imageUrl] = { data, mimeType };
          return {
            type: 'image',
            data,
            mimeType,
          } as const;
        }
        catch (err) {
          console.warn(
            `Failed to include image in MCP model context: ${image.imageUrl}`,
            err,
          );
          return null;
        }
      }));

      // Ignore stale async completions from older selection states.
      if (sequence !== contextUpdateSequenceRef.current) {
        return;
      }

      for (const block of imageBlocks) {
        if (block) {
          contentWithImages.push(block);
        }
      }
    }

    try {
      await app.updateModelContext({
        content: contentWithImages,
      });
    }
    catch (err) {
      console.warn('Host rejected image context payload, falling back to text-only context.', err);
      app.updateModelContext({
        content: textOnlyContent,
      }).catch(fallbackErr => console.error('Failed to update text-only model context:', fallbackErr));
    }
  }, [app]);

  if (error) {
    return (
      <div className="error">
        Error:
        {error.message}
      </div>
    );
  }
  if (!app)
    return <div className="loading">Connecting...</div>;

  const props: WidgetProps = {
    toolInputs,
    toolInputsPartial,
    toolResult,
    hostContext,
    callServerTool,
    sendMessage,
    openLink,
    sendLog,
    displayMode: hostContext?.displayMode,
    requestDisplayMode,
  };

  // Derive initial loading state: tool invoked but no result yet
  const isInitialLoading = toolInputs !== null && toolResult === null;
  const loadingQuery = (toolInputs?.searchTerm as string) ?? undefined;

  return (
    <ImageSearchApp
      {...props}
      isInitialLoading={isInitialLoading}
      loadingQuery={loadingQuery}
      contextImages={contextImages}
      onContextChange={handleContextChange}
    />
  );
}

/**
 * Image Search - ChatGPT mode wrapper
 * Uses custom useOpenAiGlobal hook for reactive updates
 */
import type { ImageSearchAppProps } from './ImageSearchApp';
import type { ContextImage, ImageSearchData } from './types';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useOpenAiAppTheme } from '../../hooks/useAppTheme';
import { useChatGptBridge } from '../../hooks/useChatGptBridge';
import { useToolInput, useToolOutput } from '../../hooks/useOpenAiGlobal';
import ImageSearchApp from './ImageSearchApp';

const UPLOAD_MIME_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};
const ALLOWED_UPLOAD_MIME_TYPES = new Set(Object.values(UPLOAD_MIME_BY_EXTENSION));

function inferMimeType(imageUrl: string, responseMimeType: string): string | null {
  if (ALLOWED_UPLOAD_MIME_TYPES.has(responseMimeType)) {
    return responseMimeType;
  }

  const cleanUrl = imageUrl.split('?')[0]?.toLowerCase() ?? '';
  const extension = cleanUrl.split('.').pop();
  if (!extension)
    return null;
  return UPLOAD_MIME_BY_EXTENSION[extension] ?? null;
}

function extensionForMimeType(mimeType: string): 'png' | 'jpg' | 'webp' {
  if (mimeType === 'image/png')
    return 'png';
  if (mimeType === 'image/webp')
    return 'webp';
  return 'jpg';
}

function buildUploadFileName(image: ContextImage, extension: 'png' | 'jpg' | 'webp'): string {
  const base = image.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'image';
  return `${base}.${extension}`;
}

export default function ImageChatGPTMode() {
  useOpenAiAppTheme();

  // Use reactive hooks instead of manual polling
  const toolOutput = useToolOutput() as unknown as ImageSearchData | null;

  // Access tool input (arguments) for loading state detection
  const toolInput = useToolInput() as { searchTerm?: string } | null;
  const {
    displayMode,
    hostContext,
    openLink,
    requestDisplayMode,
    noopLog,
    canSetWidgetState,
    canUploadFile,
    setWidgetState,
    uploadFile,
  } = useChatGptBridge();
  const [contextImages, setContextImages] = useState<ContextImage[]>([]);
  const [fileIdsByImageUrl, setFileIdsByImageUrl] = useState<Record<string, string>>({});
  const [contextDisabled, setContextDisabled] = useState(false);
  const isUploadingRef = useRef(false);
  const contextImagesRef = useRef(contextImages);
  const fileIdsByImageUrlRef = useRef(fileIdsByImageUrl);
  contextImagesRef.current = contextImages;
  fileIdsByImageUrlRef.current = fileIdsByImageUrl;

  // Derive initial loading state: tool invoked (has input) but no result yet
  const hasData = Boolean(toolOutput);
  const isInitialLoading = toolInput !== null && !hasData;
  const loadingQuery = toolInput?.searchTerm;
  const hasContextSupport = canSetWidgetState && canUploadFile && !contextDisabled;

  const syncWidgetState = useCallback((images: ContextImage[], fileIdMap: Record<string, string>) => {
    if (!canSetWidgetState)
      return;

    const selectedImages = images.map((image, idx) => ({
      index: idx + 1,
      title: image.title,
      source: image.source,
      pageUrl: image.pageUrl,
      imageUrl: image.imageUrl,
      confidence: image.confidence,
      width: image.width,
      height: image.height,
    }));
    const metadataText = selectedImages.length > 0
      ? selectedImages.map(image => (
          `${image.index}: Title: ${image.title}\n`
          + `Source: ${image.source}\n`
          + `Page URL: ${image.pageUrl}\n`
          + `Image URL: ${image.imageUrl}\n`
          + `Confidence: ${image.confidence ?? 'N/A'}\n`
          + `Width: ${image.width ?? 'N/A'}\n`
          + `Height: ${image.height ?? 'N/A'}`
        )).join('\n\n')
      : 'No images selected.';
    const selectedImageUrls = new Set(images.map(image => image.imageUrl));
    const fileEntries = Object.entries(fileIdMap).filter(([imageUrl]) => selectedImageUrls.has(imageUrl));
    const imageIds = fileEntries.map(([, fileId]) => fileId);
    const rawFileIdsByImageUrl = Object.fromEntries(fileEntries);

    setWidgetState({
      modelContent: metadataText,
      privateContent: {
        selectedImages,
        count: selectedImages.length,
        rawFileIds: imageIds,
        rawFileIdsByImageUrl,
      },
      imageIds,
    });
  }, [canSetWidgetState, setWidgetState]);

  const clearWidgetState = useCallback(() => {
    syncWidgetState([], {});
  }, [syncWidgetState]);

  const disableContextForSession = useCallback((reason: string) => {
    console.error(`Image context disabled: ${reason}`);
    setContextDisabled(true);
    setContextImages([]);
    setFileIdsByImageUrl({});
    clearWidgetState();
  }, [clearWidgetState]);

  useEffect(() => {
    if (canSetWidgetState && !canUploadFile) {
      clearWidgetState();
    }
  }, [canSetWidgetState, canUploadFile, clearWidgetState]);

  const handleContextChange = useCallback(async (images: ContextImage[]) => {
    if (!hasContextSupport)
      return;

    const previousImages = contextImagesRef.current;
    const previousFileIdsByImageUrl = fileIdsByImageUrlRef.current;
    const previousImageUrls = new Set(previousImages.map(image => image.imageUrl));
    const nextImageUrls = new Set(images.map(image => image.imageUrl));

    // Remove path (or no-op reorder): update immediately and keep only selected file IDs.
    if (images.length <= previousImages.length) {
      const nextFileIdsByImageUrl = Object.fromEntries(
        Object.entries(previousFileIdsByImageUrl).filter(([imageUrl]) => nextImageUrls.has(imageUrl)),
      );
      setContextImages(images);
      setFileIdsByImageUrl(nextFileIdsByImageUrl);
      syncWidgetState(images, nextFileIdsByImageUrl);
      return;
    }

    // Add path: image list is expected to contain exactly one new image.
    const addedImage = images.find(image => !previousImageUrls.has(image.imageUrl));
    if (!addedImage) {
      setContextImages(images);
      syncWidgetState(images, previousFileIdsByImageUrl);
      return;
    }

    if (isUploadingRef.current) {
      return;
    }

    isUploadingRef.current = true;
    try {
      const response = await fetch(addedImage.imageUrl);
      if (!response.ok) {
        throw new Error(`Image download failed with status ${response.status}`);
      }

      const blob = await response.blob();
      const mimeType = inferMimeType(addedImage.imageUrl, blob.type);
      if (!mimeType) {
        throw new Error(`Unsupported image type: ${blob.type || 'unknown'}`);
      }

      const uploadBlob = blob.type === mimeType ? blob : new Blob([blob], { type: mimeType });
      const extension = extensionForMimeType(mimeType);
      const file = new File([uploadBlob], buildUploadFileName(addedImage, extension), { type: mimeType });
      const uploadResult = await uploadFile(file);
      const fileId = uploadResult?.fileId;
      if (!fileId) {
        throw new Error('uploadFile did not return a fileId');
      }

      const nextFileIdsByImageUrl = { ...previousFileIdsByImageUrl, [addedImage.imageUrl]: fileId };
      syncWidgetState(images, nextFileIdsByImageUrl);
      setContextImages(images);
      setFileIdsByImageUrl(nextFileIdsByImageUrl);
    }
    catch (err) {
      disableContextForSession(err instanceof Error ? err.message : String(err));
    }
    finally {
      isUploadingRef.current = false;
    }
  }, [disableContextForSession, hasContextSupport, syncWidgetState, uploadFile]);

  const props: ImageSearchAppProps = {
    toolInputs: null,
    toolInputsPartial: null,
    toolResult: toolOutput ? { structuredContent: toolOutput } : null,
    hostContext,
    openLink,
    sendLog: noopLog,
    displayMode: displayMode ?? 'inline',
    requestDisplayMode,
    contextImages,
    onContextChange: hasContextSupport ? handleContextChange : undefined,
  };

  return <ImageSearchApp {...props} isInitialLoading={isInitialLoading} loadingQuery={loadingQuery} />;
}

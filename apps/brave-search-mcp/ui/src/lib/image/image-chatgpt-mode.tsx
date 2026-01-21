/**
 * Image Search - ChatGPT mode wrapper
 * Uses custom useOpenAiGlobal hook for reactive updates
 */
import type { SaveImageParams, WidgetProps } from '../../widget-props';
import type { ImageSearchData } from './types';
import { useDisplayMode, useToolOutput } from '../../hooks/useOpenAiGlobal';
import ImageSearchApp from './ImageSearchApp';

export default function ImageChatGPTMode() {
  // Use reactive hooks instead of manual polling
  const toolOutput = useToolOutput() as unknown as ImageSearchData | null;
  const displayMode = useDisplayMode();

  const handleOpenLink = async ({ url }: { url: string }) => {
    // Access directly from window.openai since functions are set at init, not via events
    try {
      if (window.openai?.openExternal) {
        await window.openai.openExternal({ href: url });
      }
      return { isError: false };
    }
    catch {
      return { isError: true };
    }
  };

  const handleRequestDisplayMode = async (mode: 'inline' | 'fullscreen' | 'pip') => {
    // Access directly from window.openai since functions are set at init, not via events
    if (window.openai?.requestDisplayMode) {
      await window.openai.requestDisplayMode({ mode });
    }
  };

  const handleSaveImage = async (params: SaveImageParams) => {
    // Check if upload API is available
    if (!window.openai?.uploadFile || !window.openai?.setWidgetState) {
      throw new Error('Save to context not supported');
    }

    // 1. Fetch image as blob
    const response = await fetch(params.imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }
    const blob = await response.blob();
    const file = new File([blob], 'image.jpg', { type: blob.type || 'image/jpeg' });

    // 2. Upload to ChatGPT
    const uploadResult = await window.openai.uploadFile(file);

    // 3. Store in widget state using StructuredWidgetState format
    window.openai.setWidgetState({
      modelContent: { savedImageTitle: params.title },
      privateContent: {},
      imageIds: [uploadResult.fileId],
    });

    // 4. Wait for state to flush before triggering model turn
    // Host state persistence is async, so we wait a frame to avoid race conditions
    await new Promise(resolve => requestAnimationFrame(resolve));

    // 5. Send a follow-up message to trigger the model to see and describe the saved image
    if (window.openai.sendFollowUpMessage) {
      await window.openai.sendFollowUpMessage({
        prompt: `Please describe what you see.`,
      });
    }
  };

  const noop = async () => ({ isError: false });
  const noopLog = async () => { };

  const props: WidgetProps = {
    toolInputs: null,
    toolInputsPartial: null,
    toolResult: toolOutput ? { structuredContent: toolOutput } as any : null,
    hostContext: null,
    callServerTool: noop as any,
    sendMessage: noop as any,
    openLink: handleOpenLink,
    sendLog: noopLog as any,
    displayMode: displayMode ?? 'inline',
    requestDisplayMode: handleRequestDisplayMode,
    onSaveImage: handleSaveImage,
  };

  return <ImageSearchApp {...props} />;
}

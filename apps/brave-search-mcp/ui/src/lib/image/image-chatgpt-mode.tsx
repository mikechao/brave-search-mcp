/**
 * Image Search - ChatGPT mode wrapper
 * Uses window.openai runtime
 */
import type { WidgetProps } from '../../widget-props';
import type { ImageSearchData } from './types';
import { useEffect, useState } from 'react';
import ImageSearchApp from './ImageSearchApp';

export default function ImageChatGPTMode() {
  const [data, setData] = useState<ImageSearchData | null>(null);
  const [displayMode, setDisplayMode] = useState<'inline' | 'fullscreen' | 'pip'>('inline');

  useEffect(() => {
    const check = () => {
      const output = window.openai?.toolOutput;
      if (output) {
        setData(output as unknown as ImageSearchData);
      }
      // Update display mode from openai runtime
      const mode = window.openai?.displayMode;
      if (mode === 'inline' || mode === 'fullscreen' || mode === 'pip') {
        setDisplayMode(mode);
      }
    };
    check();
    const interval = setInterval(check, 200);
    return () => clearInterval(interval);
  }, []);

  const handleOpenLink = async ({ url }: { url: string }) => {
    try {
      if (window.openai?.openExternal) {
        await window.openai.openExternal({ href: url });
      }
      else {
        window.open(url, '_blank');
      }
      return { isError: false };
    }
    catch {
      return { isError: true };
    }
  };

  const handleRequestDisplayMode = async (mode: 'inline' | 'fullscreen' | 'pip') => {
    if (window.openai?.requestDisplayMode) {
      await window.openai.requestDisplayMode({ mode });
    }
  };

  const noop = async () => ({ isError: false });
  const noopLog = async () => { };

  const props: WidgetProps = {
    toolInputs: null,
    toolInputsPartial: null,
    toolResult: data ? { structuredContent: data } as any : null,
    hostContext: null,
    callServerTool: noop as any,
    sendMessage: noop as any,
    openLink: handleOpenLink,
    sendLog: noopLog as any,
    displayMode,
    requestDisplayMode: handleRequestDisplayMode,
  };

  return <ImageSearchApp {...props} />;
}

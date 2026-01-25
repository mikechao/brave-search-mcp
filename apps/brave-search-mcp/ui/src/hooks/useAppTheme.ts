import { applyDocumentTheme } from '@openai/apps-sdk-ui/theme';
import { useEffect } from 'react';
import { useTheme } from './useOpenAiGlobal';

const DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)';

function getSystemTheme(): 'light' | 'dark' {
  return window.matchMedia?.(DARK_MEDIA_QUERY).matches ? 'dark' : 'light';
}

export function useAppTheme() {
  const hostTheme = useTheme();

  useEffect(() => {
    if (hostTheme === 'light' || hostTheme === 'dark') {
      applyDocumentTheme(hostTheme);
      return;
    }

    const applySystemTheme = () => {
      applyDocumentTheme(getSystemTheme());
    };

    applySystemTheme();

    const media = window.matchMedia?.(DARK_MEDIA_QUERY);
    if (!media)
      return;

    const handleChange = () => applySystemTheme();
    if (media.addEventListener) {
      media.addEventListener('change', handleChange);
      return () => {
        media.removeEventListener('change', handleChange);
      };
    }

    media.addListener?.(handleChange);
    return () => {
      media.removeListener?.(handleChange);
    };
  }, [hostTheme]);
}

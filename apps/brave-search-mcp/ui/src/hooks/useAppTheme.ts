import { applyDocumentTheme } from '@openai/apps-sdk-ui/theme';
import { useEffect } from 'react';
import { useTheme } from './useOpenAiGlobal';

const DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)';
type AppTheme = 'light' | 'dark';

function getSystemTheme(): AppTheme {
  return window.matchMedia?.(DARK_MEDIA_QUERY).matches ? 'dark' : 'light';
}

export function useAppTheme(overrideTheme?: AppTheme) {
  const openAiTheme = useTheme();

  useEffect(() => {
    const theme = overrideTheme ?? (openAiTheme === 'light' || openAiTheme === 'dark' ? openAiTheme : undefined);
    if (theme) {
      applyDocumentTheme(theme);
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
  }, [openAiTheme, overrideTheme]);
}

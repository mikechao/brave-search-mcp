/**
 * News Search - ChatGPT mode
 * Uses window.openai for ChatGPT Apps SDK (skybridge)
 */
import type { WidgetProps } from '../../widget-props';
import type { NewsSearchData } from './types';
import { useEffect, useState } from 'react';
import NewsSearchApp from './NewsSearchApp';

/**
 * ChatGPT mode wrapper
 * Polls for toolOutput from ChatGPT's window.openai
 */
export default function NewsChatGPTMode() {
    const [data, setData] = useState<NewsSearchData | null>(null);

    useEffect(() => {
        const check = () => {
            const output = window.openai?.toolOutput;
            if (output) {
                setData(output as unknown as NewsSearchData);
            }
        };
        check();
        const interval = setInterval(check, 200);
        return () => clearInterval(interval);
    }, []);

    const handleOpenLink = async ({ url }: { url: string }) => {
        try {
            if (window.openai?.openExternal) {
                window.openai.openExternal({ href: url });
            }
            return { isError: false };
        }
        catch {
            return { isError: true };
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
    };

    return <NewsSearchApp {...props} />;
}

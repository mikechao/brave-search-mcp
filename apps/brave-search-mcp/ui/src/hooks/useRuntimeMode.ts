import { useSyncExternalStore } from 'react';

export type RuntimeMode = 'detecting' | 'chatgpt' | 'mcp-app';

const CHECK_INTERVALS = [0, 50, 100, 200, 500];
const listeners = new Set<() => void>();
let currentMode: RuntimeMode = 'detecting';
let detectionStarted = false;
let timers: Array<ReturnType<typeof setTimeout>> = [];
let logLabel = 'Widget';

function notify() {
  listeners.forEach(listener => listener());
}

function clearTimers() {
  timers.forEach(clearTimeout);
  timers = [];
}

function setMode(nextMode: RuntimeMode) {
  if (currentMode !== nextMode) {
    currentMode = nextMode;
    notify();
  }
}

function startDetection(label?: string) {
  if (currentMode !== 'detecting' || detectionStarted)
    return;

  detectionStarted = true;
  if (label)
    logLabel = label;

  if (typeof window === 'undefined') {
    setMode('mcp-app');
    return;
  }

  let attempt = 0;
  const checkRuntime = () => {
    if (typeof window.openai !== 'undefined') {
      console.log(`[Brave ${logLabel} Widget] Detected ChatGPT runtime`);
      clearTimers();
      setMode('chatgpt');
      return;
    }

    attempt++;
    if (attempt < CHECK_INTERVALS.length) {
      timers.push(setTimeout(checkRuntime, CHECK_INTERVALS[attempt]));
    }
    else {
      console.log(`[Brave ${logLabel} Widget] Using MCP-APP runtime`);
      clearTimers();
      setMode('mcp-app');
    }
  };

  checkRuntime();
}

function subscribe(label?: string) {
  return (listener: () => void) => {
    listeners.add(listener);
    startDetection(label);
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0 && currentMode === 'detecting') {
        clearTimers();
        detectionStarted = false;
      }
    };
  };
}

const getSnapshot = () => currentMode;
const getServerSnapshot = () => 'detecting' as const;

export function useRuntimeMode(label?: string) {
  return useSyncExternalStore(subscribe(label), getSnapshot, getServerSnapshot);
}

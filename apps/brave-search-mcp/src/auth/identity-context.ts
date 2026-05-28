import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

export type TransportKind = 'stdio' | 'http';

export type AuthSource
  = 'none'
    | 'stdio-process'
    | 'stdio-env'
    | 'http-api-key'
    | 'jwt'
    | 'oauth'
    | 'mtls';

export interface CallerIdentity {
  transport: TransportKind;
  authSource: AuthSource;
  callerId?: string;
  scopes?: string[];
}

export interface RequestContext {
  requestId: string;
  identity: CallerIdentity;
}

const requestContextStorage = new AsyncLocalStorage<RequestContext>();

export function createRequestContext(identity: CallerIdentity, requestId: string = randomUUID()): RequestContext {
  return { requestId, identity };
}

export function runWithRequestContext<T>(context: RequestContext, fn: () => T): T {
  return requestContextStorage.run(context, fn);
}

export function getRequestContext(): RequestContext | undefined {
  return requestContextStorage.getStore();
}

export function getCallerIdentity(): CallerIdentity | undefined {
  return requestContextStorage.getStore()?.identity;
}

import type { AuthConfig } from '../config-loader.js';

function hasHttpAuthMechanism(auth: AuthConfig): boolean {
  return !!(auth.httpApiKey || auth.jwt || auth.oauth);
}

function hasIgnoredHttpAuthConfig(auth: AuthConfig): boolean {
  return !!(auth.httpApiKey || auth.requireAuth !== undefined || auth.jwt || auth.oauth);
}

export function validateTransportAuthConfig(auth: AuthConfig, isHttp: boolean, warn: (message: string) => void): void {
  if (isHttp) {
    if (auth.requireAuth && !hasHttpAuthMechanism(auth)) {
      throw new Error(
        'Error: BRAVE_MCP_REQUIRE_AUTH=true requires one of auth.httpApiKey, auth.jwt, or auth.oauth when --http is used',
      );
    }
    if (auth.oauth) {
      if (auth.jwt)
        warn('Warning: auth.jwt is ignored in HTTP mode because auth.oauth takes precedence');
      if (auth.httpApiKey)
        warn('Warning: auth.httpApiKey is ignored in HTTP mode because auth.oauth takes precedence');
      return;
    }
    if (auth.jwt && auth.httpApiKey) {
      warn('Warning: auth.httpApiKey is ignored in HTTP mode because auth.jwt takes precedence');
    }
    return;
  }

  if (hasIgnoredHttpAuthConfig(auth)) {
    warn('Warning: HTTP auth configuration is ignored in stdio mode');
  }
}

#!/usr/bin/env node

import process from 'node:process';
import { buildOAuthIntrospectionResponse, createOAuthAccessToken, startOAuthProviderStub } from './oauth-fixtures.js';

async function main(): Promise<void> {
  const validToken = await createOAuthAccessToken();
  const stub = await startOAuthProviderStub({
    discoveryMode: process.env.OAUTH_PROVIDER_STUB_DISCOVERY_MODE === 'oidc-only' ? 'oidc-only' : 'oauth',
    expectedClientId: process.env.BRAVE_MCP_OAUTH_CLIENT_ID,
    expectedClientSecret: process.env.BRAVE_MCP_OAUTH_CLIENT_SECRET,
    introspectionResponses: {
      [validToken]: buildOAuthIntrospectionResponse(),
    },
  });

  console.log(`OAuth provider stub listening on ${stub.issuer}`);
  console.log(`Valid bearer token: ${validToken}`);

  async function shutdown(): Promise<void> {
    await stub.close();
    process.exit(0);
  }

  process.on('SIGINT', () => {
    shutdown().catch((error) => {
      console.error(error);
      process.exit(1);
    });
  });
  process.on('SIGTERM', () => {
    shutdown().catch((error) => {
      console.error(error);
      process.exit(1);
    });
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
